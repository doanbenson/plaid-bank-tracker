# Trading Bot Setup Guide

## Overview

Your Plaid Bank App now includes a comprehensive trading bot page powered by Alpaca Markets API. This allows you to paper trade and simulate different trades with real-time market data, charts, and order management.

## Features

### Backend (Python/Flask)
- **Alpaca Trading Client Integration**: Full integration with Alpaca's paper trading API
- **Trading Handler**: Comprehensive handler for all trading operations
- **RESTful API Endpoints**: 
  - Account information
  - Position management
  - Order placement (market & limit orders)
  - Market data & quotes
  - Portfolio performance tracking

### Frontend (Next.js/React)
- **Portfolio Overview**: Real-time portfolio statistics with P/L tracking
- **Interactive Charts**: Stock price charts with multiple timeframes (1D, 1H, 15M)
- **Position Cards**: Visual representation of all active positions
- **Order Form**: Easy-to-use trading interface with market and limit orders
- **Trade History**: Complete order history with filtering and cancellation
- **Responsive Design**: Works seamlessly on desktop and mobile

## Setup Instructions

### 1. Get Alpaca API Credentials

1. Go to [Alpaca Markets](https://alpaca.markets/)
2. Sign up for a free account
3. Navigate to your dashboard
4. Generate API keys for **Paper Trading**
5. Copy your API Key and Secret Key

### 2. Configure Backend

Add the following environment variables to your backend `.env` file:

```bash
# Alpaca Configuration
ALPACA_API_KEY=your_api_key_here
ALPACA_SECRET_KEY=your_secret_key_here
ALPACA_PAPER=true
```

### 3. Install Backend Dependencies

Navigate to the backend directory and install dependencies:

```bash
cd apps/api
pip install -r requirements.txt
```

This will install:
- `alpaca-py` - Alpaca Python SDK
- `pandas` - Data manipulation
- `numpy` - Numerical computing
- And existing dependencies

### 4. Install Frontend Dependencies

Navigate to the frontend directory and install dependencies:

```bash
cd apps/web
npm install
```

This will install:
- `recharts` - Charting library
- `@radix-ui/react-tabs` - Tab component
- And existing dependencies

### 5. Start the Application

**Backend:**
```bash
cd apps/api
python run.py
```

The API should start on `http://localhost:5000`

**Frontend:**
```bash
cd apps/web
npm run dev
```

The web app should start on `http://localhost:3000`

### 6. Access the Trading Dashboard

Navigate to `http://localhost:3000/trading` in your browser.

## API Endpoints

### Account
- `GET /api/trading/account` - Get account information

### Positions
- `GET /api/trading/positions` - Get all positions
- `GET /api/trading/positions/<symbol>` - Get specific position
- `DELETE /api/trading/positions/<symbol>` - Close position

### Orders
- `GET /api/trading/orders?status=<open|closed|all>` - Get orders
- `GET /api/trading/orders/<order_id>` - Get specific order
- `POST /api/trading/orders` - Place new order
- `DELETE /api/trading/orders/<order_id>` - Cancel order

### Market Data
- `GET /api/trading/market/<symbol>?timeframe=<1Day|1Hour|15Min>&days=<number>` - Get historical data
- `GET /api/trading/quote/<symbol>` - Get latest quote

### Portfolio
- `GET /api/trading/portfolio/performance` - Get portfolio performance metrics

## Usage Guide

### Placing Orders

1. Navigate to the **Trade** tab
2. Select **Buy** or **Sell**
3. Enter a stock symbol (e.g., AAPL, TSNA, SPY)
4. Click **Quote** to see current bid/ask prices
5. Enter quantity
6. Choose **Market** or **Limit** order type
7. For limit orders, specify limit price
8. Click **Place Order**

### Viewing Positions

- **Overview Tab**: See top positions on the dashboard
- **Positions Tab**: View all active positions with detailed metrics
- Click the **X** button on any position card to close it

### Monitoring Orders

1. Navigate to the **History** tab
2. Filter by **Open**, **Closed**, or **All** orders
3. View order details including:
   - Symbol, side, type
   - Quantity and filled amount
   - Price and status
   - Timestamps
4. Cancel open orders by clicking the **X** button

### Analyzing Charts

1. Enter a symbol in the chart search box
2. Click **Load** to fetch data
3. Switch between timeframes:
   - **1D**: Daily bars (30 days)
   - **1H**: Hourly bars (7 days)
   - **15M**: 15-minute bars (3 days)
4. Hover over the chart to see detailed price information

## Trading Strategy Tips

### Paper Trading Best Practices

1. **Start Small**: Begin with small quantities to understand the system
2. **Use Limit Orders**: Practice using limit orders to improve execution prices
3. **Monitor P/L**: Keep track of your unrealized profit/loss on each position
4. **Diversify**: Don't put all capital into one stock
5. **Set Goals**: Define profit targets and stop losses

### Common Stocks to Trade

- **SPY**: S&P 500 ETF - Great for market exposure
- **AAPL**: Apple Inc. - High liquidity tech stock
- **TSLA**: Tesla - Volatile growth stock
- **MSFT**: Microsoft - Stable large-cap
- **QQQ**: Nasdaq ETF - Tech-focused

## Troubleshooting

### API Connection Issues

**Problem**: "Failed to fetch trading data"
**Solution**: 
- Check that backend server is running on port 5000
- Verify ALPACA_API_KEY and ALPACA_SECRET_KEY are set correctly
- Ensure your Alpaca account is active

### Order Placement Errors

**Problem**: "Failed to place order"
**Solutions**:
- Verify you have sufficient buying power
- Check that the symbol is valid and tradeable
- Ensure market is open (9:30 AM - 4:00 PM ET)
- For limit orders, ensure price is reasonable

### Chart Not Loading

**Problem**: Charts show "No data available"
**Solutions**:
- Check that the symbol is valid
- Try a different timeframe
- Verify backend can reach Alpaca data API
- Some symbols may have limited historical data

### Position Not Updating

**Problem**: Position values seem stale
**Solution**:
- Click the **Refresh** button in the top right
- Market data updates during trading hours only
- Close and reopen the page to force refresh

## Development Notes

### File Structure

```
apps/
├── api/
│   ├── app/
│   │   ├── handlers/
│   │   │   └── alpaca_handler.py    # Alpaca API integration
│   │   ├── routes/
│   │   │   └── trading.py           # Trading endpoints
│   │   └── config.py                # Alpaca configuration
│   └── requirements.txt             # Python dependencies
└── web/
    ├── app/
    │   └── trading/
    │       └── page.tsx             # Main trading page
    ├── components/
    │   └── trading/
    │       ├── PortfolioOverview.tsx
    │       ├── PositionCard.tsx
    │       ├── OrderForm.tsx
    │       ├── StockChart.tsx
    │       └── TradeHistory.tsx
    └── lib/
        └── api-client.ts            # Trading API client
```

### Customization

You can customize the trading dashboard by:

1. **Adding More Chart Types**: Implement candlestick charts using recharts
2. **Technical Indicators**: Add moving averages, RSI, MACD
3. **Automated Trading**: Create trading bots with predefined strategies
4. **Watchlists**: Add functionality to save and track favorite stocks
5. **Alerts**: Implement price alerts and notifications
6. **Advanced Orders**: Add stop-loss and take-profit orders

## Resources

- [Alpaca Trading API Docs](https://alpaca.markets/sdks/python/trading.html)
- [Alpaca Market Data API](https://alpaca.markets/docs/market-data/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Recharts Documentation](https://recharts.org/)

## Support

For issues or questions:
1. Check the Alpaca API status page
2. Review the troubleshooting section above
3. Check browser console for errors
4. Review backend logs for API errors

---

**Important**: This is a paper trading environment. No real money is involved. Use this to practice trading strategies before using real funds.
