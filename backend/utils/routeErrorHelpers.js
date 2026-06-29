const { getTransactionWorkflowErrorStatus } = require('./transactionWorkflowHelpers')

let captureException = () => {}
try {
  const Sentry = require('@sentry/node')
  if (String(process.env.SENTRY_DSN || '').trim()) {
    captureException = (err) => Sentry.captureException(err)
  }
} catch {
  // @sentry/node optional in some test environments
}

function getRouteErrorStatus(err) {
  if (err?.status && Number.isFinite(err.status)) return err.status
  if (err?.name === 'CastError') return 400
  const message = String(err?.message || '')
  return getTransactionWorkflowErrorStatus(message)
}

function getSafeClientMessage(err, defaultMessage) {
  if (err?.status && err?.message) return String(err.message)
  const message = String(err?.message || '').trim()
  const status = getRouteErrorStatus(err)
  if (status !== 500 && message) return message
  return defaultMessage
}

function respondRouteError(res, err, { tag = 'route', defaultMessage = 'Server error' } = {}) {
  const status = getRouteErrorStatus(err)
  const message = getSafeClientMessage(err, defaultMessage)

  if (status === 500) {
    console.error(`[${tag}]`, err)
    captureException(err)
  }

  return res.status(status).json({
    success: false,
    message,
    ...(err?.code ? { code: err.code } : {}),
    ...(err?.details ? { details: err.details } : {}),
  })
}

module.exports = {
  getRouteErrorStatus,
  respondRouteError,
}
