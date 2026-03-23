import torch
import numpy as np
from pathlib import Path

from agents.base_agent import BaseAgent
from models.signal import TradeSignal, SignalDirection
from models.lstm_forecaster import LSTMForecaster
from services.market_data import MarketDataService
import config


class StrategyAgent(BaseAgent):
    """Runs the PyTorch model against market data to produce TradeSignals."""

    def __init__(self):
        super().__init__("strategy")
        self.market = MarketDataService()
        self.model = LSTMForecaster(
            num_features=config.MODEL_FEATURE_COUNT,
        )
        self._load_model()

    def _load_model(self) -> None:
        """Try to load the latest checkpoint. If none exists, model stays random (paper-safe)."""
        ckpt_dir = Path(config.MODEL_CHECKPOINT_DIR)
        ckpts = sorted(ckpt_dir.glob("*.pt")) if ckpt_dir.exists() else []
        if ckpts:
            latest = ckpts[-1]
            self.logger.info("Loading checkpoint %s", latest)
            self.model.load_checkpoint(latest)
        else:
            self.logger.warning("No checkpoint found — model will use random weights")

    async def process(self, context: dict) -> dict:
        """Generate trade signals for every symbol in the watchlist.

        context keys used:
            watchlist: list[str]
        Returns:
            signals: list[TradeSignal]
        """
        watchlist = context.get("watchlist", config.WATCHLIST)
        signals: list[TradeSignal] = []

        for symbol in watchlist:
            signal = self._analyze_symbol(symbol)
            if signal:
                signals.append(signal)

        self.logger.info("Generated %d signals from %d symbols", len(signals), len(watchlist))
        return {"signals": signals}

    def _analyze_symbol(self, symbol: str) -> TradeSignal | None:
        """Fetch features and run model inference for one symbol."""
        try:
            df = self.market.get_features(symbol)
            if df.empty or len(df) < config.MODEL_SEQUENCE_LENGTH:
                self.logger.debug("Insufficient data for %s (%d rows)", symbol, len(df))
                return None

            # Take the last MODEL_SEQUENCE_LENGTH rows, select feature columns
            feature_cols = MarketDataService.FEATURE_COLUMNS
            available = [c for c in feature_cols if c in df.columns]
            window = df[available].tail(config.MODEL_SEQUENCE_LENGTH).values

            # Normalize per-feature to [0,1] for the window
            mins = window.min(axis=0)
            maxs = window.max(axis=0)
            ranges = maxs - mins
            ranges[ranges == 0] = 1
            normalized = (window - mins) / ranges

            tensor = torch.tensor(normalized, dtype=torch.float32)
            prediction = self.model.predict(tensor)

            direction = SignalDirection(prediction["direction"])
            return TradeSignal(
                symbol=symbol,
                direction=direction,
                confidence=prediction["confidence"],
                predicted_move=prediction["predicted_move"],
                model_name="lstm_forecaster",
                features_used=available,
            )

        except Exception as e:
            self.logger.error("Error analyzing %s: %s", symbol, e)
            return None
