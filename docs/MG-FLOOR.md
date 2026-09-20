# MG Floor

Factory-floor production system for **Modern Gold (MG)** only.

## Packages

| Path | Role |
|------|------|
| `mg-floor/` | Expo React Native app (phone + tablet) |
| `device-gateway/` | Local scale gateway (RS232/simulator) |
| `backend/routes/mgFloor.js` | MG-locked API facade over Production Control |
| `mobile/` | **Nexa — do not modify for MG Floor** |

Local Android APK/AAB (no EAS): [MG-FLOOR-ANDROID-LOCAL-BUILD.md](./MG-FLOOR-ANDROID-LOCAL-BUILD.md).

## Tenant security

MG Floor APIs reject any authenticated session whose JWT `company` / `req.tenant` is not `mg`.

Cross-tenant tests: `backend/tests/mg-floor-security.test.js`

## MH-708 serial checklist (on-site)

1. Identify COM/USB port for each of MG-SCALE-001…007
2. Capture raw frame with a serial terminal
3. Confirm baud, data bits, parity, stop bits
4. Update `device-gateway/config/default.json` per scale (`connectionType: RS232`)
5. Set `MG_GATEWAY_MODE` away from `simulator` for production
6. Confirm readings appear in `GET /api/mg-floor/scales/:id/status`

Never commit production JWT tokens into config files.

## Data safety

- Additive models only: `Scale`, `HardwareEvent`, `FloorDevice`, `FloorSyncOperation`
- No database drops/resets
- Weight corrections use existing `WeightAdjustment` (original + new + reason)
