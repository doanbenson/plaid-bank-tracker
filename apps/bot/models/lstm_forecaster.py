import torch
import torch.nn as nn
from models.base_model import BaseStrategyModel


class LSTMForecaster(BaseStrategyModel):
    """LSTM-based price direction forecaster.

    Input shape:  (batch, sequence_length, num_features)
    Output shape: (batch, 3)  — logits for [down, hold, up]
    """

    def __init__(
        self,
        num_features: int = 10,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.3,
    ):
        super().__init__()
        self.num_features = num_features
        self.hidden_size = hidden_size

        self.lstm = nn.LSTM(
            input_size=num_features,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.norm = nn.LayerNorm(hidden_size)
        self.head = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 3),  # down, hold, up
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, features)
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]  # take last timestep
        normed = self.norm(last_hidden)
        logits = self.head(normed)
        return logits

    @torch.no_grad()
    def predict(self, x: torch.Tensor) -> dict:
        self.eval()
        if x.dim() == 2:
            x = x.unsqueeze(0)  # add batch dim

        logits = self.forward(x)
        probs = torch.softmax(logits, dim=-1).squeeze(0)

        # Classes: 0=down, 1=hold, 2=up
        direction_idx = torch.argmax(probs).item()
        confidence = probs[direction_idx].item()
        direction_map = {0: "sell", 1: "hold", 2: "buy"}

        # Approximate predicted move from probability distribution
        predicted_move = (probs[2].item() - probs[0].item()) * 100  # rough % estimate

        return {
            "direction": direction_map[direction_idx],
            "confidence": confidence,
            "predicted_move": predicted_move,
            "probabilities": {
                "down": probs[0].item(),
                "hold": probs[1].item(),
                "up": probs[2].item(),
            },
        }
