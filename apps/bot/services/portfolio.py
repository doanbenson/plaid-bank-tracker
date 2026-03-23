from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest, LimitOrderRequest, GetOrdersRequest
from alpaca.trading.enums import OrderSide, TimeInForce, QueryOrderStatus

import config


class PortfolioService:
    """Thin wrapper around Alpaca TradingClient for portfolio state + order placement."""

    def __init__(self):
        self.client = TradingClient(
            config.ALPACA_API_KEY,
            config.ALPACA_SECRET_KEY,
            paper=config.ALPACA_PAPER,
        )

    # ---- Account ----

    def get_account(self) -> dict:
        acct = self.client.get_account()
        return {
            "equity": float(acct.equity),
            "cash": float(acct.cash),
            "buying_power": float(acct.buying_power),
            "portfolio_value": float(acct.portfolio_value),
            "last_equity": float(acct.last_equity),
            "long_market_value": float(acct.long_market_value),
        }

    # ---- Positions ----

    def get_positions(self) -> list[dict]:
        positions = self.client.get_all_positions()
        return [
            {
                "symbol": p.symbol,
                "qty": float(p.qty),
                "avg_entry": float(p.avg_entry_price),
                "current_price": float(p.current_price),
                "market_value": float(p.market_value),
                "unrealized_pl": float(p.unrealized_pl),
                "unrealized_plpc": float(p.unrealized_plpc),
            }
            for p in positions
        ]

    def get_position(self, symbol: str) -> dict | None:
        try:
            p = self.client.get_open_position(symbol)
            return {
                "symbol": p.symbol,
                "qty": float(p.qty),
                "avg_entry": float(p.avg_entry_price),
                "current_price": float(p.current_price),
                "market_value": float(p.market_value),
                "unrealized_pl": float(p.unrealized_pl),
            }
        except Exception:
            return None

    # ---- Orders ----

    def place_market_order(self, symbol: str, qty: float, side: str) -> dict:
        order_side = OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL
        order = self.client.submit_order(
            MarketOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.DAY,
            )
        )
        return self._fmt(order)

    def place_limit_order(self, symbol: str, qty: float, side: str, limit: float) -> dict:
        order_side = OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL
        order = self.client.submit_order(
            LimitOrderRequest(
                symbol=symbol,
                qty=qty,
                side=order_side,
                time_in_force=TimeInForce.DAY,
                limit_price=limit,
            )
        )
        return self._fmt(order)

    def get_orders(self, status: str = "all") -> list[dict]:
        status_map = {
            "open": QueryOrderStatus.OPEN,
            "closed": QueryOrderStatus.CLOSED,
            "all": QueryOrderStatus.ALL,
        }
        orders = self.client.get_orders(
            filter=GetOrdersRequest(status=status_map.get(status, QueryOrderStatus.ALL))
        )
        return [self._fmt(o) for o in orders]

    def close_position(self, symbol: str) -> dict:
        self.client.close_position(symbol)
        return {"status": "closed", "symbol": symbol}

    # ---- helpers ----

    @staticmethod
    def _fmt(order) -> dict:
        return {
            "id": str(order.id),
            "symbol": order.symbol,
            "qty": float(order.qty) if order.qty else None,
            "filled_qty": float(order.filled_qty) if order.filled_qty else 0,
            "side": order.side.value,
            "type": order.type.value,
            "status": order.status.value,
            "filled_avg_price": float(order.filled_avg_price) if order.filled_avg_price else None,
            "created_at": order.created_at.isoformat() if order.created_at else None,
        }
