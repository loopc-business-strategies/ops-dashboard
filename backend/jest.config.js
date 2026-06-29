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
    'routes/crm.js',
    'routes/platformRoutes.js',
    'routes/adminTenantRoutes.js',
    'routes/taskTemplates.js',
    'routes/department-state.js',
    'routes/notifications.js',
    'routes/ai.js',
    'routes/operationsLegalDocuments.js',
  ],
  coverageThreshold: {
    global: {
      statements: 34,
      branches: 12,
      functions: 19,
      lines: 37,
    },
  },
}
