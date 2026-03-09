"""Orchestrator — wires Strategy, Risk, and Execution agents together using
the GitHub Copilot SDK.  The LLM acts as the decision-making brain, calling
agent capabilities exposed as Copilot tools.
"""

import asyncio
import json
import logging

from pydantic import BaseModel, Field
from copilot import CopilotClient, define_tool

from agents.strategy_agent import StrategyAgent
from agents.risk_agent import RiskAgent
from agents.execution_agent import ExecutionAgent
from models.signal import PipelineResult, SignalDirection
from services.portfolio import PortfolioService
from services.market_data import MarketDataService
import config

logger = logging.getLogger("bot.orchestrator")


# ─── Pydantic schemas for Copilot tool parameters ───────────────────────────

class AnalyzeMarketParams(BaseModel):
    symbols: list[str] = Field(description="List of stock ticker symbols to analyze (e.g. ['AAPL','MSFT'])")

class RunStrategyParams(BaseModel):
    symbols: list[str] = Field(
        default_factory=list,
        description="Symbols to run the ML model on. Empty = use default watchlist.",
    )

class AssessRiskParams(BaseModel):
    signals_json: str = Field(description="JSON array of trade signals from the strategy agent")

class ExecuteTradesParams(BaseModel):
    assessments_json: str = Field(description="JSON array of risk assessments to execute")

class GetPortfolioParams(BaseModel):
    include_positions: bool = Field(default=True, description="Include open positions in the response")

class GetQuoteParams(BaseModel):
    symbol: str = Field(description="Stock ticker symbol")


# ─── Orchestrator ────────────────────────────────────────────────────────────

