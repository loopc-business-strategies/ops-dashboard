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

Flow: while the camera preview is open the app silently reads the display in the background (silent photo → guide-box crop → grayscale/contrast (native `modules/scale-ocr`) → ML Kit text + seven-segment decoder cross-check → strict parser → capacity check; the sample photo is deleted right away). The status line above **CAPTURE** shows WAITING FOR SCALE → READING SCALE... / WEIGHT MOVING → **STABLE — 1250.20 g · CAPTURE READY**. Tapping **CAPTURE** before that shows **WAIT — WEIGHT NOT STABLE** and keeps monitoring. When stable, CAPTURE takes the evidence photo, reads it the same way, and the photo's reading must match the stable weight (otherwise WEIGHT CHANGED + **RETAKE**) → operator compares the number with the photo, ticks "display was steady" and taps **CONFIRM WEIGHT** → `FloorWeightCapture` record + photo with the stability evidence → normal Metal IN/OUT submit with `weightCaptureId`. An unreadable photo shows the reason and **RETAKE**; it never produces a weight. Nothing is saved automatically.

Stability rule (`mg-floor/src/scaleCamera/weightStability.ts`), from the scale's existing camera settings: at least `consecutiveFrames` (default 5) consecutive readings spanning at least `stableDurationMs` (default 1500 ms), each at or above `minConfidence`, all within ± tolerance of each other, where tolerance = max(`allowedVariation`, scale resolution) (default `allowedVariation` 0.01; with 0.01 g resolution, 1250.19–1250.21 is stable). An invalid/unclear frame, a reading outside the band, a gap over 1.5 s, RETAKE, leaving the screen, backgrounding the app or starting a capture clears the run. The latest reading must be under 1.5 s old when CAPTURE is tapped. Saved with the capture: `stableFrames`, `stabilityDurationMs`, `stabilityTolerance`, `stabilityReadings` (up to 30 `{ weight, confidence, offsetMs }`). Older captures and ones queued offline before this change have `stableFrames: 1` and no stability fields; they still sync.

Dashboard (camera-first): **CAPTURE WEIGHT** under the Metal In / Metal Out tables (after login) opens the scale camera straight away (`app/quick-capture.tsx`) — no QR, code, open-pass or scale picker. The scale is the first authorised scale with SCALE CAMERA enabled; with none registered (or when the scale list can't be loaded) it uses the built-in camera-only scale **MG-CAMERA** (GJ-2000 profile: 2200 g capacity, 0.01 g resolution, no gateway). The server creates MG-CAMERA on its first `CAMERA_OCR` capture (audit action `mg_floor_default_camera_scale_created`); all capture checks (stable, confidence, capacity, resolution) still apply, and once it exists a manager can edit, disable or archive it like any other scale — it is never recreated after that. After CONFIRM WEIGHT the reading is saved as a `CAMERA_OCR` capture with photo (no pass, no Metal IN/OUT transaction) and written into the next empty Qty cell (Batch 1 Gold → Batch 1 Alloy → Batch 2 Gold → Batch 2 Alloy) with the time; filled cells are never overwritten. Today's tables (captured weights and operator edits) are saved on the tablet and restored after an app restart; a new day starts from that day's Metal IN/OUT history. **Weight Captures** (viewAudit / manageScales) stays in the left column. The pass-based Metal IN/OUT screens and the Scales screen remain in the app but are no longer linked from the dashboard. Registering a scale is optional; to use a specific scale instead of MG-CAMERA, a manager registers it with **Camera OCR** in the web admin (Production → MG Floor devices); the tablet Scales / CAPTURE SETTINGS / SCALE OCR DIAGNOSTICS screens are only reachable by direct route (`/scales`) until they are linked again.

- OCR never creates Metal IN/OUT on its own; the operator confirms the weight, then submits the transaction.
- A capture is single-use and consumed atomically by the transaction (`ProductionPass.issueWeightCapture` / `receiveWeightCapture`). Camera readings never carry a `scaleReadingId`.
- Minimum confidence floor is **0.6** (client + server). Readings where the two OCR engines disagree score ≤ 0.5, so they can never be confirmed.
- The tablet no longer offers manual weight entry. The backend still accepts `MANUAL` captures, and existing MANUAL records stay visible in Weight Captures.
- Camera-only operation on the pass-based Metal IN/OUT screens: in **Scales → CAPTURE SETTINGS** turn **DIGITAL (RS-232)** off and keep **SCALE CAMERA (OCR)** + **Camera capture enabled** on; the method buttons disappear and Metal IN/OUT opens straight into the camera. Turning DIGITAL back on restores the gateway flow.
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
6. Frame the display inside the guide box at 15–30 cm with even lighting and wait for **STABLE — … · CAPTURE READY**, then tap **CAPTURE**; the read weight and the photo appear side by side. Tapping CAPTURE while the weight is moving shows **WAIT — WEIGHT NOT STABLE**; adding or removing metal right after CAPTURE shows WEIGHT CHANGED with **RETAKE**.
7. Test weights: ~1 g, ~100 g, ~1250 g and ~2200 g; each locked value must match the display exactly (all decimals).
8. Glare, partly outside the box, and too far away → NOT CLEAR / KEEP DISPLAY IN BOX with **RETAKE**, never a weight.
9. CONFIRM WEIGHT stays disabled until "display was steady" is ticked; RETAKE discards the photo and restarts the stability check from zero.
10. Over capacity (`2200.01`+) → REVIEW (acknowledgement required) or rejected per policy; `2500` is always rejected.
11. Confirm → Metal IN and Metal OUT each save once (double tap shows SAVING… then SAVED); the capture shows as consumed and cannot be reused.
12. Airplane mode → confirm and submit are queued; on reconnect the capture, photo and transaction sync without duplicates.
13. Leave the screen or background the app → the camera light turns off (camera released).
14. If photos are often unreadable, tune **Decoder tuning** and **Min confidence** in **CAPTURE SETTINGS**; every change is audited.

## Data safety

- Additive models only: `Scale`, `HardwareEvent`, `FloorDevice`, `FloorSyncOperation`, `FloorWeightCapture`
- No database drops/resets
- Weight corrections use existing `WeightAdjustment` (original + new + reason)
