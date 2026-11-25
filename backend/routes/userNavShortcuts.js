const express = require('express')
const { protect } = require('../middleware/auth')
const { Joi, validateBody, validateParams } = require('../middleware/validate')
const {
  getFavorites,
  addFavorite,
  removeFavorite,
  reorderFavorites,
  getRecent,
  recordRecent,
  clearRecent,
} = require('../services/userNavShortcutsService')
const { ALLOWED_NAV_ITEM_IDS } = require('../utils/navItemAllowlist')

const router = express.Router()

const navItemIdSchema = Joi.string()
  .trim()
  .max(60)
  .valid(...ALLOWED_NAV_ITEM_IDS)
  .required()

const addFavoriteSchema = Joi.object({
  navItemId: navItemIdSchema,
})

const reorderFavoritesSchema = Joi.object({
  navItemIds: Joi.array().items(Joi.string().trim().max(60)).max(40).required(),
})

const recordRecentSchema = Joi.object({
  navItemId: navItemIdSchema,
})

const navItemParamSchema = Joi.object({
  navItemId: navItemIdSchema,
})

function sendServiceError(res, err) {
  const status = err.status || 500
  if (status >= 500) console.error('userNavShortcuts error:', err)
  return res.status(status).json({
    success: false,
    code: err.code || undefined,
    message: err.message || 'Server error.',
  })
}

router.get('/me/favorites', protect, async (req, res) => {
  try {
    const favorites = await getFavorites(req.user._id)
    res.json({ success: true, favorites })
  } catch (err) {
    sendServiceError(res, err)
  }
})

router.post('/me/favorites', protect, validateBody(addFavoriteSchema), async (req, res) => {
  try {
    const favorites = await addFavorite(req.user._id, req.body.navItemId)
    res.status(201).json({ success: true, favorites })
  } catch (err) {
    sendServiceError(res, err)
  }
})

router.delete('/me/favorites/:navItemId', protect, validateParams(navItemParamSchema), async (req, res) => {
  try {
    const favorites = await removeFavorite(req.user._id, req.params.navItemId)
    res.json({ success: true, favorites })
  } catch (err) {
    sendServiceError(res, err)
  }
})

router.put('/me/favorites/order', protect, validateBody(reorderFavoritesSchema), async (req, res) => {
  try {
    const favorites = await reorderFavorites(req.user._id, req.body.navItemIds)
    res.json({ success: true, favorites })
  } catch (err) {
    sendServiceError(res, err)
  }
})

router.get('/me/recent', protect, async (req, res) => {
  try {
    const recent = await getRecent(req.user._id)
    res.json({ success: true, recent })
  } catch (err) {
    sendServiceError(res, err)
  }
})

router.post('/me/recent', protect, validateBody(recordRecentSchema), async (req, res) => {
  try {
    const recent = await recordRecent(req.user._id, req.body.navItemId)
    res.json({ success: true, recent })
  } catch (err) {
    sendServiceError(res, err)
  }
})

router.delete('/me/recent', protect, async (req, res) => {
  try {
    const recent = await clearRecent(req.user._id)
    res.json({ success: true, recent })
  } catch (err) {
    sendServiceError(res, err)
  }
})

module.exports = router
