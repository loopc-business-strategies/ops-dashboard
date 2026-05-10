const express = require('express')
const { registerErpAccountingRoutes } = require('./erp-accountingContext')

const router = express.Router()

registerErpAccountingRoutes(router)

module.exports = router
