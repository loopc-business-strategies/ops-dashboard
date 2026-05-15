#!/usr/bin/env node
/*
 * Safety stub.
 *
 * The old version of this file directly deleted all MG transactions and ledger
 * rows. It has been disabled so running `node backend/cleanup-mg.js` cannot
 * destroy live MG accounting data by accident.
 */

console.error('This dangerous cleanup entrypoint has been disabled.')
console.error('Use backend/scripts/destructive/danger-reset-mg-transactions.js for a guarded dry-run only.')
console.error('That guarded script requires explicit env vars and confirmation before any delete operation.')
process.exit(1)
