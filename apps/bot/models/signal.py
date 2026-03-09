from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional


class SignalDirection(Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class RiskVerdict(Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    ADJUSTED = "adjusted"


class OrderStatus(Enum):
    PENDING = "pending"
    FILLED = "filled"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class TradeSignal:
    symbol: str
    direction: SignalDirection
    confidence: float
    predicted_move: float  # predicted % price change
    model_name: str
    features_used: list[str] = field(default_factory=list)
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "direction": self.direction.value,
            "confidence": self.confidence,
            "predicted_move": self.predicted_move,
            "model_name": self.model_name,
            "features_used": self.features_used,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class RiskAssessment:
    signal: TradeSignal
    verdict: RiskVerdict
    approved_qty: float = 0.0
    max_position_value: float = 0.0
    reason: str = ""
    risk_score: float = 0.0  # 0-1, higher = riskier

    def to_dict(self) -> dict:
        return {
            "signal": self.signal.to_dict(),
            "verdict": self.verdict.value,
            "approved_qty": self.approved_qty,
            "max_position_value": self.max_position_value,
            "reason": self.reason,
            "risk_score": self.risk_score,
        }


@dataclass
class OrderResult:
    symbol: str
    side: str
    qty: float
    order_id: Optional[str] = None
    status: OrderStatus = OrderStatus.PENDING
    filled_price: Optional[float] = None
    error: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "side": self.side,
            "qty": self.qty,
            "order_id": self.order_id,
            "status": self.status.value,
            "filled_price": self.filled_price,
            "error": self.error,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class PipelineResult:
    """Result of a full orchestrator pipeline run."""
    signals: list[TradeSignal] = field(default_factory=list)
    assessments: list[RiskAssessment] = field(default_factory=list)
    executions: list[OrderResult] = field(default_factory=list)
    summary: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "signals": [s.to_dict() for s in self.signals],
            "assessments": [a.to_dict() for a in self.assessments],
            "executions": [e.to_dict() for e in self.executions],
            "summary": self.summary,
            "timestamp": self.timestamp.isoformat(),
        }
