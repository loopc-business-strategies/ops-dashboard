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

5. Create `tools\mt5-price-bridge\.env` from `.env.example`:

```env
ERP_BRIDGE_URL=https://api.loopcstrategies.com/api/erp-accounting/metal-rates/bridge
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
.\run-mt5-bridge.ps1
```

Keep MT5 open and connected. Keep this bridge process running.

If the top bar says `waiting MT5`, the bridge has not posted a valid live tick yet. Keep the PowerShell window open and check for lines like:

```text
14:10:03 XAU=107.71 XAG=1.16 XPT=41.51 USD/G
```

If it prints `waiting for gold and silver ticks...`, your MT5 symbol names are different. Check Market Watch in MT5 and update `MT5_GOLD_SYMBOL`, `MT5_SILVER_SYMBOL`, and `MT5_PLATINUM_SYMBOL`.

## Notes

MT5 symbols are normally quoted as USD per troy ounce. The backend converts them to USD per gram before saving because ERP stock and account positions are gram-based.

No paid API plan is needed, but the feed quality depends on the broker/demo account. It is good for live operational display and ERP calculation support, not guaranteed exchange-grade market data.
