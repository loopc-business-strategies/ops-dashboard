#!/usr/bin/env node
/**
 * Decrypt a backup archive written by mongodump-tenants.mjs.
 *   BACKUP_ENCRYPTION_PASSPHRASE=... node scripts/decrypt-backup.mjs mg-2026-10-08.archive.gz.enc
 *   node scripts/decrypt-backup.mjs <file.enc> [output] --passphrase-file <path>
 * The passphrase file may contain notes; its last non-empty line is used.
 * Restore the output with: mongorestore --gzip --archive=<output> --uri <target>
 */
import fs from 'node:fs'
import { decryptFile, ENCRYPTED_SUFFIX } from './backupCrypto.mjs'

const args = process.argv.slice(2)
const fileFlag = args.indexOf('--passphrase-file')
const passphraseFile = fileFlag >= 0 ? args.splice(fileFlag, 2)[1] : ''
const [input, outputArg] = args

if (!input) {
  console.error('Usage: node scripts/decrypt-backup.mjs <file.enc> [output] [--passphrase-file <path>]')
  process.exit(1)
}

const passphrase = passphraseFile
  ? fs.readFileSync(passphraseFile, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).pop()
  : process.env.BACKUP_ENCRYPTION_PASSPHRASE

const output = outputArg || (input.endsWith(ENCRYPTED_SUFFIX) ? input.slice(0, -ENCRYPTED_SUFFIX.length) : `${input}.dec`)

decryptFile(input, output, passphrase)
  .then(() => console.log(`Decrypted ${input} -> ${output}`))
  .catch((err) => {
    console.error(`FAIL: ${err.message}`)
    process.exit(1)
  })
