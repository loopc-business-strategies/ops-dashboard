const path = require('path')
const {
  scanRepo,
  fileContainsMutation,
  classifyMutator,
  collectScanTargets,
} = require('../../scripts/lib/destructiveScriptGuardScan.cjs')

const repoRoot = path.resolve(__dirname, '../..')
const fixtureRel = 'scripts/__guard_fixtures__/unguarded-mutator.sample.js'
const fixtureAbs = path.join(repoRoot, fixtureRel)

describe('checkDestructiveScriptGuards scanner', () => {
  test('production scan excludes __guard_fixtures__ and passes', () => {
    const result = scanRepo(repoRoot, { includeGuardFixtures: false })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
    expect(result.mutators).not.toContain(fixtureRel)
  })

  test('intentionally unguarded fixture is detected as a violation', () => {
    const fs = require('fs')
    const contents = fs.readFileSync(fixtureAbs, 'utf8')
    expect(fileContainsMutation(contents)).toBe(true)

    const classified = classifyMutator(fixtureRel, contents)
    expect(classified.ok).toBe(false)
    expect(classified.rule).toBe('staging-or-destructive-guard')

    const withFixture = scanRepo(repoRoot, { includeGuardFixtures: true })
    expect(withFixture.ok).toBe(false)
    expect(withFixture.violations.some((v) => v.relPath === fixtureRel)).toBe(true)
  })

  test('collectScanTargets can include fixture when requested', () => {
    const without = collectScanTargets(repoRoot, { includeGuardFixtures: false })
      .map((f) => f.relPath)
    const withFix = collectScanTargets(repoRoot, { includeGuardFixtures: true })
      .map((f) => f.relPath)

    expect(without).not.toContain(fixtureRel)
    expect(withFix).toContain(fixtureRel)
  })
})
