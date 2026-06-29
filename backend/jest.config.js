module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000,
  /** Package id (not an absolute path) — avoids Windows `testRunner` resolution failures on some Jest versions. */
  testRunner: 'jest-circus/runner',
}
