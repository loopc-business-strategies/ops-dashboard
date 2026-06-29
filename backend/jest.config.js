module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000,
  /** Package id (not an absolute path) — avoids Windows `testRunner` resolution failures on some Jest versions. */
  testRunner: 'jest-circus/runner',
  collectCoverageFrom: [
    'routes/compliance.js',
    'routes/training.js',
    'routes/employees.js',
    'routes/erp.js',
  ],
  coverageThreshold: {
    global: {
      statements: 40,
      branches: 11,
      functions: 27,
      lines: 41,
    },
  },
}
