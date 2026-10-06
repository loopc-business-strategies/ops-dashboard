// Outbound email over SMTP. All credentials come from env vars; when SMTP is not
// configured, sendMail resolves with { skipped: true } so callers never fail on email.

const nodemailer = require('nodemailer')

let cachedTransport = null
let cachedKey = ''

function readSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim()
  const user = String(process.env.SMTP_USER || '').trim()
  const pass = String(process.env.SMTP_PASS || '')
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = String(process.env.SMTP_SECURE || (port === 465 ? 'true' : 'false')).toLowerCase() === 'true'
  const from = String(process.env.SMTP_FROM || user).trim()
  return { host, user, pass, port, secure, from }
}

function isMailerConfigured() {
  const { host, from } = readSmtpConfig()
  return Boolean(host && from)
}

function getTransport(config) {
  const key = `${config.host}:${config.port}:${config.secure}:${config.user}`
  if (!cachedTransport || cachedKey !== key) {
    cachedTransport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    })
    cachedKey = key
  }
  return cachedTransport
}

async function sendMail({ to, subject, text, html }) {
  const config = readSmtpConfig()
  const recipients = String(Array.isArray(to) ? to.join(',') : to || '')
    .split(',')
    .map((addr) => addr.trim())
    .filter(Boolean)

  if (!config.host || !config.from) {
    console.warn('[mailer] SMTP is not configured; skipping email:', subject)
    return { skipped: true }
  }
  if (!recipients.length) {
    console.warn('[mailer] No recipients; skipping email:', subject)
    return { skipped: true }
  }

  const info = await getTransport(config).sendMail({
    from: config.from,
    to: recipients.join(', '),
    subject,
    text,
    html,
  })
  return { skipped: false, messageId: info.messageId }
}

module.exports = {
  sendMail,
  isMailerConfigured,
}
