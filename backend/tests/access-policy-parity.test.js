const path = require('path')
const { execFileSync } = require('child_process')

describe('cross-layer ERP access policy parity', () => {
  test('frontend and backend derived policy stay in sync', () => {
    const repoRoot = path.resolve(__dirname, '../..')
    execFileSync('node', ['scripts/check-access-policy-parity.mjs'], {
      cwd: repoRoot,
      stdio: 'pipe',
    })
  })
})
