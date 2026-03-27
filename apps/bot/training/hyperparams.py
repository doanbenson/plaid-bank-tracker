from dataclasses import dataclass

import config


@dataclass
class HyperparamsConfig:
    model_arch: str = "tft"
    epochs: int = 50
    batch_size: int = 32
    lr: float = 1e-3
    days: int = 365
    val_split: float = 0.2
    grad_clip: float = 1.0
    scheduler_patience: int = 5
    label_threshold: float = config.TRAIN_LABEL_THRESHOLD

    # Shared model params
    num_features: int = config.MODEL_FEATURE_COUNT

    # TFT
    tft_hidden_size: int = config.TFT_HIDDEN_SIZE
    tft_num_heads: int = config.TFT_NUM_HEADS
    tft_num_layers: int = config.TFT_NUM_LAYERS
    tft_dropout: float = config.TFT_DROPOUT
