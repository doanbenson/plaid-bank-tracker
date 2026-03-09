import numpy as np
import pandas as pd
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest, StockLatestQuoteRequest
from alpaca.data.timeframe import TimeFrame
from datetime import datetime, timedelta

import config


# ---- Technical indicator helpers ----

def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def compute_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add technical indicator columns to an OHLCV dataframe.

    Expects columns: open, high, low, close, volume.
    Returns df with added feature columns (NaN rows at the start are dropped).
    """
    c = df["close"]

    # RSI (14)
    delta = c.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.rolling(14).mean()
    avg_loss = loss.rolling(14).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))

    # MACD
    df["macd"] = _ema(c, 12) - _ema(c, 26)
    df["macd_signal"] = _ema(df["macd"], 9)

    # Bollinger Bands
    sma20 = c.rolling(20).mean()
    std20 = c.rolling(20).std()
    df["bb_upper"] = sma20 + 2 * std20
    df["bb_lower"] = sma20 - 2 * std20
    df["bb_pct"] = (c - df["bb_lower"]) / (df["bb_upper"] - df["bb_lower"])

    # Volume ratio (current / 20-day avg)
    df["vol_ratio"] = df["volume"] / df["volume"].rolling(20).mean()

    # Price rate of change (5-day)
    df["roc_5"] = c.pct_change(5) * 100

    df.dropna(inplace=True)
    return df


class MarketDataService:
    FEATURE_COLUMNS = [
        "open", "high", "low", "close", "volume",
        "rsi", "macd", "macd_signal", "bb_pct", "vol_ratio",
    ]

    def __init__(self):
        self.client = StockHistoricalDataClient(
            config.ALPACA_API_KEY,
            config.ALPACA_SECRET_KEY,
        )

    def get_bars(self, symbol: str, days: int | None = None) -> pd.DataFrame:
        days = days or config.MODEL_LOOKBACK_DAYS
        tf_map = {
            "1Min": TimeFrame.Minute,
            "1Hour": TimeFrame.Hour,
            "1Day": TimeFrame.Day,
        }
        tf = tf_map.get(config.MARKET_DATA_TIMEFRAME, TimeFrame.Day)

        bars = self.client.get_stock_bars(
            StockBarsRequest(
                symbol_or_symbols=symbol,
                timeframe=tf,
                start=datetime.now() - timedelta(days=days),
            )
        )

        rows = []
        if symbol in bars.data:
            for bar in bars.data[symbol]:
                rows.append({
                    "timestamp": bar.timestamp,
                    "open": float(bar.open),
                    "high": float(bar.high),
                    "low": float(bar.low),
                    "close": float(bar.close),
                    "volume": int(bar.volume),
                })

        df = pd.DataFrame(rows)
        if not df.empty:
            df.set_index("timestamp", inplace=True)
        return df

    def get_features(self, symbol: str, days: int | None = None) -> pd.DataFrame:
        """Fetch OHLCV and compute technical indicators."""
        df = self.get_bars(symbol, days)
        if df.empty:
            return df
        return compute_features(df)

    def get_quote(self, symbol: str) -> dict | None:
        quotes = self.client.get_stock_latest_quote(
            StockLatestQuoteRequest(symbol_or_symbols=symbol)
        )
        if symbol in quotes:
            q = quotes[symbol]
            return {
                "symbol": symbol,
                "ask": float(q.ask_price),
                "bid": float(q.bid_price),
                "mid": (float(q.ask_price) + float(q.bid_price)) / 2,
                "timestamp": q.timestamp.isoformat(),
            }
        return None
