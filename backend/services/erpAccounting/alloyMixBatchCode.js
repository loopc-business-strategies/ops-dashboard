/** Live batch / mix codes: BMG-0001, BMG-0002, … (AMX-… kept for legacy rows). */
const MIX_CODE_PREFIX = 'BMG-'
const ALLOY_MIX_BATCH_RE = /^(?:BMG|AMX)-/i

function isAlloyMixBatchCode(value) {
  return ALLOY_MIX_BATCH_RE.test(String(value || '').trim())
}

module.exports = {
  MIX_CODE_PREFIX,
  ALLOY_MIX_BATCH_RE,
  isAlloyMixBatchCode,
}
