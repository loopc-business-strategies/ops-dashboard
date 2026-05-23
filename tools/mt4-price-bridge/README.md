# MT4 Price Bridge

Fresh local bridge for live ERP metal prices from your connected Equiti MT4 account.

The bridge is an MT4 Expert Advisor (`EquitiMetalPriceBridge.mq4`). Keep MT4 logged in to account `3140019` on `EquitiSecurities-Live 3`, attach the EA to any chart, and it will send Gold, Silver, and Platinum quotes to the backend every second.

## Flow

```text
Equiti MT4 account 3140019
  -> MT4 EA reads Market Watch bid/ask ticks
  -> POST /api/erp-accounting/metal-rates/bridge
  -> backend saves latest tenant metal rates
  -> Socket.IO broadcasts metal-rates:update
  -> React MG top bar changes in real time
```

## Backend setup

Set a shared token in `backend/.env`:

```text
METAL_RATES_BRIDGE_TOKEN=change-this-long-random-token
```

For local development, the backend URL is:

```text
http://localhost:5000/api/erp-accounting/metal-rates/bridge
```

For production, use your Railway/API domain:

```text
https://api.yourdomain.com/api/erp-accounting/metal-rates/bridge
```

Restart the backend after changing `.env`.

## MT4 setup

1. Open MT4 and confirm the title shows account `3140019` on `EquitiSecurities-Live 3`.
2. In MT4, open **File > Open Data Folder**.
3. Copy `EquitiMetalPriceBridge.mq4` into `MQL4/Experts/`.
4. Restart MT4, or right-click **Navigator > Expert Advisors > Refresh**.
5. Open **Tools > Options > Expert Advisors**.
6. Enable **Allow WebRequest for listed URL**.
7. Add the backend origin, not the full route:

```text
http://localhost:5000
```

For production, add:

```text
https://api.yourdomain.com
```

8. Drag **EquitiMetalPriceBridge** onto any chart.
9. Set inputs:

```text
BridgeUrl=http://localhost:5000/api/erp-accounting/metal-rates/bridge
BridgeToken=<same value as METAL_RATES_BRIDGE_TOKEN>
Tenant=mg
GoldSymbol=XAUUSD
SilverSymbol=XAGUSD
PlatinumSymbol=XPTUSD
PostEverySeconds=1
```

10. Turn on **AutoTrading**.

## Symbol names

If the EA shows `missing tick`, your broker uses different symbol names. In MT4 Market Watch, right-click and choose **Show All**, then find the exact names for:

- Gold: often `XAUUSD`
- Silver: often `XAGUSD`
- Platinum: often `XPTUSD`

Some brokers add suffixes, such as `XAUUSDm`. Put the exact names into the EA inputs.

## Expected result

The MG top bar should stop showing `waiting MT4` and should update every second. Values display as **USD/G**. The backend converts MT4's usual USD/troy ounce quotes into USD/gram.

## Troubleshooting

- `401 Invalid metal rates bridge token`: token in EA does not match `METAL_RATES_BRIDGE_TOKEN`.
- `503 Metal rates bridge is not configured`: backend `.env` is missing `METAL_RATES_BRIDGE_TOKEN`, or backend was not restarted.
- `WebRequest failed 4014`: MT4 WebRequest URL is not allowed in **Tools > Options > Expert Advisors**.
- `missing tick`: symbol is not visible or the symbol name is wrong.
- Top bar still says `waiting MT4`: the EA is not posting successfully, the tenant is not `mg`, or your browser is logged into a different tenant.
