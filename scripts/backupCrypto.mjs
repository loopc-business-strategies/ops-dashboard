/**
 * Passphrase encryption for backup archives: AES-256-GCM with a scrypt-derived key.
 * File layout: MAGIC | salt (16) | iv (12) | ciphertext | auth tag (16).
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import { pipeline } from 'node:stream/promises'

const MAGIC = Buffer.from('OPSBK1')
const SALT_BYTES = 16
const IV_BYTES = 12
const TAG_BYTES = 16
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export const ENCRYPTED_SUFFIX = '.enc'

export function normalizePassphrase(value) {
  const passphrase = String(value || '').trim()
  if (passphrase.length < 16) throw new Error('Backup passphrase must be at least 16 characters')
  return passphrase
}

const deriveKey = (passphrase, salt) => crypto.scryptSync(normalizePassphrase(passphrase), salt, 32, SCRYPT)

export async function encryptFile(inputPath, outputPath, passphrase) {
  const salt = crypto.randomBytes(SALT_BYTES)
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
  fs.writeFileSync(outputPath, Buffer.concat([MAGIC, salt, iv]))
  await pipeline(fs.createReadStream(inputPath), cipher, fs.createWriteStream(outputPath, { flags: 'a' }))
  fs.appendFileSync(outputPath, cipher.getAuthTag())
}

export async function decryptFile(inputPath, outputPath, passphrase) {
  const size = fs.statSync(inputPath).size
  if (size < HEADER_BYTES + TAG_BYTES) throw new Error('File is too small to be an encrypted backup')
  const fd = fs.openSync(inputPath, 'r')
  const header = Buffer.alloc(HEADER_BYTES)
  const tag = Buffer.alloc(TAG_BYTES)
  try {
    fs.readSync(fd, header, 0, HEADER_BYTES, 0)
    fs.readSync(fd, tag, 0, TAG_BYTES, size - TAG_BYTES)
  } finally {
    fs.closeSync(fd)
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Not an encrypted ops-dashboard backup')
  const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES)
  const iv = header.subarray(MAGIC.length + SALT_BYTES)
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv)
  decipher.setAuthTag(tag)
  try {
    await pipeline(
      fs.createReadStream(inputPath, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }),
      decipher,
      fs.createWriteStream(outputPath),
    )
  } catch (err) {
    fs.rmSync(outputPath, { force: true })
    throw new Error(`Decryption failed (wrong passphrase or damaged file): ${err.message}`)
  }
}
