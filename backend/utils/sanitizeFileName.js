/**
 * Strip control characters and unsafe path/quote characters from upload/download filenames.
 * Uses charCode checks (not a control-char regex) so eslint no-control-regex stays clean.
 */
function sanitizeFileName(name, fallback = 'file') {
  const raw = String(name || fallback)
  let out = ''
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i)
    const ch = raw[i]
    if (code <= 0x1f || code === 0x7f || ch === '"') continue
    if (ch === '/' || ch === '\\') {
      out += '_'
      continue
    }
    out += ch
  }
  out = out.trim().slice(0, 200)
  return out || fallback
}

module.exports = {
  sanitizeFileName,
}
