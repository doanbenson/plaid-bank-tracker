from abc import ABC, abstractmethod
import torch
import torch.nn as nn
from pathlib import Path


class BaseStrategyModel(ABC, nn.Module):
    """Abstract interface for all PyTorch trading strategy models.

    Subclasses implement the architecture (forward) and the signal
    interpretation (predict).  The orchestrator only calls predict().
    """

    def __init__(self):
        super().__init__()

    @abstractmethod
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Raw forward pass."""
        ...

    @abstractmethod
    def predict(self, x: torch.Tensor) -> dict:
        """Run inference and return structured prediction.

        Returns dict with at minimum:
            direction: "buy" | "sell" | "hold"
            confidence: float 0-1
            predicted_move: float (predicted % change)
        """
        ...

    def save_checkpoint(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(self.state_dict(), path)

    def load_checkpoint(self, path: str | Path, device: str = "cpu") -> None:
        state = torch.load(path, map_location=device, weights_only=True)
        self.load_state_dict(state)
        self.eval()
