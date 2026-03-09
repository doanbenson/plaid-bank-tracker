from abc import ABC, abstractmethod
import logging


class BaseAgent(ABC):
    """Base class for all trading agents.

    Each agent implements process() which takes a context dict and returns
    a result dict.  The orchestrator chains agents together.
    """

    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(f"bot.agent.{name}")

    @abstractmethod
    async def process(self, context: dict) -> dict:
        """Run the agent's logic on the given context.

        Args:
            context: Dict containing market data, portfolio state,
                     signals, or whatever the preceding agent produced.

        Returns:
            Dict with the agent's output to be consumed downstream.
        """
        ...
