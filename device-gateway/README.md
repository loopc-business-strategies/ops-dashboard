# MG Device Gateway

Local edge service for MG Floor weighing scales and XRF status/result ingest.

## Architecture

```
7 scales / XRF → MG Device Gateway → MG Backend (gateway secret auth) → MG Floor app
```

MG-only. Tenant is hard-locked to `mg`.

## Auth (required)

Preferred: **gateway shared secret** (not employee JWT).

1. Put the secret in `gateway-secret.txt` (gitignored, one line)
2. Set Railway/backend env:
   `MG_GATEWAY_SECRETS=MG-GATEWAY-001=<same-secret>`
3. Headers sent by the gateway:
   - `X-Gateway-Id: MG-GATEWAY-001`
   - `X-Gateway-Secret: <secret>`

Dev-only JWT fallback: set `MG_GATEWAY_ALLOW_JWT_FALLBACK=1` and use `gateway-token.txt`. **Not for production.**

## Modes

- `simulator` (default): virtual MG-SCALE-001..007
- `RS232`: Ming Heng MH-708 via configurable serial port (verify baud/parity on site)
- Ethernet/Wi-Fi TCP: line-oriented sockets (`ipAddress` + `networkPort`)
- USB / Bluetooth: **stubs only** — not commissioned / not production-ready

## Local management API

Binds to `127.0.0.1` by default (`MG_GATEWAY_BIND`). Mutating routes require `X-Local-Gateway-Token` when `MG_GATEWAY_LOCAL_TOKEN` is set, or whenever bind is `0.0.0.0`.

## XRF (LANScientific)

Separate from scales. Default analyzer id: `MG-XRF-001`.

```bash
set MG_XRF_MODE=simulator   # development only — never use in production by accident
# unset / disabled = no XRF adapter started
# live LANScientific protocol is NOT implemented until model/SDK is confirmed
```

Local XRF controls:

- `GET /xrf`
- `POST /xrf/MG-XRF-001/test` body `{ "outcome": "ok" }` (`ok`|`error`|`timeout`|`invalid`) — pushes result to `/api/mg-floor/xrf/ingest/result`

## Run (factory PC — double-click)

1. Copy `gateway.local.env.example` → `gateway.local.env`
2. Create `gateway-secret.txt` with the shared secret (one line)
3. Double-click **`start-gateway.cmd`**
   - Or: `start-gateway.cmd RS232` for real serial scales
4. Leave the window open. Health: `http://127.0.0.1:7077/health`

Never commit `gateway-secret.txt` or `gateway-token.txt`.

## Run (manual)

```bash
cd device-gateway
npm install
# optional for real serial:
npm install serialport

set MG_GATEWAY_MODE=simulator
set MG_API_BASE_URL=http://localhost:5000
set MG_GATEWAY_ID=MG-GATEWAY-001
set MG_GATEWAY_SECRET=<shared-secret>
npm start
```

Local health: `http://127.0.0.1:7077/health`  
WebSocket readings: `ws://127.0.0.1:7077/ws`

## MH-708 configuration

Do **not** assume baud rate / parity / pinout until measured. Edit `config/default.json` per scale:

- `port` (e.g. `COM3` / `/dev/ttyUSB0`)
- `baudRate`, `dataBits`, `parity`, `stopBits`
- `connectionType`: `RS232` | `USB` | `BLUETOOTH` | `ETHERNET` | `SIMULATOR`

## Simulator controls

```bash
curl -X POST http://127.0.0.1:7077/simulator/MG-SCALE-001/weight ^
  -H "Content-Type: application/json" ^
  -H "X-Local-Gateway-Token: <token-if-configured>" ^
  -d "{\"weight\":125.36,\"stable\":true}"
```
