"""Simulated portfolio for backtesting.

Drop-in replacement for PortfolioService — same method signatures,
but all state is tracked in-memory against historical prices.
"""

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class SimPosition:
    symbol: str
    qty: float
    avg_entry: float

    @property
    def cost_basis(self) -> float:
        return self.qty * self.avg_entry


@dataclass
class Trade:
    timestamp: datetime
    symbol: str
    side: str
    qty: float
    price: float
    pnl: float = 0.0  # realized P&L (only set on sells)


class SimulatedPortfolio:
    """In-memory portfolio that tracks cash, positions, and equity over time.

    Implements the same public API as PortfolioService + MarketDataService.get_quote
    so RiskAgent and ExecutionAgent can use it without knowing they're in a backtest.
    """

    def __init__(self, starting_cash: float = 100_000.0, slippage_pct: float = 0.0005):
        self.starting_cash = starting_cash
        self.cash = starting_cash
        self.slippage_pct = slippage_pct
        self.positions: dict[str, SimPosition] = {}
        self.trade_log: list[Trade] = []
        self.equity_curve: list[dict] = []
        self._current_prices: dict[str, float] = {}
        self._prev_equity: float = starting_cash

    # ─── Price feed (called by backtester each step) ─────────────────────

    def update_prices(self, prices: dict[str, float], timestamp: datetime | None = None) -> None:
        """Update current market prices and record equity snapshot."""
        self._current_prices.update(prices)
        equity = self._compute_equity()
        self.equity_curve.append({
            "timestamp": timestamp,
            "equity": equity,
            "cash": self.cash,
            "long_value": self._long_market_value(),
        })

    def new_day(self) -> None:
        """Mark end-of-day so daily P&L tracking resets."""
        self._prev_equity = self._compute_equity()

    # ─── PortfolioService-compatible interface ───────────────────────────

    def get_account(self) -> dict:
        equity = self._compute_equity()
        return {
            "equity": equity,
            "cash": self.cash,
            "buying_power": self.cash,
            "portfolio_value": equity,
            "last_equity": self._prev_equity,
            "long_market_value": self._long_market_value(),
        }

    def get_positions(self) -> list[dict]:
        result = []
        for sym, pos in self.positions.items():
            price = self._current_prices.get(sym, pos.avg_entry)
            mv = pos.qty * price
            upl = mv - pos.cost_basis
            result.append({
                "symbol": sym,
                "qty": pos.qty,
                "avg_entry": pos.avg_entry,
                "current_price": price,
                "market_value": mv,
                "unrealized_pl": upl,
                "unrealized_plpc": upl / pos.cost_basis if pos.cost_basis else 0,
            })
        return result

    def get_position(self, symbol: str) -> dict | None:
        pos = self.positions.get(symbol)
        if not pos:
            return None
        price = self._current_prices.get(symbol, pos.avg_entry)
        mv = pos.qty * price
        return {
            "symbol": symbol,
            "qty": pos.qty,
            "avg_entry": pos.avg_entry,
            "current_price": price,
            "market_value": mv,
            "unrealized_pl": mv - pos.cost_basis,
        }

    def get_quote(self, symbol: str) -> dict | None:
        """Simulate a quote from current prices."""
        price = self._current_prices.get(symbol)
        if price is None:
            return None
        return {
            "symbol": symbol,
            "ask": price * (1 + self.slippage_pct),
            "bid": price * (1 - self.slippage_pct),
            "mid": price,
            "timestamp": "",
        }

    def place_market_order(self, symbol: str, qty: float, side: str) -> dict:
        price = self._current_prices.get(symbol)
        if price is None:
            raise ValueError(f"No price available for {symbol}")

        if side.upper() == "BUY":
            fill_price = price * (1 + self.slippage_pct)
        else:
            fill_price = price * (1 - self.slippage_pct)

        return self._fill(symbol, qty, side.upper(), fill_price)

    def close_position(self, symbol: str) -> dict:
        pos = self.positions.get(symbol)
        if not pos:
            return {"status": "no_position", "symbol": symbol}
        price = self._current_prices.get(symbol, pos.avg_entry)
        return self._fill(symbol, pos.qty, "SELL", price * (1 - self.slippage_pct))

    def get_orders(self, status: str = "all") -> list[dict]:
        return []

    # ─── Execution engine ────────────────────────────────────────────────

    def _fill(self, symbol: str, qty: float, side: str, fill_price: float) -> dict:
        timestamp = None
        if self.equity_curve:
            timestamp = self.equity_curve[-1].get("timestamp")

        pnl = 0.0

        if side == "BUY":
            cost = qty * fill_price
            if cost > self.cash:
                raise ValueError(f"Insufficient cash: need ${cost:.2f}, have ${self.cash:.2f}")
            self.cash -= cost

            if symbol in self.positions:
                old = self.positions[symbol]
                total_qty = old.qty + qty
                new_avg = (old.cost_basis + cost) / total_qty
                self.positions[symbol] = SimPosition(symbol, total_qty, new_avg)
            else:
                self.positions[symbol] = SimPosition(symbol, qty, fill_price)

        elif side == "SELL":
            pos = self.positions.get(symbol)
            if not pos or pos.qty < qty:
                raise ValueError(f"Cannot sell {qty} of {symbol} (hold {pos.qty if pos else 0})")

            proceeds = qty * fill_price
            pnl = (fill_price - pos.avg_entry) * qty
            self.cash += proceeds

            remaining = pos.qty - qty
            if remaining < 0.0001:
                del self.positions[symbol]
            else:
                self.positions[symbol] = SimPosition(symbol, remaining, pos.avg_entry)

        trade = Trade(
            timestamp=timestamp or datetime.utcnow(),
            symbol=symbol,
            side=side,
            qty=qty,
            price=fill_price,
            pnl=pnl,
        )
        self.trade_log.append(trade)

        return {
            "id": f"sim-{len(self.trade_log)}",
            "symbol": symbol,
            "qty": qty,
            "filled_qty": qty,
            "side": side.lower(),
            "type": "market",
            "status": "filled",
            "filled_avg_price": fill_price,
            "created_at": (timestamp or datetime.utcnow()).isoformat(),
        }

    # ─── Helpers ─────────────────────────────────────────────────────────

    def _long_market_value(self) -> float:
        return sum(
            p.qty * self._current_prices.get(p.symbol, p.avg_entry)
            for p in self.positions.values()
        )

    def _compute_equity(self) -> float:
        return self.cash + self._long_market_value()

    @property
    def total_return_pct(self) -> float:
        equity = self._compute_equity()
        return (equity - self.starting_cash) / self.starting_cash * 100

    @property
    def realized_pnl(self) -> float:
        return sum(t.pnl for t in self.trade_log if t.side == "SELL")
