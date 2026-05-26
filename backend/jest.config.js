module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000,
  /** Package id (not an absolute path) — avoids Jest 30-style Windows `testRunner` resolution failures. */
  testRunner: 'jest-circus/runner',
}
