const { runJvLedgerFxBackfillOnNativeDb } = require('../services/jvLedgerFxBackfill')

module.exports = {
  id: '003-backfill-jv-ledger-base-to-fc',
  async up({ db, tenant }) {
    const result = await runJvLedgerFxBackfillOnNativeDb(db, {
      dryRun: false,
      mode: 'coa',
      verbose: false,
    })
    console.log(
      `[${tenant}] JV ledger base→FC: updated=${result.updated} candidates=${result.candidateRows} skipped=${result.skipped}`,
    )
  },
}
