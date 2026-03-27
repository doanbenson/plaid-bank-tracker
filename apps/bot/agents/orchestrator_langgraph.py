"""LangGraph orchestrator for deterministic Strategy -> Risk -> Execution flow.

Execution is conditionally skipped when no assessments are approved.
"""

from __future__ import annotations

import logging
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from agents.execution_agent import ExecutionAgent
from agents.risk_agent import RiskAgent
from agents.strategy_agent import StrategyAgent
from models.signal import PipelineResult, RiskVerdict
import config

logger = logging.getLogger("bot.orchestrator")


class PipelineState(TypedDict, total=False):
    watchlist: list[str]
    signals: list
    assessments: list
    executions: list
    summary_parts: list[str]


class OrchestratorLangGraph:
    """Multi-agent orchestrator using LangGraph state machine."""

    def __init__(self):
        self.strategy = StrategyAgent()
        self.risk = RiskAgent()
        self.execution = ExecutionAgent()
        self._last_result: PipelineResult | None = None
        self._graph = self._build_graph()

    def _build_graph(self):
        graph = StateGraph(PipelineState)

        async def run_strategy(state: PipelineState) -> PipelineState:
            watchlist = state.get("watchlist", config.WATCHLIST)
            result = await self.strategy.process({"watchlist": watchlist})
            signals = result.get("signals", [])
            summary = [f"Strategy generated {len(signals)} signal(s)."]
            return {"signals": signals, "summary_parts": summary}

        async def run_risk(state: PipelineState) -> PipelineState:
            signals = state.get("signals", [])
            result = await self.risk.process({"signals": signals})
            assessments = result.get("assessments", [])
            approved = sum(1 for a in assessments if a.verdict == RiskVerdict.APPROVED)
            summary = state.get("summary_parts", []) + [
                f"Risk assessed {len(assessments)} signal(s), approved {approved}."
            ]
            return {"assessments": assessments, "summary_parts": summary}

        async def run_execution(state: PipelineState) -> PipelineState:
            assessments = state.get("assessments", [])
            result = await self.execution.process({"assessments": assessments})
            executions = result.get("executions", [])
            summary = state.get("summary_parts", []) + [
                f"Execution placed {len(executions)} order(s)."
            ]
            return {"executions": executions, "summary_parts": summary}

        def route_execution(state: PipelineState) -> str:
            assessments = state.get("assessments", [])
            has_approved = any(a.verdict == RiskVerdict.APPROVED for a in assessments)
            return "execution" if has_approved else "skip_execution"

        async def skip_execution(state: PipelineState) -> PipelineState:
            summary = state.get("summary_parts", []) + [
                "Execution skipped because no approved assessments were available."
            ]
            return {"executions": [], "summary_parts": summary}

        graph.add_node("strategy", run_strategy)
        graph.add_node("risk", run_risk)
        graph.add_node("execution", run_execution)
        graph.add_node("skip_execution", skip_execution)

        graph.add_edge(START, "strategy")
        graph.add_edge("strategy", "risk")
        graph.add_conditional_edges(
            "risk",
            route_execution,
            {
                "execution": "execution",
                "skip_execution": "skip_execution",
            },
        )
        graph.add_edge("execution", END)
        graph.add_edge("skip_execution", END)

        return graph.compile()

    async def start(self) -> None:
        logger.info("LangGraph orchestrator initialized")

    async def stop(self) -> None:
        logger.info("LangGraph orchestrator stopped")

    async def run_pipeline(self) -> PipelineResult:
        initial_state: PipelineState = {
            "watchlist": config.WATCHLIST,
            "signals": [],
            "assessments": [],
            "executions": [],
            "summary_parts": [],
        }
        state: PipelineState = await self._graph.ainvoke(initial_state)

        signals = state.get("signals", [])
        assessments = state.get("assessments", [])
        executions = state.get("executions", [])
        summary = " ".join(state.get("summary_parts", []))

        result = PipelineResult(
            signals=signals,
            assessments=assessments,
            executions=executions,
            summary=summary,
        )
        self._last_result = result
        logger.info(
            "Pipeline complete: signals=%d assessments=%d executions=%d",
            len(signals),
            len(assessments),
            len(executions),
        )
        return result

    @property
    def last_result(self) -> PipelineResult | None:
        return self._last_result


Orchestrator = OrchestratorLangGraph
