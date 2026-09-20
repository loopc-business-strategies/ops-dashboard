/**
 * MG Floor surfaces must only serve the MG tenant.
 * Tenant comes from authenticated JWT/session (req.tenant / JWT company), never from client trust alone.
 */
function requireMgTenant(req, res, next) {
  const tenant = String(req.tenant || req.user?.company || req.authJwt?.company || '')
    .trim()
    .toLowerCase()

  if (tenant !== 'mg') {
    return res.status(403).json({
      success: false,
      message: 'MG Floor is restricted to the MG tenant.',
      code: 'MG_TENANT_REQUIRED',
    })
  }

  return next()
}

module.exports = { requireMgTenant }
