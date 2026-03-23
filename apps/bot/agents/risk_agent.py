from agents.base_agent import BaseAgent
from models.signal import TradeSignal, RiskAssessment, RiskVerdict, SignalDirection
from services.portfolio import PortfolioService
from services.market_data import MarketDataService
import config


class RiskAgent(BaseAgent):
    """Evaluates trade signals against risk rules and portfolio state.

    Rules checked:
        1. Confidence threshold
        2. Per-position size limit (% of portfolio)
        3. Total exposure limit
        4. Daily loss limit (drawdown halt)
    """

    def __init__(self, portfolio=None, market=None):
        super().__init__("risk")
        self.portfolio = portfolio or PortfolioService()
        self.market = market or MarketDataService()

    async def process(self, context: dict) -> dict:
        """Filter and size incoming signals.

        context keys used:
            signals: list[TradeSignal]
        Returns:
            assessments: list[RiskAssessment]
        """
        signals: list[TradeSignal] = context.get("signals", [])
        account = self.portfolio.get_account()
        positions = self.portfolio.get_positions()
        assessments: list[RiskAssessment] = []

        # Check daily loss limit first — if breached, reject everything
        daily_pnl_pct = (account["equity"] - account["last_equity"]) / account["last_equity"]
        if daily_pnl_pct <= -config.DAILY_LOSS_LIMIT:
            self.logger.warning(
                "Daily loss limit hit (%.2f%%). Halting all signals.", daily_pnl_pct * 100
            )
            for sig in signals:
                assessments.append(RiskAssessment(
                    signal=sig,
                    verdict=RiskVerdict.REJECTED,
                    reason=f"Daily loss limit breached ({daily_pnl_pct:.2%})",
                    risk_score=1.0,
                ))
            return {"assessments": assessments}

        total_exposure = account["long_market_value"] / account["equity"] if account["equity"] else 0
        held_symbols = {p["symbol"] for p in positions}

        for sig in signals:
            assessment = self._assess_signal(sig, account, total_exposure, held_symbols)
            assessments.append(assessment)

        approved = sum(1 for a in assessments if a.verdict == RiskVerdict.APPROVED)
        self.logger.info(
            "Risk assessed %d signals: %d approved, %d rejected",
            len(assessments), approved, len(assessments) - approved,
        )
        return {"assessments": assessments}

    def _assess_signal(
        self,
        sig: TradeSignal,
        account: dict,
        total_exposure: float,
        held_symbols: set[str],
    ) -> RiskAssessment:
        equity = account["equity"]

        # Rule 1: confidence threshold
        if sig.confidence < config.MIN_CONFIDENCE:
            return RiskAssessment(
                signal=sig,
                verdict=RiskVerdict.REJECTED,
                reason=f"Confidence {sig.confidence:.2f} below threshold {config.MIN_CONFIDENCE}",
                risk_score=0.3,
            )

        # Rule 2: skip HOLD signals
        if sig.direction == SignalDirection.HOLD:
            return RiskAssessment(
                signal=sig,
                verdict=RiskVerdict.REJECTED,
                reason="Signal is HOLD — no action needed",
                risk_score=0.0,
            )

        # Rule 3: total exposure limit (only for BUY)
        if sig.direction == SignalDirection.BUY and total_exposure >= config.MAX_TOTAL_EXPOSURE:
            return RiskAssessment(
                signal=sig,
                verdict=RiskVerdict.REJECTED,
                reason=f"Total exposure {total_exposure:.2%} >= limit {config.MAX_TOTAL_EXPOSURE:.2%}",
                risk_score=0.8,
            )

        # Rule 4: SELL only if we hold the position
        if sig.direction == SignalDirection.SELL and sig.symbol not in held_symbols:
            return RiskAssessment(
                signal=sig,
                verdict=RiskVerdict.REJECTED,
                reason=f"No position in {sig.symbol} to sell",
                risk_score=0.1,
            )

        # Calculate position size
        max_position_value = equity * config.MAX_POSITION_PCT
        # Use portfolio.get_quote if available (simulated), else market service
        if hasattr(self.portfolio, 'get_quote'):
            quote = self.portfolio.get_quote(sig.symbol)
        else:
            quote = self.market.get_quote(sig.symbol)
        if not quote or quote["mid"] <= 0:
            return RiskAssessment(
                signal=sig,
                verdict=RiskVerdict.REJECTED,
                reason=f"Could not get valid quote for {sig.symbol}",
                risk_score=0.5,
            )

        price = quote["mid"]
        max_qty = int(max_position_value / price)

        if max_qty < 1:
            return RiskAssessment(
                signal=sig,
                verdict=RiskVerdict.REJECTED,
                reason=f"Position size too small (${max_position_value:.0f} / ${price:.2f} < 1 share)",
                risk_score=0.4,
            )

        risk_score = 1.0 - sig.confidence  # simple inverse

        return RiskAssessment(
            signal=sig,
            verdict=RiskVerdict.APPROVED,
            approved_qty=max_qty,
            max_position_value=max_position_value,
            reason="Passed all risk checks",
            risk_score=risk_score,
        )
