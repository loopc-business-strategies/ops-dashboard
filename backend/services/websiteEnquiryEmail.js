const { sendMail } = require('./mailer')

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

function buildEnquiryRows(enquiry) {
  const createdAt = enquiry.createdAt ? new Date(enquiry.createdAt) : new Date()
  const optional = [
    ['Company', enquiry.company],
    ['Email', enquiry.email],
    ['Requirement', enquiry.requirement],
    ['Message', enquiry.message],
  ].filter(([, value]) => value)
  return [
    ['Name', enquiry.name],
    ['Phone', enquiry.phone],
    ['Enquiry Type', enquiry.enquiryType],
    ['Source', String(enquiry.source || 'website').toUpperCase()],
    ['Date/Time', `${createdAt.toLocaleString('en-GB', { timeZone: 'Asia/Tashkent' })} (Tashkent)`],
    ...optional,
  ]
}

async function sendWebsiteEnquiryNotification(enquiry) {
  const to = process.env.WEBSITE_ENQUIRY_NOTIFY_EMAIL
  const rows = buildEnquiryRows(enquiry)
  const subject = 'New Website Enquiry'
  const heading = 'NEW WEBSITE ENQUIRY'

  const text = [heading, '', ...rows.map(([label, value]) => `${label}: ${value}`)].join('\n')
  const html = [
    `<h2 style="font-family:Arial,sans-serif">${heading}</h2>`,
    '<table style="font-family:Arial,sans-serif;font-size:14px;border-collapse:collapse">',
    ...rows.map(([label, value]) => (
      `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">${escapeHtml(label)}:</td>`
      + `<td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
    )),
    '</table>',
  ].join('')

  return sendMail({ to, subject, text, html })
}

module.exports = {
  sendWebsiteEnquiryNotification,
  buildEnquiryRows,
}
