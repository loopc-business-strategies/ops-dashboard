const crypto = require('crypto')

const ALGO = 'aes-256-gcm'
const IV_LEN = 12

function getEncryptionKey() {
  const raw = String(process.env.EMAIL_TOKEN_ENCRYPTION_KEY || '').trim()
  if (!raw) return null
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex')
  return crypto.createHash('sha256').update(raw).digest()
}

function encryptToken(plain) {
  const key = getEncryptionKey()
  if (!key) throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY is not configured.')
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

function decryptToken(encoded) {
  const key = getEncryptionKey()
  if (!key) throw new Error('EMAIL_TOKEN_ENCRYPTION_KEY is not configured.')
  const buf = Buffer.from(String(encoded || ''), 'base64')
  const iv = buf.subarray(0, IV_LEN)
  const tag = buf.subarray(IV_LEN, IV_LEN + 16)
  const data = buf.subarray(IV_LEN + 16)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}

function isTokenEncryptionConfigured() {
  return Boolean(getEncryptionKey())
}

module.exports = {
  encryptToken,
  decryptToken,
  isTokenEncryptionConfigured,
}
