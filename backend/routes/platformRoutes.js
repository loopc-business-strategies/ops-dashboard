const express = require('express')
const { getTenantsForApi } = require('../config/tenantRegistry')

const router = express.Router()

/** Public tenant list for mobile login (company codes + display names only). */
router.get('/tenants/public', (_req, res) => {
  res.json({
    success: true,
    tenants: getTenantsForApi(),
  })
})

module.exports = router
