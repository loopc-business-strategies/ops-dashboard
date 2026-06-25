# MT4 live metal prices (Gold / Silver / Platinum)

The dashboard top bar reads **live** spots from your backend. Real-time **Equiti MT4** prices only update the UI when the **MetaPriceBridge** (or equivalent EA) **POSTs** them to the API. The native Equiti app shows ticks from the terminal directly; it does **not** prove the bridge is running.

## Operational checklist (MT4)

1. **AutoTrading** — Must be **on** (green). If it is red, Expert Advisors do not run and the bridge will not send prices.
2. **Expert on a chart** — Attach **Equiti MetaPriceBridge** (or your bridge EA) to an open chart and confirm the **smiley** (active EA). If the EA only appears under Navigator but is not on a chart, nothing is sent.
3. **Market Watch** — Add and keep subscribed the symbols the EA reads. This repo’s EA defaults are **XAUUSD.pr**, **XAGUSD.pr**, **XPTUSD.pr** (Equiti-style); other brokers may use **XAUUSD**, **XAGUSD**, **XPTUSD** or suffixed names—inputs must match Market Watch exactly.
4. **Bridge URL and auth** — EA must call your deployed API, e.g. `POST /api/erp-accounting/metal-rates/bridge`, with the shared secret **`METAL_RATES_BRIDGE_TOKEN`** (same value as in Railway / server env). Wrong or missing token → requests rejected (see logs).
5. **Tenant** — Bridge requests must identify the tenant (e.g. header **`x-tenant: mg`** or body field per your integration). Wrong tenant → data stored for the wrong DB or rejected.
6. **Logs** — On Railway (or your host), search for `[metal-rates bridge]` and confirm **accepted** vs **rejected** / `invalid bridge token` / tenant validation errors. Check MT4 **Experts** and **Journal** for HTTP or JSON errors.

### Equiti: `XAUUSD` or `XAUUSD.pr`?

The web dashboard does **not** pick the symbol—the **bridge EA inputs** must match Market Watch **exactly** (see [`tools/mt4-price-bridge/EquitiMetalPriceBridge.mq4`](../tools/mt4-price-bridge/EquitiMetalPriceBridge.mq4): `GoldSymbol`, `SilverSymbol`, `PlatinumSymbol`).

- **Either name is fine** if that row has live bid/ask and the EA posts without “missing tick” in Experts.
- **Use one “family” for all three metals:** e.g. all **`.pr`** (`XAUUSD.pr`, `XAGUSD.pr`, `XPTUSD.pr`) or all plain (`XAUUSD`, `XAGUSD`, `XPTUSD`). Mixing is allowed but harder to reason about when debugging.
- **When Equiti lists both:** many accounts treat **`.pr`** as the main executable feed (often tighter spread). The bundled EA defaults to **`XAUUSD.pr`**, **`XAGUSD.pr`**, **`XPTUSD.pr`**; use plain symbols only if your Market Watch does not list the `.pr` instruments.

If the string does not match Market Watch (wrong suffix, typo, or greyed-out symbol), the EA cannot read a tick and will log a missing-tick error.

## Backend behavior (reference)

- **`GET /api/erp-accounting/metal-rates/live`** (authenticated) returns the latest **`mt4-bridge`** row if it is **fresh** (default max age **`MT4_LIVE_STALE_MS`**, 30 seconds if unset). If the feed is stale or missing, the API can return **`feedType: 'market'`** and server-side market spot prices so the UI is not stuck on ancient numbers.
- Socket namespace **`/metal-rates`** broadcasts **`metal-rates:update`** when the bridge accepts a payload.

Implementation pointers: [`backend/routes/erp-accounting/currencyRoutes.js`](../backend/routes/erp-accounting/currencyRoutes.js), [`backend/services/erpAccounting/metalRateBridgeService.js`](../backend/services/erpAccounting/metalRateBridgeService.js), [`frontend/src/context/LiveMetalRatesContext.jsx`](../frontend/src/context/LiveMetalRatesContext.jsx).

## UI price movement row (▲/▼ under each metal)

The top bar, ERP live strip, inventory live badge, and mobile Home bar show **movement since the previous client snapshot** (not since market open):

- First successful price tick: subline shows currency/unit and feed label (e.g. `USD/OZ · MT4`) — no prior snapshot yet.
- Second tick onward: subline shows arrow, absolute change, and percent (e.g. `▲ 1.25 (+0.03%)`). A flat feed correctly shows `▲ 0.00 (+0.00%)`.
- Movement requires **two client updates** (poll, socket, or bridge POST). Poll interval is **1s** for MT4 (`MT4_LIVE_POLL_MS`); Socket.IO `/metal-rates` and `/api/realtime/events` SSE also push `metal-rates:update` on each bridge tick (~1s).

## Live consumers (web + mobile)

| Surface | Updates with live spot |
|---------|------------------------|
| Top bar metal tickers | Price + ▲/▼ movement row |
| ERP live prices strip | Same |
| ERP Dashboard margins widget | Margin %, equity, excess (rows with metal position) |
| Customer / Supplier Margin tabs | Same |
| Account Summary modal | Revaluation, Net Equity, Excess, Margin % when **metal balance (grams) ≠ 0** |
| Mobile Home live bar + margins widget | Same as dashboard |

**Cash-only accounts** (zero XAU/XAG balance): Total Funds stays fixed; **Revaluation stays 0** while the **Price** column still updates — expected.

Production probe: `npm run verify:live-metal-movement` (authenticated multi-sample poll of `GET /metal-rates/live`).
