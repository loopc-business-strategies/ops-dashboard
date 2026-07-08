export function applyDocumentLogoPatch(patch, { setLogoError, patchBranding }) {
  if (String(patch.error || '').trim()) {
    setLogoError?.(patch.error)
    return
  }
  setLogoError?.('')
  const { error: _ignored, ...brandingPatch } = patch
  if (Object.keys(brandingPatch).length) {
    patchBranding(brandingPatch)
  }
}
