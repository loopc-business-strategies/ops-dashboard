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

## Scale registry (fresh start)

Default scales `MG-SCALE-001…007` are **no longer auto-created**. Set `MG_FLOOR_SEED_DEFAULT_SCALES=true` only if you want them seeded again.

- Add scales from the web **Production Dashboard → MG Floor devices** (GJ-2000 preset available) or `POST /api/mg-floor/scales`.
- Remove a scale with **Remove** (web) / **REMOVE SCALE** (tablet) → `POST /api/mg-floor/scales/:scaleId/archive` with a reason. Scales are archived, never deleted; history and readings stay intact.

## Scale Camera (OCR) weight capture

Second capture method next to DIGITAL SCALE (RS-232/gateway), which is unchanged. Per scale, `captureMethods` may contain `DIGITAL_RS232`, `CAMERA_OCR`, `MANUAL`.

Flow: camera frame → guide-box crop → grayscale/contrast (native `modules/scale-ocr`) → ML Kit text + seven-segment decoder cross-check → strict parser → capacity check → multi-frame stability → operator **CONFIRM WEIGHT** → `FloorWeightCapture` record + photo → normal Metal IN/OUT submit with `weightCaptureId`.

- OCR never creates Metal IN/OUT on its own; the operator confirms the weight, then submits the transaction.
- A capture is single-use and consumed atomically by the transaction (`ProductionPass.issueWeightCapture` / `receiveWeightCapture`). Camera readings never carry a `scaleReadingId`.
- Minimum confidence floor is **0.6** (client + server). Readings where the two OCR engines disagree score ≤ 0.5, so they can never be confirmed.
- Manual entry requires the `adjustWeight` permission and a reason, and is stored as `MANUAL`.
- Offline: the capture is queued in the outbox (`weight_capture`, idempotent by `captureId`) and the photo in a separate photo queue; both flush on reconnect.
- Photos: JPEG, ~1280 px wide, stored on disk (not in the DB). Review in the tablet **CAMERA / MANUAL WEIGHT CAPTURES** screen.
- Transfer and XRF screens stay digital-only.

| Env var | Default | Purpose |
|---------|---------|---------|
| `MG_FLOOR_SEED_DEFAULT_SCALES` | unset (off) | `true` re-seeds MG-SCALE-001…007 |
| `MG_WEIGHT_CAPTURE_MAX_AGE_MS` | 24 h | Max age of a capture when consumed by Metal IN/OUT |
| `MG_FLOOR_CAPTURE_UPLOAD_DIR` | `<UPLOAD_STORAGE_ROOT>/mg-floor-captures` | Capture photo directory. Leave unset in production: the default is on the Railway volume (created by `railway.json`). An override outside `UPLOAD_STORAGE_ROOT` fails startup in production/staging; `/api/ready` warns if it is not writable. |
| `MG_FLOOR_CAPTURE_PHOTO_MAX_BYTES` | 2 MB | Max photo upload size |

### GJ-2000 physical test checklist (on-site)

1. Register the scale with the GJ-2000 preset (2200 g, 0.01 g, `CAMERA_OCR`), then build and install the signed APK (`docs/MG-FLOOR-ANDROID-LOCAL-BUILD.md`).
2. **Collect samples first.** Scales → **SCALE OCR DIAGNOSTICS** (needs `manageScales`; never records a weight). For each case, type what the display shows and **SAVE SAMPLE**; aim for ~20 samples: ~1 g, ~100 g, ~1250 g, ~2200 g, each in dim and bright light, plus a few **SHOULD NOT READ** frames (glare, display half outside the box, too far). Watch the per-digit segment fills: outlined segments sit within 0.1 of the threshold and are the ones likely to flip.
3. **EXPORT SAMPLES**, copy the JSON into `mg-floor/src/scaleCamera/__fixtures__/gj2000/`, and run `npx vitest run gj2000Fixtures` in `mg-floor`. Try candidate settings with `GJ2000_TUNING='{"segmentThreshold":0.35}'` before changing the scale. Commit the fixtures so later decoder changes are replayed against real frames.
4. Tune **Decoder tuning** in **CAPTURE SETTINGS** if needed: `segmentThreshold` (0.15–0.6, default 0.3; lower when lit segments read as off, higher when unlit ghost segments read as on), `guideBoxAspect` (2–6, default 3.2) and `guideBoxWidth` (0.5–0.9, default 0.72) so the box hugs the GJ-2000 digits.
5. Deny camera permission → the permission message and **OPEN SETTINGS** appear; the app does not crash.
6. Frame the display inside the guide box at 15–30 cm with even lighting; check that a stable reading locks within the configured frames/duration.
7. Test weights: ~1 g, ~100 g, ~1250 g and ~2200 g; each locked value must match the display exactly (all decimals).
8. Glare, partly outside the box, and too far away → LOW CONFIDENCE / CLIPPED with **RETRY**, never a locked value.
9. Change the weight while it is reading → status returns to CHANGING; no lock until stable.
10. Over capacity (`2200.01`+) → REVIEW (acknowledgement required) or rejected per policy; `2500` is always rejected.
11. Confirm → Metal IN and Metal OUT each save once (double tap shows SAVING… then SAVED); the capture shows as consumed and cannot be reused.
12. Airplane mode → confirm and submit are queued; on reconnect the capture, photo and transaction sync without duplicates.
13. Leave the screen or background the app → the camera light turns off (camera released).
14. Tune the stability settings (`consecutiveFrames`, `stableDurationMs`, `allowedVariation`) in **CAPTURE SETTINGS** if readings are slow or unstable; every change is audited.

## Data safety

- Additive models only: `Scale`, `HardwareEvent`, `FloorDevice`, `FloorSyncOperation`, `FloorWeightCapture`
- No database drops/resets
- Weight corrections use existing `WeightAdjustment` (original + new + reason)
