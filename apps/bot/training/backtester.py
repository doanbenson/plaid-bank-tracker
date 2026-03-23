"""Backtest engine — runs the full agent pipeline against historical data.

Walks through OHLCV data day-by-day, calling Strategy -> Risk -> Execution
using a SimulatedPortfolio. No LLM, no live API calls during the loop.

Usage:
    cd apps/bot
    python -m training.backtester --days 365 --cash 100000
"""

import argparse
import asyncio
import logging
import math
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
from models.lstm_forecaster import LSTMForecaster
from models.signal import TradeSignal, SignalDirection
from services.market_data import MarketDataService, compute_features
from services.simulated_portfolio import SimulatedPortfolio
from agents.risk_agent import RiskAgent
from agents.execution_agent import ExecutionAgent

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("backtester")


# ─── Metrics ─────────────────────────────────────────────────────────────────

def compute_metrics(sim: SimulatedPortfolio, benchmark_returns: np.ndarray | None = None) -> dict:
    """Compute performance metrics from the simulated portfolio."""
    if len(sim.equity_curve) < 2:
        return {"error": "Not enough data points"}

    equities = np.array([e["equity"] for e in sim.equity_curve])
    daily_returns = np.diff(equities) / equities[:-1]

    total_return = (equities[-1] - equities[0]) / equities[0]
    trading_days = len(daily_returns)
    annual_factor = 252 / trading_days if trading_days > 0 else 1

    # Sharpe ratio (annualized, assuming risk-free = 0)
    mean_ret = np.mean(daily_returns)
    std_ret = np.std(daily_returns, ddof=1) if len(daily_returns) > 1 else 1.0
    sharpe = (mean_ret / std_ret) * math.sqrt(252) if std_ret > 0 else 0.0

    # Sortino ratio (downside deviation only)
    downside = daily_returns[daily_returns < 0]
    downside_std = np.std(downside, ddof=1) if len(downside) > 1 else 1.0
    sortino = (mean_ret / downside_std) * math.sqrt(252) if downside_std > 0 else 0.0

    # Max drawdown
    peak = np.maximum.accumulate(equities)
    drawdown = (equities - peak) / peak
    max_drawdown = float(np.min(drawdown))

    # Trade stats
    sells = [t for t in sim.trade_log if t.side == "SELL"]
    wins = [t for t in sells if t.pnl > 0]
    losses = [t for t in sells if t.pnl <= 0]
    win_rate = len(wins) / len(sells) if sells else 0.0

    gross_profit = sum(t.pnl for t in wins)
    gross_loss = abs(sum(t.pnl for t in losses))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else float("inf")

    metrics = {
        "total_return": f"{total_return:.2%}",
        "annualized_return": f"{total_return * annual_factor:.2%}",
        "sharpe_ratio": round(sharpe, 3),
        "sortino_ratio": round(sortino, 3),
        "max_drawdown": f"{max_drawdown:.2%}",
        "total_trades": len(sim.trade_log),
        "buy_trades": sum(1 for t in sim.trade_log if t.side == "BUY"),
        "sell_trades": len(sells),
        "win_rate": f"{win_rate:.1%}",
        "profit_factor": round(profit_factor, 2),
        "realized_pnl": f"${sim.realized_pnl:,.2f}",
        "final_equity": f"${equities[-1]:,.2f}",
        "starting_cash": f"${sim.starting_cash:,.2f}",
        "trading_days": trading_days,
    }

    if benchmark_returns is not None and len(benchmark_returns) > 0:
        bench_total = float(np.prod(1 + benchmark_returns) - 1)
        metrics["benchmark_return"] = f"{bench_total:.2%}"
        metrics["alpha"] = f"{total_return - bench_total:.2%}"

    return metrics


# ─── Backtest loop ───────────────────────────────────────────────────────────

