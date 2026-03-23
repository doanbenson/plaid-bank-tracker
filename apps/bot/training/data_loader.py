"""Data loading and preprocessing for training the LSTM forecaster.

Fetches OHLCV from Alpaca, computes features, and creates sliding-window
(X, y) tensors suitable for supervised training.
"""

import numpy as np
import torch
from torch.utils.data import Dataset

from services.market_data import MarketDataService, compute_features
import config


class StockDataset(Dataset):
    """PyTorch dataset that yields (feature_window, label) pairs.

    Labels:
        0 = price went down by > 0.5%
        1 = price was flat (within +/- 0.5%)
        2 = price went up by > 0.5%
    """

    THRESHOLD = 0.005  # 0.5%

    def __init__(self, features: np.ndarray, closes: np.ndarray, seq_len: int):
        self.seq_len = seq_len
        self.features = features
        self.labels = self._make_labels(closes)

        # Trim so features and labels align
        n = len(self.features) - seq_len
        self.length = min(n, len(self.labels) - seq_len)

    def _make_labels(self, closes: np.ndarray) -> np.ndarray:
        """Convert close prices into directional labels (0/1/2)."""
        pct = np.diff(closes) / closes[:-1]
        labels = np.ones(len(pct), dtype=np.int64)  # default = hold (1)
        labels[pct < -self.THRESHOLD] = 0  # down
        labels[pct > self.THRESHOLD] = 2   # up
        return labels

    def __len__(self) -> int:
        return max(self.length, 0)

    def __getitem__(self, idx: int):
        x = self.features[idx : idx + self.seq_len]
        y = self.labels[idx + self.seq_len - 1]  # label for the day *after* the window
        return torch.tensor(x, dtype=torch.float32), torch.tensor(y, dtype=torch.long)


def load_dataset(
    symbols: list[str] | None = None,
    days: int = 365,
    seq_len: int | None = None,
) -> StockDataset:
    """Build a combined dataset across multiple symbols."""
    symbols = symbols or config.WATCHLIST
    seq_len = seq_len or config.MODEL_SEQUENCE_LENGTH
    market = MarketDataService()

    all_features = []
    all_closes = []

    for symbol in symbols:
        df = market.get_features(symbol, days=days)
        if df.empty or len(df) < seq_len + 1:
            continue

        feature_cols = [c for c in MarketDataService.FEATURE_COLUMNS if c in df.columns]
        feats = df[feature_cols].values
        closes = df["close"].values

        # Normalize per-column using min-max within this symbol's window
        mins = feats.min(axis=0)
        maxs = feats.max(axis=0)
        ranges = maxs - mins
        ranges[ranges == 0] = 1
        feats = (feats - mins) / ranges

        all_features.append(feats)
        all_closes.append(closes)

    if not all_features:
        raise ValueError("No data loaded for any symbol")

    features = np.concatenate(all_features, axis=0)
    closes = np.concatenate(all_closes, axis=0)

    return StockDataset(features, closes, seq_len)
