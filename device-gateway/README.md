# MG Device Gateway

Local edge service for MG Floor weighing scales.

## Architecture

```
7 scales → MG Device Gateway → MG Backend (/api/mg-floor/scales/ingest) → MG Floor app
```

MG-only. Tenant is hard-locked to `mg`.

## Modes

- `simulator` (default): virtual MG-SCALE-001..007
- `RS232`: Ming Heng MH-708 via configurable serial port (verify baud/parity on site)
- Ethernet/Wi-Fi TCP: line-oriented sockets (`ipAddress` + `networkPort`)
- USB / Bluetooth: **stubs only** — not production-ready (fail with clear errors)

## XRF (LANScientific)

Separate from scales. Default analyzer id: `MG-XRF-001`.

```bash
set MG_XRF_MODE=simulator   # development only — never use in production by accident
# unset / disabled = no XRF adapter started
# live LANScientific protocol is NOT implemented until model/SDK is confirmed
```

Local XRF controls:

- `GET /xrf`
- `POST /xrf/MG-XRF-001/test` body `{ "outcome": "ok" }` (`ok`|`error`|`timeout`|`invalid`)

## Run (factory PC — double-click)

1. Copy `gateway.local.env.example` → `gateway.local.env`
2. Copy `gateway-token.txt.example` → `gateway-token.txt` and paste an MG JWT (one line)
3. Double-click **`start-gateway.cmd`**
   - Or: `start-gateway.cmd RS232` for real serial scales
4. Leave the window open. Health: `http://localhost:7077/health`

Token file is gitignored — never commit `gateway-token.txt`.

Get a token (PowerShell):

```powershell
$body = '{"name":"Nan","password":"123456","company":"mg"}'
$r = Invoke-RestMethod -Uri 'https://api.loopcstrategies.com/api/auth/login' -Method POST -ContentType 'application/json' -Headers @{ 'X-Client' = 'mg-floor' } -Body $body
$r.token
```

## Run (manual)

```bash
cd device-gateway
npm install
# optional for real serial:
npm install serialport

set MG_GATEWAY_MODE=simulator
set MG_API_BASE_URL=http://localhost:5000
set MG_GATEWAY_TOKEN=<mg-user-jwt>
npm start
```

Local health: `http://localhost:7077/health`  
WebSocket readings: `ws://localhost:7077/ws`

## MH-708 configuration

Do **not** assume baud rate / parity / pinout until measured. Edit `config/default.json` per scale:

- `port` (e.g. `COM3` / `/dev/ttyUSB0`)
- `baudRate`, `dataBits`, `parity`, `stopBits`
- `connectionType`: `RS232` | `USB` | `BLUETOOTH` | `ETHERNET` | `SIMULATOR`

## Simulator controls

```bash
curl -X POST http://localhost:7077/simulator/MG-SCALE-001/weight -H "Content-Type: application/json" -d "{\"weight\":125.36,\"stable\":true}"
```