async def run_backtest(
    symbols: list[str] | None = None,
    days: int = 365,
    starting_cash: float = 100_000.0,
    slippage_pct: float = 0.0005,
    train_split: float = 0.7,
) -> dict:
    symbols = symbols or config.WATCHLIST
    seq_len = config.MODEL_SEQUENCE_LENGTH
    feature_cols = MarketDataService.FEATURE_COLUMNS

    logger.info("Fetching historical data for %s (%d days)...", symbols, days)
    market = MarketDataService()

    # Fetch and prepare data per symbol
    symbol_data: dict[str, pd.DataFrame] = {}
    for sym in symbols:
        df = market.get_features(sym, days=days)
        if df.empty or len(df) < seq_len + 10:
            logger.warning("Skipping %s — insufficient data (%d rows)", sym, len(df))
            continue
        symbol_data[sym] = df

    if not symbol_data:
        logger.error("No symbols had enough data. Aborting.")
        return {"error": "No data"}

    # Determine common date range across all symbols
    all_dates = None
    for df in symbol_data.values():
        dates = set(df.index)
        all_dates = dates if all_dates is None else all_dates & dates
    common_dates = sorted(all_dates)

    if len(common_dates) < seq_len + 10:
        logger.error("Only %d common trading days. Need at least %d.", len(common_dates), seq_len + 10)
        return {"error": "Not enough common dates"}

    # Split: train portion used only for model training, backtest on the rest
    split_idx = int(len(common_dates) * train_split)
    backtest_dates = common_dates[split_idx:]

    if len(backtest_dates) < seq_len + 2:
        logger.error("Not enough dates in test split (%d).", len(backtest_dates))
        return {"error": "Test split too small"}

    logger.info(
        "Data: %d total days, %d train, %d backtest (from %s to %s)",
        len(common_dates), split_idx, len(backtest_dates),
        backtest_dates[0], backtest_dates[-1],
    )

    # Load model
    model = LSTMForecaster(num_features=config.MODEL_FEATURE_COUNT)
    ckpt_dir = Path(config.MODEL_CHECKPOINT_DIR)
    ckpts = sorted(ckpt_dir.glob("*.pt")) if ckpt_dir.exists() else []
    if ckpts:
        model.load_checkpoint(ckpts[-1])
        logger.info("Loaded checkpoint: %s", ckpts[-1])
    else:
        logger.warning("No checkpoint found — using random weights")

    # Initialize simulated portfolio and agents
    sim = SimulatedPortfolio(starting_cash=starting_cash, slippage_pct=slippage_pct)
    risk_agent = RiskAgent(portfolio=sim, market=sim)
    exec_agent = ExecutionAgent(portfolio=sim)

    # Benchmark: buy-and-hold first symbol
    benchmark_sym = symbols[0]
    bench_df = symbol_data.get(benchmark_sym)
    bench_returns = None
    if bench_df is not None:
        bench_closes = bench_df.loc[bench_df.index.isin(backtest_dates), "close"].values
        if len(bench_closes) > 1:
            bench_returns = np.diff(bench_closes) / bench_closes[:-1]

    # ── Day-by-day backtest ──────────────────────────────────────────────

    logger.info("Running backtest...")
    for day_i in range(seq_len, len(backtest_dates) - 1):
        current_date = backtest_dates[day_i]
        next_date = backtest_dates[day_i + 1]

        # Update prices to current day's close
        day_prices = {}
        for sym, df in symbol_data.items():
            if current_date in df.index:
                day_prices[sym] = float(df.loc[current_date, "close"])
        sim.update_prices(day_prices, timestamp=current_date)

        # Generate signals for each symbol
        signals: list[TradeSignal] = []
        for sym, df in symbol_data.items():
            # Get the window ending at current_date (no future data leakage)
            mask = df.index <= current_date
            available_df = df.loc[mask]

            if len(available_df) < seq_len:
                continue

            avail_cols = [c for c in feature_cols if c in available_df.columns]
            window = available_df[avail_cols].tail(seq_len).values

            # Normalize
            mins = window.min(axis=0)
            maxs = window.max(axis=0)
            ranges = maxs - mins
            ranges[ranges == 0] = 1
            normalized = (window - mins) / ranges

            tensor = torch.tensor(normalized, dtype=torch.float32)
            prediction = model.predict(tensor)

            direction = SignalDirection(prediction["direction"])
            signals.append(TradeSignal(
                symbol=sym,
                direction=direction,
                confidence=prediction["confidence"],
                predicted_move=prediction["predicted_move"],
                model_name="lstm_forecaster",
                features_used=avail_cols,
                timestamp=current_date if isinstance(current_date, datetime) else datetime.utcnow(),
            ))

        if not signals:
            sim.new_day()
            continue

        # Risk assessment
        risk_result = await risk_agent.process({"signals": signals})
        assessments = risk_result.get("assessments", [])

        # Before execution, update prices to next-day open for realistic fills
        next_prices = {}
        for sym, df in symbol_data.items():
            if next_date in df.index:
                next_prices[sym] = float(df.loc[next_date, "open"])
        if next_prices:
            sim.update_prices(next_prices, timestamp=next_date)

        # Execute
        exec_result = await exec_agent.process({"assessments": assessments})

        sim.new_day()

    # Final price update
    last_date = backtest_dates[-1]
    final_prices = {}
    for sym, df in symbol_data.items():
        if last_date in df.index:
            final_prices[sym] = float(df.loc[last_date, "close"])
    sim.update_prices(final_prices, timestamp=last_date)

    # ── Compute and print metrics ────────────────────────────────────────

    metrics = compute_metrics(sim, bench_returns)

    print("\n" + "=" * 60)
    print("  BACKTEST RESULTS")
    print("=" * 60)
    print(f"  Period:        {backtest_dates[0]} → {backtest_dates[-1]}")
    print(f"  Symbols:       {', '.join(symbol_data.keys())}")
    print("-" * 60)
    for key, val in metrics.items():
        label = key.replace("_", " ").title()
        print(f"  {label:<22s} {val}")
    print("=" * 60)

    # Print trade log summary
    if sim.trade_log:
        print(f"\n  Last 10 trades:")
        print(f"  {'Date':<22s} {'Symbol':<8s} {'Side':<6s} {'Qty':<8s} {'Price':<12s} {'P&L':<12s}")
        print("  " + "-" * 68)
        for t in sim.trade_log[-10:]:
            ts = t.timestamp.strftime("%Y-%m-%d") if isinstance(t.timestamp, datetime) else str(t.timestamp)[:10]
            pnl_str = f"${t.pnl:,.2f}" if t.side == "SELL" else ""
            print(f"  {ts:<22s} {t.symbol:<8s} {t.side:<6s} {t.qty:<8.0f} ${t.price:<11,.2f} {pnl_str}")
        print()

    return {
        "metrics": metrics,
        "equity_curve": sim.equity_curve,
        "trade_log": [
            {"timestamp": str(t.timestamp), "symbol": t.symbol, "side": t.side,
             "qty": t.qty, "price": t.price, "pnl": t.pnl}
            for t in sim.trade_log
        ],
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backtest the trading bot agent pipeline")
    parser.add_argument("--days", type=int, default=365, help="Days of historical data to fetch")
    parser.add_argument("--cash", type=float, default=100_000, help="Starting cash")
    parser.add_argument("--slippage", type=float, default=0.0005, help="Slippage per trade (0.05%%)")
    parser.add_argument("--train-split", type=float, default=0.7, help="Fraction of data for training (rest for backtest)")
    parser.add_argument("--symbols", type=str, default=None, help="Comma-separated symbols (default: config watchlist)")
    args = parser.parse_args()

    symbols = args.symbols.split(",") if args.symbols else None
    asyncio.run(run_backtest(
        symbols=symbols,
        days=args.days,
        starting_cash=args.cash,
        slippage_pct=args.slippage,
        train_split=args.train_split,
    ))
