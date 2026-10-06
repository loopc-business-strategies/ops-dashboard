const ENQUIRY_STATUSES = ['NEW', 'CONTACTED', 'FOLLOW_UP', 'QUOTATION', 'WON', 'LOST']

const ENQUIRY_TYPE_CODES = {
  sell_gold: 'Sell Gold',
  buy_gold: 'Buy Gold / Jewellery',
  wholesale: 'Wholesale / Bulk Order',
  custom_jewellery: 'Custom Jewellery',
  partnership: 'Partnership',
  other: 'Other',
}

const ENQUIRY_TYPES = Object.values(ENQUIRY_TYPE_CODES)

function resolveEnquiryType(value) {
  return ENQUIRY_TYPE_CODES[value] || value
}

module.exports = {
  ENQUIRY_STATUSES,
  ENQUIRY_TYPE_CODES,
  ENQUIRY_TYPES,
  resolveEnquiryType,
}
