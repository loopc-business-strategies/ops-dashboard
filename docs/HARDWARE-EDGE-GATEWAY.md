# Hardware Edge Gateway Contract

## Architecture

```
Factory Device
  → Local Gateway / Edge Service
    → Secure API (`POST /api/hardware/ingest`)
      → Backend (tenant-bound)
        → Database
          → Dashboard / Realtime
```

Related: `POST /api/scan/resolve` for barcode/QR identity resolution after decode.

## Device types (interfaces ready)

- barcode_scanner
- qr_scanner
- label_printer
- attendance_device
- rfid
- gps
- machine_telemetry

Weighing scales are not accepted (`weighing_scale` fails validation). MG Floor weights are entered manually and approved by the Floor Manager — see [MG-FLOOR.md](./MG-FLOOR.md).

## Auth

Same tenant session as the rest of the Ops Dashboard:

- Cookie session + CSRF, or
- Bearer JWT (`company` claim must match tenant)

## Ingest body

```json
{
  "deviceType": "barcode_scanner",
  "deviceId": "SCANNER-LINE-A-01",
  "eventType": "scan",
  "payload": { "code": "BATCH-000123" },
  "recordedAt": "2026-09-16T00:00:00.000Z",
  "idempotencyKey": "optional-retry-key"
}
```

Response: `202 Accepted` with echoed event metadata (nothing is persisted yet).

## Non-goals (this phase)

- No production weighing through hardware
- No vendor-specific SDK purchase
- No fake hardware simulation that mutates stock/ledger
