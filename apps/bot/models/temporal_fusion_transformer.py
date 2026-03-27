import torch
import torch.nn as nn

from models.base_model import BaseStrategyModel


class GatedResidualNetwork(nn.Module):
    """Lightweight GRN block used in TFT-style architectures."""

    def __init__(self, in_dim: int, hidden_dim: int, dropout: float):
        super().__init__()
        self.fc1 = nn.Linear(in_dim, hidden_dim)
        self.elu = nn.ELU()
        self.fc2 = nn.Linear(hidden_dim, in_dim)
        self.dropout = nn.Dropout(dropout)
        self.gate = nn.Sequential(nn.Linear(in_dim, in_dim), nn.Sigmoid())
        self.norm = nn.LayerNorm(in_dim)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        residual = x
        out = self.fc1(x)
        out = self.elu(out)
        out = self.fc2(out)
        out = self.dropout(out)
        gated = self.gate(out)
        return self.norm(residual + gated * out)


class TemporalFusionTransformer(BaseStrategyModel):
    """TFT-style forecaster for directional classification.

    Input shape:  (batch, sequence_length, num_features)
    Output shape: (batch, 3) logits for [down, hold, up]
    """

    def __init__(
        self,
        num_features: int = 10,
        hidden_size: int = 128,
        num_heads: int = 4,
        num_layers: int = 2,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.num_features = num_features

        self.input_proj = nn.Linear(num_features, hidden_size)
        self.variable_grn = GatedResidualNetwork(hidden_size, hidden_size, dropout)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=hidden_size,
            nhead=num_heads,
            dim_feedforward=hidden_size * 4,
            dropout=dropout,
            batch_first=True,
            activation="gelu",
            norm_first=True,
        )
        self.temporal_encoder = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)

        self.post_grn = GatedResidualNetwork(hidden_size, hidden_size, dropout)
        self.head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, 3),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x: (batch, seq_len, features)
        h = self.input_proj(x)
        h = self.variable_grn(h)
        h = self.temporal_encoder(h)
        h = self.post_grn(h)
        logits = self.head(h[:, -1, :])
        return logits

    @torch.no_grad()
    def predict(self, x: torch.Tensor) -> dict:
        self.eval()
        if x.dim() == 2:
            x = x.unsqueeze(0)

        logits = self.forward(x)
        probs = torch.softmax(logits, dim=-1).squeeze(0)

        direction_idx = torch.argmax(probs).item()
        direction_map = {0: "sell", 1: "hold", 2: "buy"}
        predicted_move = (probs[2].item() - probs[0].item()) * 100

        return {
            "direction": direction_map[direction_idx],
            "confidence": probs[direction_idx].item(),
            "predicted_move": predicted_move,
            "probabilities": {
                "down": probs[0].item(),
                "hold": probs[1].item(),
                "up": probs[2].item(),
            },
        }
