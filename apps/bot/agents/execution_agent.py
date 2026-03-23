from agents.base_agent import BaseAgent
from models.signal import RiskAssessment, RiskVerdict, OrderResult, OrderStatus, SignalDirection
from services.portfolio import PortfolioService


class ExecutionAgent(BaseAgent):
    """Places orders on Alpaca for risk-approved signals."""

    def __init__(self, portfolio=None):
        super().__init__("execution")
        self.portfolio = portfolio or PortfolioService()

    async def process(self, context: dict) -> dict:
        """Execute approved assessments.

        context keys used:
            assessments: list[RiskAssessment]
        Returns:
            executions: list[OrderResult]
        """
        assessments: list[RiskAssessment] = context.get("assessments", [])
        executions: list[OrderResult] = []

        approved = [a for a in assessments if a.verdict == RiskVerdict.APPROVED]
        self.logger.info("Executing %d approved trades", len(approved))

        for assessment in approved:
            result = self._execute_one(assessment)
            executions.append(result)

        filled = sum(1 for e in executions if e.status == OrderStatus.FILLED)
        failed = sum(1 for e in executions if e.status == OrderStatus.FAILED)
        self.logger.info("Execution complete: %d filled, %d failed", filled, failed)

        return {"executions": executions}

    def _execute_one(self, assessment: RiskAssessment) -> OrderResult:
        sig = assessment.signal
        side = sig.direction.value.upper()

        try:
            if sig.direction == SignalDirection.SELL:
                order = self.portfolio.close_position(sig.symbol)
                return OrderResult(
                    symbol=sig.symbol,
                    side=side,
                    qty=assessment.approved_qty,
                    status=OrderStatus.FILLED,
                )
            else:
                order = self.portfolio.place_market_order(
                    symbol=sig.symbol,
                    qty=assessment.approved_qty,
                    side=side,
                )
                return OrderResult(
                    symbol=sig.symbol,
                    side=side,
                    qty=assessment.approved_qty,
                    order_id=order.get("id"),
                    status=OrderStatus.FILLED if order.get("status") in ("filled", "new", "accepted") else OrderStatus.PENDING,
                    filled_price=order.get("filled_avg_price"),
                )

        except Exception as e:
            self.logger.error("Order failed for %s: %s", sig.symbol, e)
            return OrderResult(
                symbol=sig.symbol,
                side=side,
                qty=assessment.approved_qty,
                status=OrderStatus.FAILED,
                error=str(e),
            )
