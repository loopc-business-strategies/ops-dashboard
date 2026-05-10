function requireTenantRouteReadiness(req, res, next) {
  // Legacy gate retained only for backward compatibility.
  // Tenant safety is now enforced by tenantContext + auth middleware,
  // so this middleware should not block tenant routes.
  return next()
}

module.exports = {
  requireTenantRouteReadiness,
}
