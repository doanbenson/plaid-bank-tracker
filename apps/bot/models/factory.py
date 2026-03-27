from models.base_model import BaseStrategyModel
from models.temporal_fusion_transformer import TemporalFusionTransformer
import config


def build_model(model_arch: str | None = None, **overrides) -> BaseStrategyModel:
    """Build a strategy model by architecture name with optional overrides."""
    arch = (model_arch or config.MODEL_ARCH).lower()

    if arch in ("tft", "temporal_fusion_transformer"):
        return TemporalFusionTransformer(
            num_features=overrides.get("num_features", config.MODEL_FEATURE_COUNT),
            hidden_size=overrides.get("hidden_size", config.TFT_HIDDEN_SIZE),
            num_heads=overrides.get("num_heads", config.TFT_NUM_HEADS),
            num_layers=overrides.get("num_layers", config.TFT_NUM_LAYERS),
            dropout=overrides.get("dropout", config.TFT_DROPOUT),
        )

    raise ValueError("Unsupported model architecture. Only 'tft' is supported.")
