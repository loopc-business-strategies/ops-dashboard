# MG Floor — hardware commissioning checklist

Technician worksheet for scale and XRF setup. **Do not invent settings.** Anything marked **REQUIRES PHYSICAL VERIFICATION** must be confirmed on the device label, About screen, manufacturer docs, or during live commissioning.

## Scales (seed IDs are not a hard limit)

Initial seed / configuration identifiers (register more via ops Devices admin):

| scaleId | Status |
|---------|--------|
| MG-SCALE-001 … MG-SCALE-007 | Seed defaults only when registry empty |

### Per-scale record

| Field | Value / notes |
|-------|----------------|
| scaleId | e.g. MG-SCALE-00N |
| manufacturer | Ming Heng (typical) — **REQUIRES PHYSICAL VERIFICATION** |
| model | MH-708 (typical) — **REQUIRES PHYSICAL VERIFICATION** |
| serialNumber | From device label — **REQUIRES PHYSICAL VERIFICATION** |
| connectionType | RS232 / USB / Bluetooth / Ethernet — **REQUIRES PHYSICAL VERIFICATION** |
| port / IP / Bluetooth ID | Site-specific — **REQUIRES PHYSICAL VERIFICATION** |
| baud rate | Default in config may be 9600 — **REQUIRES PHYSICAL VERIFICATION** |
| data bits / parity / stop bits / flow control | **REQUIRES PHYSICAL VERIFICATION** |
| protocol / parser framing | MH-708 framing **not hard-coded** — **REQUIRES PHYSICAL VERIFICATION** |
| department / location | Per factory layout |
| gatewayId | Assigned gateway before ingest |
| unit / precision | Typically g — confirm |
| calibration date / next due | From calibration cert |

## Gateways

| Field | Notes |
|-------|--------|
| gatewayId | e.g. MG-GATEWAY-001 |
| auth secret | Server-side only — never in the mobile app |
| assigned scales | Gateway A may only ingest its assigned scales |

## XRF analyzers

Do **not** assume G5 / G7 / TrueX from photos.

| Field | Notes |
|-------|--------|
| analyzerId | Seed example MG-XRF-001 only if registered — UI starts with **no** auto-selection |
| manufacturer | LANScientific (typical) — **REQUIRES PHYSICAL VERIFICATION** |
| model / serial / firmware | From About / label — **REQUIRES PHYSICAL VERIFICATION** |
| connectionType | USB / Bluetooth / Wi-Fi — **REQUIRES PHYSICAL VERIFICATION** |
| IP / port / SDK version | **REQUIRES PHYSICAL VERIFICATION** |
| official API / protocol | Do not scrape the screen; do not fabricate results — **REQUIRES PHYSICAL VERIFICATION** |

## Production QC linkage

Confirm workflow stores: batch + `scaleReadingId` + XRF result + employee + device + timestamp.

## Sign-off

| Check | Pass | Date | Tech |
|-------|------|------|------|
| All assigned scales connect / stable / disconnect / reconnect | | | |
| Metal IN / OUT / Transfer with stable capture | | | |
| XRF authorized analyzer select + confirm with scaleReadingId | | | |
| Simulator disabled in production | | | |
