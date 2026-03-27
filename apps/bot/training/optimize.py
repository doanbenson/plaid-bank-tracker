"""Optuna hyperparameter optimization for strategy models.

Usage:
    cd apps/bot
    python -m training.optimize --n-trials 25
"""

import argparse
import sys
from pathlib import Path

import optuna

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
from training.hyperparams import HyperparamsConfig
from training.train import train


def _build_trial_config(trial: optuna.Trial, days: int) -> HyperparamsConfig:
    cfg = HyperparamsConfig(
        model_arch="tft",
        epochs=trial.suggest_int("epochs", 10, 60),
        batch_size=trial.suggest_categorical("batch_size", [16, 32, 64]),
        lr=trial.suggest_float("lr", 1e-4, 5e-3, log=True),
        days=days,
        val_split=trial.suggest_float("val_split", 0.1, 0.3),
        grad_clip=trial.suggest_float("grad_clip", 0.5, 2.0),
        scheduler_patience=trial.suggest_int("scheduler_patience", 3, 8),
        label_threshold=trial.suggest_float("label_threshold", 0.002, 0.015),
    )

    cfg.tft_hidden_size = trial.suggest_categorical("tft_hidden_size", [64, 96, 128, 192])
    cfg.tft_num_heads = trial.suggest_categorical("tft_num_heads", [2, 4, 8])
    cfg.tft_num_layers = trial.suggest_int("tft_num_layers", 1, 4)
    cfg.tft_dropout = trial.suggest_float("tft_dropout", 0.1, 0.5)

    return cfg


def optimize(n_trials: int, days: int, study_name: str | None = None) -> None:
    storage = config.OPTUNA_STORAGE
    if storage.startswith("sqlite:///"):
        db_path = storage.replace("sqlite:///", "", 1)
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    study = optuna.create_study(
        study_name=study_name or "tft_optimization",
        storage=storage,
        direction="minimize",
        load_if_exists=True,
    )

    def objective(trial: optuna.Trial) -> float:
        cfg = _build_trial_config(trial, days=days)
        result = train(cfg)
        if result.get("status") != "ok" or result.get("best_val_loss") is None:
            return float("inf")
        return float(result["best_val_loss"])

    study.optimize(objective, n_trials=n_trials)

    print("Optimization complete.")
    print(f"Study: {study.study_name}")
    print(f"Best value (val loss): {study.best_value:.6f}")
    print("Best params:")
    for key, value in study.best_params.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Optimize model hyperparameters with Optuna")
    parser.add_argument("--n-trials", type=int, default=20)
    parser.add_argument("--days", type=int, default=365)
    parser.add_argument("--study-name", type=str, default=None)
    args = parser.parse_args()

    optimize(n_trials=args.n_trials, days=args.days, study_name=args.study_name)
