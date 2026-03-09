"""APScheduler-based scheduler that runs the trading pipeline on an interval
during market hours (9:30 AM – 4:00 PM ET, weekdays).
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from agents.orchestrator import Orchestrator
import config

logger = logging.getLogger("bot.scheduler")

ET = ZoneInfo("America/New_York")


def _is_market_open() -> bool:
    now = datetime.now(ET)
    # Weekday (0=Mon … 4=Fri) and between 9:30–16:00 ET
    if now.weekday() > 4:
        return False
    market_open = now.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= now <= market_close


class BotScheduler:
    def __init__(self, orchestrator: Orchestrator):
        self.orchestrator = orchestrator
        self.scheduler = AsyncIOScheduler(timezone=ET)
        self._running = False

    async def _tick(self) -> None:
        if not _is_market_open():
            logger.debug("Market closed — skipping tick")
            return

        logger.info("Scheduler tick — running trading pipeline")
        try:
            result = await self.orchestrator.run_pipeline()
            logger.info("Pipeline result: %s", result.summary[:200] if result.summary else "No summary")
        except Exception:
            logger.exception("Pipeline tick failed")

    def start(self) -> None:
        self.scheduler.add_job(
            self._tick,
            trigger=IntervalTrigger(minutes=config.STRATEGY_INTERVAL_MINUTES),
            id="trading_pipeline",
            replace_existing=True,
        )
        self.scheduler.start()
        self._running = True
        logger.info(
            "Scheduler started — pipeline every %d minutes during market hours",
            config.STRATEGY_INTERVAL_MINUTES,
        )

    def stop(self) -> None:
        self.scheduler.shutdown(wait=False)
        self._running = False
        logger.info("Scheduler stopped")

    @property
    def is_running(self) -> bool:
        return self._running
