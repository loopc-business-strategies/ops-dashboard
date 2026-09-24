/**
 * LoopC-only Operations surfaces. Tenant from JWT/session (req.tenant), never client trust alone.
 */
function requireLoopcTenant(req, res, next) {
  const tenant = String(req.tenant || req.user?.company || req.authJwt?.company || '')
    .trim()
    .toLowerCase()

  if (tenant !== 'loopc') {
    return res.status(403).json({
      success: false,
      message: 'Operations production entries are restricted to the LoopC tenant.',
      code: 'LOOPC_TENANT_REQUIRED',
    })
  }

  return next()
}

module.exports = { requireLoopcTenant }
