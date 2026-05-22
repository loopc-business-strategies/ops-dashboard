# MT5 Price Bridge

Free local bridge for live ERP metal prices.

It reads ticks from a running MetaTrader 5 terminal and posts them to:

```text
POST /api/erp-accounting/metal-rates/bridge
```

The backend stores the latest rates in MongoDB as USD per gram and broadcasts them to the ERP frontend with Socket.IO.

## Setup

1. Install MetaTrader 5 on the Windows machine that will run the bridge.
2. Login to any broker demo account that provides these symbols.
3. Open Market Watch and confirm the symbol names for gold, silver, and platinum.
4. Install Python packages:

```powershell
cd tools\mt5-price-bridge
python -m pip install -r requirements.txt
```

5. Create `tools\mt5-price-bridge\.env`:

```env
ERP_BRIDGE_URL=http://localhost:5000/api/erp-accounting/metal-rates/bridge
ERP_TENANT=mg
METAL_RATES_BRIDGE_TOKEN=change-this-to-the-same-token-as-backend
POLL_SECONDS=1

MT5_GOLD_SYMBOL=XAUUSD
MT5_SILVER_SYMBOL=XAGUSD
MT5_PLATINUM_SYMBOL=XPTUSD
```

If your broker uses suffixes, set them exactly, for example:

```env
MT5_SYMBOLS=gold=XAUUSDm,silver=XAGUSDm,platinum=XPTUSDm
```

6. Set the same token in the backend/Railway environment:

```env
METAL_RATES_BRIDGE_TOKEN=change-this-to-the-same-token-as-backend
```

7. Run:

```powershell
python mt5_price_bridge.py
```

Keep MT5 open and connected. Keep this bridge process running.

## Notes

MT5 symbols are normally quoted as USD per troy ounce. The backend converts them to USD per gram before saving because ERP stock and account positions are gram-based.

No paid API plan is needed, but the feed quality depends on the broker/demo account. It is good for live operational display and ERP calculation support, not guaranteed exchange-grade market data.
