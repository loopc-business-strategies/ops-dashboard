const express = require('express')

const router = express.Router()

/** Public VAPID public key for browser Web Push (private key stays on server only). */
router.get('/web-config', (req, res) => {
  const publicKey = String(process.env.WEB_PUSH_PUBLIC_KEY || '').trim()
  if (!publicKey) {
    return res.json({ success: true, configured: false, publicKey: null })
  }
  res.json({ success: true, configured: true, publicKey })
})

module.exports = router
