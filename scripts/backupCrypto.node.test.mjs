import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { decryptFile, encryptFile } from './backupCrypto.mjs'

const passphrase = 'correct-horse-battery-staple-42'

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'backup-crypto-'))
}

test('round-trips an archive and hides its contents', async () => {
  const dir = tempDir()
  const plain = path.join(dir, 'mg.archive.gz')
  const original = Buffer.concat([Buffer.from('customer ledger UZEX '), crypto.randomBytes(200000)])
  fs.writeFileSync(plain, original)

  await encryptFile(plain, `${plain}.enc`, passphrase)
  const encrypted = fs.readFileSync(`${plain}.enc`)
  assert.equal(encrypted.includes(Buffer.from('UZEX')), false)

  await decryptFile(`${plain}.enc`, path.join(dir, 'out.gz'), `  ${passphrase}\n`)
  assert.deepEqual(fs.readFileSync(path.join(dir, 'out.gz')), original)
})

test('rejects a wrong passphrase and a tampered file', async () => {
  const dir = tempDir()
  const plain = path.join(dir, 'cg.archive.gz')
  fs.writeFileSync(plain, crypto.randomBytes(5000))
  await encryptFile(plain, `${plain}.enc`, passphrase)

  await assert.rejects(decryptFile(`${plain}.enc`, path.join(dir, 'x'), 'a-different-passphrase'), /Decryption failed/)
  assert.equal(fs.existsSync(path.join(dir, 'x')), false)

  const bytes = fs.readFileSync(`${plain}.enc`)
  bytes[100] ^= 0xff
  fs.writeFileSync(`${plain}.enc`, bytes)
  await assert.rejects(decryptFile(`${plain}.enc`, path.join(dir, 'y'), passphrase), /Decryption failed/)
})

test('refuses short passphrases', async () => {
  const dir = tempDir()
  const plain = path.join(dir, 'vb.archive.gz')
  fs.writeFileSync(plain, 'data')
  await assert.rejects(encryptFile(plain, `${plain}.enc`, 'short'), /at least 16 characters/)
})
