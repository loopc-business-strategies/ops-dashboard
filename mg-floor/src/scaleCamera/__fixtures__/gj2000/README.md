# GJ-2000 OCR fixtures

Drop JSON files exported from **Scales → SCALE OCR DIAGNOSTICS → EXPORT SAMPLES** here.
`gj2000Fixtures.test.ts` replays every sample through the seven-segment decoder and the
combine step:

- a sample with an expected value must read exactly that value;
- a "SHOULD NOT READ" sample must not produce a confirmable reading.

Try candidate decoder settings against the stored samples before changing a scale:

```powershell
$env:GJ2000_TUNING='{"segmentThreshold":0.35}'; npx vitest run gj2000Fixtures; Remove-Item Env:GJ2000_TUNING
```

Samples contain only the cropped grayscale display, never a full camera photo.
