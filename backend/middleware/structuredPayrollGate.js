const { isStructuredPayrollEnabled } = require('../config/tenantCapabilities')

function requireStructuredPayroll(req, res) {
  if (!isStructuredPayrollEnabled(req.tenant)) {
    res.status(403).json({
      success: false,
      message: 'Structured payroll is not enabled for this tenant.',
      code: 'STRUCTURED_PAYROLL_DISABLED',
    })
    return false
  }
  return true
}

module.exports = {
  requireStructuredPayroll,
}
