import os
from dotenv import load_dotenv

load_dotenv()

# --- Alpaca ---
ALPACA_API_KEY = os.getenv("ALPACA_API_KEY", "")
ALPACA_SECRET_KEY = os.getenv("ALPACA_SECRET_KEY", "")
ALPACA_PAPER = os.getenv("ALPACA_PAPER", "true").lower() == "true"

# --- Bot Strategy ---
WATCHLIST = os.getenv("BOT_WATCHLIST", "AAPL,MSFT,GOOGL,AMZN,TSLA").split(",")
STRATEGY_INTERVAL_MINUTES = int(os.getenv("BOT_INTERVAL_MINUTES", "5"))

# --- Risk Parameters ---
MAX_POSITION_PCT = float(os.getenv("BOT_MAX_POSITION_PCT", "0.05"))       # 5% of portfolio per position
MAX_TOTAL_EXPOSURE = float(os.getenv("BOT_MAX_TOTAL_EXPOSURE", "0.70"))    # 70% max deployed
DAILY_LOSS_LIMIT = float(os.getenv("BOT_DAILY_LOSS_LIMIT", "0.02"))        # 2% max drawdown before halt
MIN_CONFIDENCE = float(os.getenv("BOT_MIN_CONFIDENCE", "0.65"))            # min model confidence to act

# --- PyTorch Model ---
MODEL_CHECKPOINT_DIR = os.getenv("BOT_CHECKPOINT_DIR", "training/checkpoints")
MODEL_LOOKBACK_DAYS = int(os.getenv("BOT_LOOKBACK_DAYS", "60"))
MODEL_SEQUENCE_LENGTH = int(os.getenv("BOT_SEQUENCE_LENGTH", "30"))
MODEL_FEATURE_COUNT = int(os.getenv("BOT_FEATURE_COUNT", "10"))
MODEL_ARCH = os.getenv("BOT_MODEL_ARCH", "tft").lower()

# TFT defaults
TFT_HIDDEN_SIZE = int(os.getenv("BOT_TFT_HIDDEN_SIZE", "128"))
TFT_NUM_HEADS = int(os.getenv("BOT_TFT_NUM_HEADS", "4"))
TFT_NUM_LAYERS = int(os.getenv("BOT_TFT_NUM_LAYERS", "2"))
TFT_DROPOUT = float(os.getenv("BOT_TFT_DROPOUT", "0.2"))

# Training defaults
TRAIN_LABEL_THRESHOLD = float(os.getenv("BOT_LABEL_THRESHOLD", "0.005"))
OPTUNA_STORAGE = os.getenv("BOT_OPTUNA_STORAGE", "sqlite:///training/optuna_study.db")

# --- Health Server ---
HEALTH_PORT = int(os.getenv("BOT_HEALTH_PORT", "8080"))

# --- Data ---
MARKET_DATA_TIMEFRAME = os.getenv("BOT_TIMEFRAME", "1Day")
