"""Offline training script for the LSTM forecaster.

Usage:
    cd apps/bot
    python -m training.train --epochs 50 --days 365
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.lstm_forecaster import LSTMForecaster
from training.data_loader import load_dataset
import config


def train(
    epochs: int = 50,
    batch_size: int = 32,
    lr: float = 1e-3,
    days: int = 365,
    val_split: float = 0.2,
) -> None:
    print(f"Loading data ({days} days, watchlist: {config.WATCHLIST})...")
    dataset = load_dataset(days=days)
    print(f"Dataset size: {len(dataset)} samples")

    if len(dataset) < 10:
        print("Not enough data to train. Exiting.")
        return

    # Train/val split
    val_size = int(len(dataset) * val_split)
    train_size = len(dataset) - val_size
    train_ds, val_ds = random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size)

    model = LSTMForecaster(num_features=config.MODEL_FEATURE_COUNT)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    best_val_loss = float("inf")

    for epoch in range(1, epochs + 1):
        # ---- Train ----
        model.train()
        train_loss = 0.0
        correct = 0
        total = 0

        for x_batch, y_batch in train_loader:
            optimizer.zero_grad()
            logits = model(x_batch)
            loss = criterion(logits, y_batch)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            train_loss += loss.item() * len(y_batch)
            preds = logits.argmax(dim=-1)
            correct += (preds == y_batch).sum().item()
            total += len(y_batch)

        train_loss /= total
        train_acc = correct / total

        # ---- Validate ----
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for x_batch, y_batch in val_loader:
                logits = model(x_batch)
                loss = criterion(logits, y_batch)
                val_loss += loss.item() * len(y_batch)
                preds = logits.argmax(dim=-1)
                val_correct += (preds == y_batch).sum().item()
                val_total += len(y_batch)

        val_loss /= max(val_total, 1)
        val_acc = val_correct / max(val_total, 1)
        scheduler.step(val_loss)

        print(
            f"Epoch {epoch:3d}/{epochs}  "
            f"train_loss={train_loss:.4f}  train_acc={train_acc:.3f}  "
            f"val_loss={val_loss:.4f}  val_acc={val_acc:.3f}"
        )

        # Save best checkpoint
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            ckpt_path = Path(config.MODEL_CHECKPOINT_DIR) / f"lstm_{datetime.now():%Y%m%d_%H%M%S}.pt"
            model.save_checkpoint(ckpt_path)
            print(f"  -> Saved checkpoint: {ckpt_path}")

    print("Training complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train LSTM forecaster")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--days", type=int, default=365)
    args = parser.parse_args()

    train(epochs=args.epochs, batch_size=args.batch_size, lr=args.lr, days=args.days)