class Orchestrator:
    """Multi-agent orchestrator powered by GitHub Copilot SDK.

    Creates a Copilot session with custom tools that map to our trading agents.
    The LLM plans which tools to invoke and coordinates the pipeline:
        1. Analyze market data
        2. Generate strategy signals (PyTorch inference)
        3. Assess risk
        4. Execute approved trades
    """

    SYSTEM_PROMPT = """\
You are an autonomous AI trading bot operating on a paper trading account.
Your job is to analyze the market and execute trades using the available tools.

Follow this process every time you are asked to run the trading pipeline:
1. Call get_portfolio to understand current account state and positions.
2. Call run_strategy with the watchlist symbols to generate ML-based trade signals.
3. If signals exist, call assess_risk with the signals JSON.
4. If any assessments are approved, call execute_trades with the assessments JSON.
5. Summarize what happened: signals generated, risk verdicts, and trades placed.

Rules:
- Never skip the risk assessment step.
- If daily loss limit is breached, report it and do NOT execute any trades.
- Always report your reasoning for each step.
- Be concise in your summaries.
"""

    def __init__(self):
        self.strategy = StrategyAgent()
        self.risk = RiskAgent()
        self.execution = ExecutionAgent()
        self.portfolio_svc = PortfolioService()
        self.market_svc = MarketDataService()
        self.client: CopilotClient | None = None
        self._last_result: PipelineResult | None = None

    # ─── Tool definitions (registered on session creation) ───────────────

    def _build_tools(self) -> list:
        strategy = self.strategy
        risk = self.risk
        execution = self.execution
        portfolio_svc = self.portfolio_svc
        market_svc = self.market_svc

        @define_tool(description="Get current portfolio status: account balance, equity, and open positions.")
        async def get_portfolio(params: GetPortfolioParams) -> str:
            account = portfolio_svc.get_account()
            result = {"account": account}
            if params.include_positions:
                result["positions"] = portfolio_svc.get_positions()
            return json.dumps(result, indent=2)

        @define_tool(description="Get the latest price quote for a stock symbol.")
        async def get_quote(params: GetQuoteParams) -> str:
            quote = market_svc.get_quote(params.symbol)
            return json.dumps(quote or {"error": f"No quote for {params.symbol}"})

        @define_tool(description="Analyze market data (OHLCV + technical indicators) for given symbols.")
        async def analyze_market(params: AnalyzeMarketParams) -> str:
            results = {}
            for sym in params.symbols:
                df = market_svc.get_features(sym, days=config.MODEL_LOOKBACK_DAYS)
                if df.empty:
                    results[sym] = {"error": "No data available"}
                else:
                    latest = df.iloc[-1].to_dict()
                    results[sym] = {
                        "data_points": len(df),
                        "latest": {k: round(v, 4) if isinstance(v, float) else v for k, v in latest.items()},
                    }
            return json.dumps(results, indent=2)

        @define_tool(description="Run the PyTorch ML strategy model to generate trade signals for given symbols.")
        async def run_strategy(params: RunStrategyParams) -> str:
            symbols = params.symbols or config.WATCHLIST
            result = await strategy.process({"watchlist": symbols})
            signals = result.get("signals", [])
            return json.dumps([s.to_dict() for s in signals], indent=2)

        @define_tool(description="Assess risk for trade signals. Takes JSON array of signals, returns risk assessments with approval/rejection verdicts and position sizing.")
        async def assess_risk(params: AssessRiskParams) -> str:
            from models.signal import TradeSignal
            raw_signals = json.loads(params.signals_json)
            signals = [
                TradeSignal(
                    symbol=s["symbol"],
                    direction=SignalDirection(s["direction"]),
                    confidence=s["confidence"],
                    predicted_move=s["predicted_move"],
                    model_name=s.get("model_name", "unknown"),
                )
                for s in raw_signals
            ]
            result = await risk.process({"signals": signals})
            assessments = result.get("assessments", [])
            return json.dumps([a.to_dict() for a in assessments], indent=2)

        @define_tool(description="Execute approved trades. Takes JSON array of risk assessments, places orders for approved ones.")
        async def execute_trades(params: ExecuteTradesParams) -> str:
            from models.signal import TradeSignal, RiskAssessment, RiskVerdict
            raw = json.loads(params.assessments_json)
            assessments = [
                RiskAssessment(
                    signal=TradeSignal(
                        symbol=a["signal"]["symbol"],
                        direction=SignalDirection(a["signal"]["direction"]),
                        confidence=a["signal"]["confidence"],
                        predicted_move=a["signal"]["predicted_move"],
                        model_name=a["signal"].get("model_name", "unknown"),
                    ),
                    verdict=RiskVerdict(a["verdict"]),
                    approved_qty=a.get("approved_qty", 0),
                    max_position_value=a.get("max_position_value", 0),
                    reason=a.get("reason", ""),
                    risk_score=a.get("risk_score", 0),
                )
                for a in raw
            ]
            result = await execution.process({"assessments": assessments})
            executions = result.get("executions", [])
            return json.dumps([e.to_dict() for e in executions], indent=2)

        return [get_portfolio, get_quote, analyze_market, run_strategy, assess_risk, execute_trades]

    # ─── Lifecycle ───────────────────────────────────────────────────────

    async def start(self) -> None:
        self.client = CopilotClient({"log_level": config.COPILOT_LOG_LEVEL})
        await self.client.start()
        logger.info("Copilot SDK client started")

    async def stop(self) -> None:
        if self.client:
            await self.client.stop()
            logger.info("Copilot SDK client stopped")

    async def run_pipeline(self) -> PipelineResult:
        """Run one full trading pipeline cycle via the LLM orchestrator."""
        if not self.client:
            await self.start()

        tools = self._build_tools()
        done = asyncio.Event()
        summary_parts: list[str] = []

        def on_event(event):
            etype = event.type.value if hasattr(event.type, "value") else str(event.type)
            if etype == "assistant.message":
                summary_parts.append(event.data.content)
            elif etype == "session.idle":
                done.set()

        async with await self.client.create_session({
            "model": config.COPILOT_MODEL,
            "tools": tools,
            "system_message": {"content": self.SYSTEM_PROMPT},
        }) as session:
            session.on(on_event)

            watchlist_str = ", ".join(config.WATCHLIST)
            await session.send({
                "prompt": f"Run the trading pipeline now for watchlist: [{watchlist_str}]. Analyze, assess risk, and execute any approved trades."
            })
            await done.wait()

        summary = "\n".join(summary_parts)
        logger.info("Pipeline complete. Summary: %s", summary[:200])

        result = PipelineResult(summary=summary)
        self._last_result = result
        return result

    @property
    def last_result(self) -> PipelineResult | None:
        return self._last_result
