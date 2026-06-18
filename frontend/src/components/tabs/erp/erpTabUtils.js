const createInventoryMappingForm = () => ({
  mainStock: 'gold',
  customMainStock: '',
  metalType: 'gold',
  stockCode: '',
  unit: 'grams',
  currency: 'USD',
  currentPrice: '',
  priceUnit: 'OZ',
  priceCurrency: 'USD',
})

const createInventoryProductForm = () => ({
  stockTypeId: '',
  categoryName: '',
  name: '',
  description: '',
  weight: '',
  grossWeight: '',
  purity: '',
  taxType: 'VAT',
  vatPercent: '',
})

const DEFAULT_INVENTORY_STOCK_CODE_SETTINGS = {
  format: 'metal-purity',
  prefix: 'RM',
}

const resolveMainStockValueFromForm = (form) => {
  if (form.mainStock === 'custom') {
    return String(form.customMainStock || '').trim().toLowerCase()
  }
  return String(form.mainStock || '').trim().toLowerCase()
}

const getMainStockPrefix = (mainStockValue, metalTypeValue) => {
  const normalizedMain = String(mainStockValue || '').trim().toLowerCase()
  const normalizedMetal = String(metalTypeValue || '').trim().toLowerCase()
  if (normalizedMain === 'gold' || normalizedMetal === 'gold') return 'GOLD'
  if (normalizedMain === 'silver' || normalizedMetal === 'silver') return 'SILV'
  if (normalizedMain === 'platinum' || normalizedMetal === 'platinum') return 'PLAT'

  const fallback = (normalizedMain || normalizedMetal || 'STK').replace(/[^a-z0-9]/gi, '').toUpperCase()
  return (fallback || 'STK').slice(0, 4)
}

const buildAutoStockCode = (form, settings = DEFAULT_INVENTORY_STOCK_CODE_SETTINGS) => {
  const mainStockValue = resolveMainStockValueFromForm(form)
  const prefix = getMainStockPrefix(mainStockValue, form.metalType)
  const baseCode = prefix

  if (settings?.format !== 'prefix-metal-purity') {
    return baseCode
  }

  const normalizedPrefix = String(settings?.prefix || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  if (!normalizedPrefix) return baseCode
  return `${normalizedPrefix}-${baseCode}`
}

const buildUniqueStockCode = (baseCode, products = [], editingId = '') => {
  const normalizedBase = String(baseCode || '').trim().toUpperCase()
  if (!normalizedBase) return ''

  const existing = new Set(
    products
      .filter((item) => String(item._id || '') !== String(editingId || ''))
      .map((item) => String(item.sku || '').trim().toUpperCase())
      .filter(Boolean)
  )

  if (!existing.has(normalizedBase)) return normalizedBase
  let index = 2
  while (existing.has(`${normalizedBase}-${index}`)) {
    index += 1
  }
  return `${normalizedBase}-${index}`
}

const encodeInventoryCategoryMeta = (meta) => {
  const parts = {
    mainStock: String(meta.mainStock || '').trim().toLowerCase(),
    metalType: String(meta.metalType || '').trim().toLowerCase(),
  }
  if (meta.priceUnit) parts.priceUnit = String(meta.priceUnit).trim().toUpperCase()
  if (meta.priceCurrency) parts.priceCurrency = String(meta.priceCurrency).trim().toUpperCase()
  return Object.entries(parts).map(([k, v]) => `${k}=${v}`).join(';')
}

const decodeInventoryCategoryMeta = (category) => {
  const raw = String(category || '')
  const meta = {}
  raw.split(';').forEach((pair) => {
    const [key, ...rest] = pair.split('=')
    if (!key || rest.length === 0) return
    meta[key.trim()] = rest.join('=').trim()
  })
  return {
    mainStock: String(meta.mainStock || '').toLowerCase(),
    itemType: String(meta.itemType || '').toLowerCase(),
    metalType: String(meta.metalType || '').toLowerCase(),
    purity: String(meta.purity || ''),
  }
}

const decodeInventoryCategoryPairs = (category) => {
  const raw = String(category || '')
  const meta = {}
  raw.split(';').forEach((pair) => {
    const [key, ...rest] = pair.split('=')
    if (!key || rest.length === 0) return
    meta[key.trim()] = rest.join('=').trim()
  })
  return meta
}

const formatVatPercent = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return `${Number(numeric.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

const titleCaseWords = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim()

function getTransactionTypeLabels(t) {
  return {
    expense: t('expense'),
    sale: t('salesInvoice'),
    purchase: t('purchase'),
    receipt: t('receipt'),
    payment: t('payment'),
    payroll: t('payroll'),
  }
}

function getTransactionActionLabels(t) {
  return {
    create: t('created'),
    update: t('updated'),
    delete: t('deleted'),
    submit: t('submitted'),
    approve: t('approved'),
    post: t('posted'),
    return: t('returnedForEdit'),
    reject: t('rejected'),
    comment: t('commented'),
    upload_attachment: t('attachmentUploaded'),
    delete_attachment: t('attachmentDeleted'),
  }
}

const resolveTransactionAttachmentUrl = (attachment) => {
  if (!attachment) return '#'
  if (attachment.url) return attachment.url
  if (attachment.relativePath) return `${import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || ''}${attachment.relativePath}`
  return '#'
}

const createTransactionForm = () => ({
  type: 'expense',
  metalFixStatus: 'fixed',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  currency: 'USD',
  exchangeRate: '1',
  description: '',
  customerId: '',
  vendorId: '',
  inventoryItemId: '',
  mappingId: '',
  debitAccountId: '',
  creditAccountId: '',
})

const accountLookupText = (account) => {
  const code = String(account?.accountCode || '').trim()
  const name = String(account?.accountName || '').trim()
  return [code, name].filter(Boolean).join(' - ')
}

const resolveAccountIdFromInput = (inputValue, accountOptions = []) => {
  const value = String(inputValue || '').trim()
  if (!value) return ''

  const byId = accountOptions.find((account) => String(account?._id || '') === value)
  if (byId) return String(byId._id)

  const normalized = value.toLowerCase()
  const exactCode = accountOptions.find((account) => String(account?.accountCode || '').trim().toLowerCase() === normalized)
  if (exactCode) return String(exactCode._id)

  const exactLabel = accountOptions.find((account) => accountLookupText(account).toLowerCase() === normalized)
  if (exactLabel) return String(exactLabel._id)

  return ''
}

function erpTabNeedsLiveMetalRates(tab) {
  return tab === 'enquiry'
    || tab === 'customer-margin'
    || tab === 'supplier-margin'
    || tab === 'inventory'
    || tab === 'fixing-register'
    || tab === 'dashboard'
}

export {
  DEFAULT_INVENTORY_STOCK_CODE_SETTINGS,
  accountLookupText,
  buildAutoStockCode,
  buildUniqueStockCode,
  createInventoryMappingForm,
  createInventoryProductForm,
  createTransactionForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  encodeInventoryCategoryMeta,
  erpTabNeedsLiveMetalRates,
  formatVatPercent,
  getTransactionActionLabels,
  getTransactionTypeLabels,
  resolveAccountIdFromInput,
  resolveMainStockValueFromForm,
  resolveTransactionAttachmentUrl,
  titleCaseWords,
}