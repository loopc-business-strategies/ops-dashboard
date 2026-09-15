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

- weighing_scale
- barcode_scanner
- qr_scanner
- label_printer
- attendance_device
- rfid
- gps
- machine_telemetry

## Auth

Same tenant session as the rest of the Ops Dashboard:

- Cookie session + CSRF, or
- Bearer JWT (`company` claim must match tenant)

## Ingest body

```json
{
  "deviceType": "weighing_scale",
  "deviceId": "SCALE-LINE-A-01",
  "eventType": "weight_reading",
  "payload": { "grams": 125.42, "stable": true },
  "recordedAt": "2026-09-16T00:00:00.000Z",
  "idempotencyKey": "optional-retry-key"
}
```

Response: `202 Accepted` with echoed event metadata. Persistence of a dedicated `HardwareEvent` collection is a follow-on when devices roll out.

## Non-goals (this phase)

- No browser WebUSB / Web Serial production weighing
- No vendor-specific SDK purchase
- No fake hardware simulation that mutates stock/ledger
