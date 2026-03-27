"""Entry point for the AI trading bot worker.

Starts:
    1. A lightweight health-check HTTP server (for Docker/web app polling)
    2. The LangGraph orchestrator
    3. The APScheduler loop that triggers the pipeline on interval
"""

import asyncio
import logging
import sys
from pathlib import Path
from aiohttp import web

# Ensure project root on path so `import config` etc. work
sys.path.insert(0, str(Path(__file__).resolve().parent))

import config
from agents.orchestrator_langgraph import Orchestrator
from services.scheduler import BotScheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("bot")


# ─── Health / status API ─────────────────────────────────────────────────────

orchestrator: Orchestrator | None = None
scheduler: BotScheduler | None = None


async def handle_health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok", "running": scheduler.is_running if scheduler else False})


async def handle_status(request: web.Request) -> web.Response:
    last = orchestrator.last_result if orchestrator else None
    return web.json_response({
        "scheduler_running": scheduler.is_running if scheduler else False,
        "watchlist": config.WATCHLIST,
        "interval_minutes": config.STRATEGY_INTERVAL_MINUTES,
        "last_run": last.to_dict() if last else None,
    })


async def handle_start(request: web.Request) -> web.Response:
    if scheduler and not scheduler.is_running:
        scheduler.start()
    return web.json_response({"status": "started"})


async def handle_stop(request: web.Request) -> web.Response:
    if scheduler and scheduler.is_running:
        scheduler.stop()
    return web.json_response({"status": "stopped"})


async def handle_run_once(request: web.Request) -> web.Response:
    """Trigger a single pipeline run (for testing / manual trigger)."""
    if not orchestrator:
        return web.json_response({"error": "Orchestrator not initialized"}, status=500)
    try:
        result = await orchestrator.run_pipeline()
        return web.json_response(result.to_dict())
    except Exception as e:
        logger.exception("Manual pipeline run failed")
        return web.json_response({"error": str(e)}, status=500)


def build_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/health", handle_health)
    app.router.add_get("/bot/status", handle_status)
    app.router.add_post("/bot/start", handle_start)
    app.router.add_post("/bot/stop", handle_stop)
    app.router.add_post("/bot/run", handle_run_once)
    return app


# ─── Main ─────────────────────────────────────────────────────────────────

async def main() -> None:
    global orchestrator, scheduler

    logger.info("Initializing AI Trading Bot...")
    logger.info("Watchlist: %s", config.WATCHLIST)
    logger.info("Interval: %d minutes", config.STRATEGY_INTERVAL_MINUTES)
    logger.info("Model architecture: %s", config.MODEL_ARCH)

    orchestrator = Orchestrator()
    await orchestrator.start()

    scheduler = BotScheduler(orchestrator)
    scheduler.start()

    # Start health/status HTTP server
    app = build_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", config.HEALTH_PORT)
    await site.start()
    logger.info("Health server listening on port %d", config.HEALTH_PORT)

    # Keep running until interrupted
    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        logger.info("Shutting down...")
        scheduler.stop()
        await orchestrator.stop()
        await runner.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
