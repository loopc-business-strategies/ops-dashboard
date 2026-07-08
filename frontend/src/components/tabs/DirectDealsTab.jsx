import { useCallback, useEffect, useMemo, useState } from 'react'
import erpAccountingAPI from '../../api/erp-accounting'
import { useLanguage } from '../../context/LanguageContext'
import { getTenantBranding, isMasterDocumentSettingsEnabled } from '../../config/tenantBranding'
import { resolveVoucherPrintSettings } from './erp/documentBranding'
import { createLogoRenderAsset } from './erp/ERPBrandingUtils'

const loadExcel = async () => {
  const mod = await import('exceljs')
  return mod.default || mod
}

const loadPapa = async () => {
  const mod = await import('papaparse')
  return mod.default || mod
}

const loadPdfTools = async () => {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable: autoTableMod.default || autoTableMod }
}

const COLORS = {
  ink: '#111827',
  muted: '#6B7280',
  border: '#D1D5DB',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  green: '#059669',
  red: '#DC2626',
  amber: '#D97706',
  blue: '#2563EB',
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: `1px solid ${COLORS.border}`,
  borderRadius: '0.35rem',
  padding: '0.45rem 0.55rem',
  fontSize: '0.84rem',
  color: COLORS.ink,
  background: COLORS.white,
}

const btnStyle = (variant = 'primary') => {
  const base = {
    border: 'none',
    borderRadius: '0.35rem',
    padding: '0.42rem 0.78rem',
    fontSize: '0.8rem',
    fontWeight: '700',
    cursor: 'pointer',
  }
  if (variant === 'danger') return { ...base, background: '#FEE2E2', color: '#B91C1C' }
  if (variant === 'secondary') return { ...base, background: '#EFF6FF', color: '#1D4ED8' }
  if (variant === 'ghost') return { ...base, background: '#F3F4F6', color: '#111827' }
  return { ...base, background: COLORS.green, color: '#FFFFFF' }
}

// ERP window inline styles
const tbBtnSt = {
  width: 26, height: 22,
  background: 'linear-gradient(180deg,#e8e8e8,#c8c8c8)',
  border: '1px solid #999', borderRadius: 2,
  cursor: 'pointer', fontSize: 12,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  color: '#333', padding: 0,
}
const btmBtnSt = {
  padding: '4px 14px', border: '1px solid #888', borderRadius: 2,
  fontSize: 12, cursor: 'pointer',
  background: 'linear-gradient(180deg,#e8e8e8,#c8c8c8)', color: '#222',
  fontFamily: 'inherit',
}
const erpInpSt = {
  border: '1px solid #999', padding: '4px 8px', fontSize: 12,
  background: '#fff', borderRadius: 1, fontFamily: 'inherit',
  boxSizing: 'border-box',
}
const erpSelSt = {
  border: '1px solid #bbb', padding: '3px 3px', fontSize: 12,
  background: '#fff', fontFamily: 'inherit', cursor: 'pointer',
  width: '100%', boxSizing: 'border-box',
}

const fmtMoney = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQty = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 6 })
const fmtFixed = (v, digits) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
const today = () => new Date().toISOString().slice(0, 10)

const toNumber = (value) => {
  const raw = String(value ?? '').replace(/,/g, '').trim()
  const num = Number(raw)
  return Number.isFinite(num) ? num : 0
}

const customerAccountCode = (customer) => String(customer?.ledgerAccountId?.accountCode || customer?.code || '').trim()
const customerDisplayLabel = (customer) => {
  const code = customerAccountCode(customer)
  return code ? `${code} - ${customer?.name || ''}` : String(customer?.name || '')
}

const normalizeStockCode = (value) => String(value || 'OZ').trim().toUpperCase()
const calcEqOzFromQtyAndStock = (qty, stockCode) => {
  const ratio = stockToOzMap[normalizeStockCode(stockCode)] || 1
  return Number(qty || 0) * ratio
}
const calcAmountFromWeightAndPrice = (qty, stockCode, price) => {
  const eqOz = calcEqOzFromQtyAndStock(qty, stockCode)
  return eqOz * Number(price || 0)
}

const stockToOzMap = { OZ: 1, GRAM: 0.0321507, KG: 32.1507 }

const makeLine = () => ({
  customerId: '',
  customerCode: '',
  customerName: '',
  direction: 'buy',
  metal: 'XAU',
  qty: '',
  stockCode: 'OZ',
  price: '',
  eqOz: '',
  amount: '',
  notes: '',
})

const IMPORT_TEMPLATE_HEADERS = [
  'CustomerCode',
  'CustomerName',
  'Direction',
  'Metal',
  'Qty',
  'StockCode',
  'Price',
  'EqOz',
  'Amount',
  'Notes',
]

const IMPORT_ALLOWED_EXTENSIONS = ['.xlsx', '.csv']
const IMPORT_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
const IMPORT_MAX_ROWS = 2000
const IMPORT_MAX_COLUMNS = 30

const getFileExtension = (fileName = '') => {
  const idx = String(fileName).lastIndexOf('.')
  return idx >= 0 ? String(fileName).slice(idx).toLowerCase() : ''
}

const getWorksheetColumnCount = (worksheet) => {
  if (!worksheet) return 0
  return Number(worksheet.actualColumnCount || worksheet.columnCount || 0)
}

const triggerDownload = (blob, fileName) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const addJsonSheet = (workbook, sheetName, rows) => {
  const worksheet = workbook.addWorksheet(sheetName)
  const normalizedRows = Array.isArray(rows) ? rows : []
  const headers = normalizedRows.length ? Object.keys(normalizedRows[0]) : []
  if (!headers.length) return
  worksheet.addRow(headers)
  normalizedRows.forEach((row) => {
    worksheet.addRow(headers.map((header) => row[header]))
  })
}

const worksheetToRows = (worksheet) => {
  if (!worksheet || worksheet.rowCount < 1) return []
  const headerValues = worksheet.getRow(1).values || []
  const headers = headerValues
    .slice(1)
    .map((h) => String(h ?? '').trim())

  if (!headers.length || headers.every((h) => !h)) return []

  const rows = []
  for (let i = 2; i <= worksheet.rowCount; i += 1) {
    const values = (worksheet.getRow(i).values || []).slice(1)
    const mapped = {}
    let hasAnyValue = false
    headers.forEach((header, idx) => {
      if (!header) return
      const value = values[idx]
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        hasAnyValue = true
      }
      mapped[header] = value ?? ''
    })
    if (hasAnyValue) rows.push(mapped)
  }
  return rows
}

export default function DirectDealsTab({
  token,
  customers = [],
  currencies: _currencies = [],
  canManage = false,
  isSuperAdmin = false,
  user = null,
  reportBranding = null,
}) {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [deals, setDeals] = useState([])
  const [summary, setSummary] = useState({ totalQty: 0, totalAmount: 0, fixing: 0, nonFixing: 0 })
  const [permissions, setPermissions] = useState({ canManage })

  const [filters, setFilters] = useState({
    search: '',
    entryType: '',
    status: '',
    startDate: '',
    endDate: '',
  })

  const [editingId, setEditingId] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [viewMode, setViewMode] = useState('VIEW') // 'VIEW' | 'EDIT'
  const [currentDealIdx, setCurrentDealIdx] = useState(-1)
  const [importPreviewRows, setImportPreviewRows] = useState([])
  const [importPreviewFileName, setImportPreviewFileName] = useState('')
  const [form, setForm] = useState({
    docNo: '',
    entryType: 'fixing',
    docDate: today(),
    valueDate: today(),
    currency: 'USD',
    branch: 'HO',
    status: 'draft',
    remarks: '',
    lineItems: [makeLine()],
  })

  const hasManage = permissions.canManage || canManage
  const currentEditingDeal = editingId ? deals.find((d) => d._id === editingId) : null
  const isEditingLocked = Boolean(currentEditingDeal && currentEditingDeal.status === 'confirmed' && !isSuperAdmin)

  const loadDeals = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await erpAccountingAPI.getDirectDeals(token, {
        ...filters,
        page: 1,
        limit: 200,
      })
      setDeals(res.deals || [])
      setSummary({
        totalQty: Number(res.summary?.totalQty || 0),
        totalAmount: Number(res.summary?.totalAmount || 0),
        fixing: Number(res.summary?.fixing || 0),
        nonFixing: Number(res.summary?.nonFixing || 0),
      })
      setPermissions({ canManage: Boolean(res.permissions?.canManage) })
    } catch (e) {
      setError(e.response?.data?.message || t('failedToLoadDirectDeals'))
    } finally {
      setLoading(false)
    }
  }, [token, filters, t])

  useEffect(() => { loadDeals() }, [loadDeals])

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const formTotals = useMemo(() => {
    const totalQty = form.lineItems.reduce((sum, line) => sum + toNumber(line.qty), 0)
    const totalAmount = form.lineItems.reduce((sum, line) => {
      const qty = toNumber(line.qty)
      const price = toNumber(line.price)
      const stockCode = normalizeStockCode(line.stockCode)
      return sum + toNumber(line.amount || calcAmountFromWeightAndPrice(qty, stockCode, price))
    }, 0)
    return { totalQty, totalAmount }
  }, [form.lineItems])

  const importPreviewStats = useMemo(() => {
    const total = importPreviewRows.length
    const invalid = importPreviewRows.filter((row) => row.validationError).length
    return { total, valid: total - invalid, invalid }
  }, [importPreviewRows])

  const validateImportedRow = (row, idx) => {
    const direction = String(row.direction || '').trim().toLowerCase()
    const qty = Number(row.qty || 0)
    const price = Number(row.price || 0)

    if (!['buy', 'sell'].includes(direction)) {
      return `Row ${idx + 1}: Direction must be Buy or Sell`
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return `Row ${idx + 1}: Qty must be greater than zero`
    }
    if (!Number.isFinite(price) || price <= 0) {
      return `Row ${idx + 1}: Price must be greater than zero`
    }
    return ''
  }

  const normalizePreviewRow = (row, idx) => {
    const customerCode = String(row.customerCode || '').trim()
    const customerName = String(row.customerName || '').trim()
    const matchedCustomer = customers.find((c) => {
      const byCode = customerCode && customerAccountCode(c).toLowerCase() === customerCode.toLowerCase()
      const byName = customerName && String(c.name || '').trim().toLowerCase() === customerName.toLowerCase()
      const byId = row.customerId && String(c._id) === String(row.customerId)
      return byCode || byName || byId
    })
    const qty = Number(row.qty || 0)
    const stockCode = normalizeStockCode(row.stockCode)
    const price = Number(row.price || 0)
    const eqOz = Number(row.eqOz || calcEqOzFromQtyAndStock(qty, stockCode) || 0)
    const amount = Number(row.amount || (eqOz * price) || 0)

    const normalized = {
      rowNo: row.rowNo || idx + 2,
      customerId: matchedCustomer?._id || row.customerId || '',
      customerCode: customerCode || customerAccountCode(matchedCustomer) || '',
      customerName: customerName || matchedCustomer?.name || '',
      direction: String(row.direction || '').toLowerCase(),
      metal: String(row.metal || 'XAU').toUpperCase(),
      qty: String(row.qty || ''),
      stockCode,
      price: String(row.price || ''),
      eqOz: String(Number.isFinite(eqOz) ? Number(eqOz.toFixed(3)) : ''),
      amount: String(Number.isFinite(amount) ? Number(amount.toFixed(2)) : ''),
      notes: String(row.notes || '').trim(),
    }

    return {
      ...normalized,
      validationError: validateImportedRow(normalized, idx),
    }
  }

  const openCreateModal = () => {
    const year = new Date().getFullYear()
    const maxSeq = deals.reduce((max, deal) => {
      const match = String(deal.docNo || '').match(/^ORD\/(\d{4})\/(\d{6})$/)
      if (!match) return max
      if (Number(match[1]) !== year) return max
      return Math.max(max, Number(match[2]))
    }, 0)
    const nextDocNo = `ORD/${year}/${String(maxSeq + 1).padStart(6, '0')}`

    resetForm()
    setForm((prev) => ({ ...prev, docNo: nextDocNo }))
    setViewMode('EDIT')
    setCurrentDealIdx(-1)
    setShowModal(true)
  }

  const updateLine = (idx, key, value) => {
    setForm((prev) => {
      const next = prev.lineItems.map((line, i) => {
        if (i !== idx) return line
        const updated = { ...line, [key]: value }
        if (key === 'customerId') {
          const customer = customers.find((c) => String(c._id) === String(value))
          if (customer) {
            updated.customerCode = customerAccountCode(customer)
            updated.customerName = customer.name || ''
          }
        }
        if (key === 'qty' || key === 'price' || key === 'stockCode') {
          const qty = toNumber(updated.qty)
          const price = toNumber(updated.price)
          const stock = normalizeStockCode(updated.stockCode)
          const eqOz = calcEqOzFromQtyAndStock(qty, stock)
          const amount = calcAmountFromWeightAndPrice(qty, stock, price)
          updated.eqOz = eqOz ? eqOz.toFixed(3) : ''
          updated.amount = amount ? amount.toFixed(2) : ''
        }
        return updated
      })
      return { ...prev, lineItems: next }
    })
  }

  const formatLineNumber = (idx, key, digits) => {
    setForm((prev) => {
      const next = prev.lineItems.map((line, i) => {
        if (i !== idx) return line
        const num = toNumber(line[key])
        return { ...line, [key]: num ? fmtFixed(num, digits) : '' }
      })
      return { ...prev, lineItems: next }
    })
  }

  const addLine = () => setForm((prev) => ({ ...prev, lineItems: [...prev.lineItems, makeLine()] }))
  const removeLine = (idx) => setForm((prev) => ({ ...prev, lineItems: prev.lineItems.filter((_, i) => i !== idx) || [makeLine()] }))

  const resetForm = () => {
    setEditingId('')
    setForm({
      docNo: '',
      entryType: 'fixing',
      docDate: today(),
      valueDate: today(),
      currency: 'USD',
      branch: 'HO',
      status: 'draft',
      remarks: '',
      lineItems: [makeLine()],
    })
  }

  const clearImportPreview = () => {
    setImportPreviewRows([])
    setImportPreviewFileName('')
  }

  const updatePreviewRow = (idx, key, value) => {
    setImportPreviewRows((prev) => {
      const next = prev.map((row, i) => {
        if (i !== idx) return row
        const updated = { ...row, [key]: value }
        if (key === 'customerCode') {
          const matchedCustomer = customers.find((c) => String(c.code || '').toLowerCase() === String(value || '').trim().toLowerCase())
          if (matchedCustomer) {
            updated.customerId = matchedCustomer._id
            updated.customerName = matchedCustomer.name || updated.customerName
          }
        }
        if (key === 'qty' || key === 'price') {
          const qty = Number(key === 'qty' ? value : updated.qty || 0)
          const price = Number(key === 'price' ? value : updated.price || 0)
          const amount = qty * price
          updated.amount = amount ? String(Number(amount.toFixed(2))) : ''
          if (!updated.eqOz) updated.eqOz = updated.qty
        }
        return normalizePreviewRow(updated, i)
      })
      return next
    })
  }

  const applyImportPreviewToForm = () => {
    if (!importPreviewRows.length) {
      setError('No preview rows to apply')
      return
    }
    const invalidRows = importPreviewRows.filter((row) => row.validationError)
    if (invalidRows.length) {
      setError(`Please fix ${invalidRows.length} invalid row(s) before applying.`)
      return
    }

    const parsedLines = importPreviewRows.map((row) => ({
      customerId: row.customerId,
      customerCode: row.customerCode,
      customerName: row.customerName,
      direction: row.direction,
      metal: row.metal,
      qty: row.qty,
      stockCode: row.stockCode,
      price: row.price,
      eqOz: row.eqOz,
      amount: row.amount,
      notes: row.notes,
    }))

    setForm((prev) => ({ ...prev, lineItems: parsedLines }))
    showSuccess(`Applied ${parsedLines.length} line(s) from import preview`)
    clearImportPreview()
  }

  const exportDealToExcel = async (deal) => {
    const headerRows = [
      { Field: 'Doc No', Value: deal.docNo || '' },
      { Field: 'Entry Type', Value: deal.entryType === 'fixing' ? 'Fixing' : 'Non-Fixing' },
      { Field: 'Doc Date', Value: deal.docDate ? String(deal.docDate).slice(0, 10) : '' },
      { Field: 'Value Date', Value: deal.valueDate ? String(deal.valueDate).slice(0, 10) : '' },
      { Field: 'Currency', Value: deal.currency || '' },
      { Field: 'Branch', Value: deal.branch || '' },
      { Field: 'Status', Value: deal.status || '' },
      { Field: 'Remarks', Value: deal.remarks || '' },
      { Field: 'Total Qty', Value: Number(deal.totalQty || 0) },
      { Field: 'Total Amount', Value: Number(deal.totalAmount || 0) },
    ]

    const lineRows = (deal.lineItems || []).map((line, idx) => ({
      No: idx + 1,
      CustomerCode: line.customerCode || '',
      CustomerName: line.customerName || line.customerId?.name || '',
      Direction: String(line.direction || '').toUpperCase(),
      Metal: line.metal || '',
      Qty: Number(line.qty || 0),
      StockCode: line.stockCode || '',
      Price: Number(line.price || 0),
      EqOz: Number(line.eqOz || 0),
      Amount: Number(line.amount || 0),
      Notes: line.notes || '',
    }))

    const ExcelJS = await loadExcel()
    const wb = new ExcelJS.Workbook()
    addJsonSheet(wb, 'Deal Summary', headerRows)
    addJsonSheet(wb, 'Line Items', lineRows)
    const buffer = await wb.xlsx.writeBuffer()
    triggerDownload(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `direct-deal-${deal.docNo || deal._id}.xlsx`)
  }

  const exportDealToPdf = async (deal) => {
    const { jsPDF, autoTable } = await loadPdfTools()
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const tenantKey = String(user?.company || user?.tenant?.key || '').trim().toLowerCase()
    const tenantBranding = getTenantBranding(tenantKey)
    const voucherSettings = resolveVoucherPrintSettings({ reportBranding, user, tenantBranding })
    const useBrandedHeader = isMasterDocumentSettingsEnabled(tenantKey) && voucherSettings.enabled

    let startY = 36
    if (useBrandedHeader) {
      const leftX = 40
      const rightX = 560
      pdf.setFontSize(13)
      pdf.setFont(undefined, 'bold')
      pdf.text(voucherSettings.companyName || 'Company', leftX, 34)
      pdf.setFont(undefined, 'normal')
      pdf.setFontSize(9)
      const addressLines = String(voucherSettings.address || '').split('\n').filter(Boolean)
      addressLines.forEach((line, index) => {
        pdf.text(line, leftX, 50 + (index * 12))
      })
      const contactY = 50 + (addressLines.length * 12)
      if (voucherSettings.phone) pdf.text(`Phone: ${voucherSettings.phone}`, leftX, contactY)
      if (voucherSettings.trn) pdf.text(`TRN: ${voucherSettings.trn}`, leftX, contactY + 12)

      if (voucherSettings.logoUrl) {
        const renderedLogo = await createLogoRenderAsset(
          voucherSettings.logoUrl,
          voucherSettings.logoWidth,
          voucherSettings.logoHeight,
          voucherSettings.logoFit,
        )
        if (renderedLogo) {
          const logoX = rightX + Number(voucherSettings.voucherPrint?.logoOffsetX || 0)
          const logoY = 18 + Number(voucherSettings.voucherPrint?.logoOffsetY || 0)
          pdf.addImage(
            renderedLogo,
            'PNG',
            logoX,
            logoY,
            Number(voucherSettings.logoWidth || 120),
            Number(voucherSettings.logoHeight || 56),
          )
        }
      }
      startY = Math.max(88, contactY + 28)
      pdf.setDrawColor(17, 24, 39)
      pdf.setLineWidth(1)
      pdf.line(40, startY - 10, 800, startY - 10)
    }

    pdf.setFontSize(14)
    pdf.text('Fixing Deal Voucher', 40, startY)
    pdf.setFontSize(10)
    pdf.text(`Doc No: ${deal.docNo || '-'}`, 40, startY + 20)
    pdf.text(`Type: ${deal.entryType === 'fixing' ? 'Fixing' : 'Non-Fixing'}`, 220, startY + 20)
    pdf.text(`Doc Date: ${deal.docDate ? String(deal.docDate).slice(0, 10) : '-'}`, 380, startY + 20)
    pdf.text(`Value Date: ${deal.valueDate ? String(deal.valueDate).slice(0, 10) : '-'}`, 560, startY + 20)
    pdf.text(`Branch: ${deal.branch || '-'}`, 40, startY + 36)
    pdf.text(`Currency: ${deal.currency || '-'}`, 220, startY + 36)
    pdf.text(`Status: ${deal.status || '-'}`, 380, startY + 36)
    pdf.text(`Total Qty: ${fmtQty(deal.totalQty)}`, 40, startY + 52)
    pdf.text(`Total Amount: ${deal.currency || 'USD'} ${fmtMoney(deal.totalAmount)}`, 220, startY + 52)

    autoTable(pdf, {
      startY: startY + 68,
      head: [['#', 'Customer', 'Direction', 'Metal', 'Qty', 'Stock', 'Price', 'Eq.OZ', 'Amount']],
      body: (deal.lineItems || []).map((line, idx) => [
        idx + 1,
        `${line.customerCode || ''} ${line.customerName || line.customerId?.name || ''}`.trim(),
        String(line.direction || '').toUpperCase(),
        line.metal || '',
        fmtQty(line.qty),
        line.stockCode || '',
        fmtMoney(line.price),
        fmtQty(line.eqOz),
        fmtMoney(line.amount),
      ]),
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 36, right: 36 },
    })

    if (deal.remarks) {
      const y = pdf.lastAutoTable ? pdf.lastAutoTable.finalY + 16 : 130
      pdf.setFontSize(9)
      pdf.text(`Remarks: ${deal.remarks}`, 40, y)
    }
    pdf.save(`direct-deal-${deal.docNo || deal._id}.pdf`)
  }

  const handleBulkImport = async (file) => {
    if (!file) return
    if (!hasManage) {
      setError('You have read-only access for direct deals')
      return
    }

    const extension = getFileExtension(file.name)
    if (!IMPORT_ALLOWED_EXTENSIONS.includes(extension)) {
      setError('Invalid file type. Please upload only .xlsx or .csv files.')
      return
    }

    if (file.size > IMPORT_MAX_FILE_SIZE_BYTES) {
      setError(`File is too large. Maximum allowed size is ${Math.round(IMPORT_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`)
      return
    }

    try {
      setSaving(true)
      setError('')
      let rows = []

      if (extension === '.csv') {
        const Papa = await loadPapa()
        const csvText = await file.text()
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header) => String(header || '').trim(),
        })
        if (parsed.errors?.length) {
          setError(`Failed to parse CSV: ${parsed.errors[0].message}`)
          setSaving(false)
          return
        }
        const firstRow = parsed.data?.[0] || {}
        const columnCount = Object.keys(firstRow).length
        if (columnCount > IMPORT_MAX_COLUMNS) {
          setError(`Import has too many columns (${columnCount}). Maximum supported columns: ${IMPORT_MAX_COLUMNS}.`)
          setSaving(false)
          return
        }
        rows = parsed.data || []
      } else {
        const ExcelJS = await loadExcel()
        const data = await file.arrayBuffer()
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(data)
        const worksheet = workbook.worksheets[0]
        if (!worksheet) {
          setError('Import file has no worksheet')
          setSaving(false)
          return
        }
        const columnCount = getWorksheetColumnCount(worksheet)
        if (columnCount > IMPORT_MAX_COLUMNS) {
          setError(`Import has too many columns (${columnCount}). Maximum supported columns: ${IMPORT_MAX_COLUMNS}.`)
          setSaving(false)
          return
        }
        rows = worksheetToRows(worksheet)
      }

      if (!rows.length) {
        setError('Import file is empty')
        setSaving(false)
        return
      }

      if (rows.length > IMPORT_MAX_ROWS) {
        setError(`Import has too many rows (${rows.length}). Maximum supported rows: ${IMPORT_MAX_ROWS}.`)
        setSaving(false)
        return
      }

      const previewRows = rows.map((row, idx) => normalizePreviewRow({
        rowNo: idx + 2,
        customerCode: String(row.CustomerCode || row.customerCode || '').trim(),
        customerName: String(row.CustomerName || row.customerName || '').trim(),
        direction: String(row.Direction || row.direction || '').toLowerCase(),
        metal: String(row.Metal || row.metal || 'XAU').toUpperCase(),
        qty: String(row.Qty || row.qty || ''),
        stockCode: String(row.StockCode || row.stockCode || 'OZ').toUpperCase(),
        price: String(row.Price || row.price || ''),
        eqOz: String(row.EqOz || row.eqOz || row.Qty || row.qty || ''),
        amount: String(row.Amount || row.amount || ''),
        notes: String(row.Notes || row.notes || '').trim(),
      }, idx))

      setImportPreviewRows(previewRows)
      setImportPreviewFileName(file.name || 'import-file')
      showSuccess(`Loaded ${previewRows.length} row(s) into Import Preview. Fix errors if any, then apply.`)
    } catch (e) {
      setError(e.message || 'Failed to import file')
    } finally {
      setSaving(false)
    }
  }

  const downloadCsvTemplate = () => {
    const sampleRows = [
      ['GC0007', 'Sample Gold Client', 'Buy', 'XAU', '20000', 'OZ', '2647.0000', '20000', '52940000', 'Sample buy row'],
      ['AS0001', 'Sample Silver Client', 'Sell', 'XAU', '15000', 'OZ', '2659.6600', '15000', '39894900', 'Sample sell row'],
    ]
    const lines = [
      IMPORT_TEMPLATE_HEADERS.join(','),
      ...sampleRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'direct-deals-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const downloadXlsxTemplate = async () => {
    const sampleRows = [
      {
        CustomerCode: 'GC0007',
        CustomerName: 'Sample Gold Client',
        Direction: 'Buy',
        Metal: 'XAU',
        Qty: 20000,
        StockCode: 'OZ',
        Price: 2647.0,
        EqOz: 20000,
        Amount: 52940000,
        Notes: 'Sample buy row',
      },
      {
        CustomerCode: 'AS0001',
        CustomerName: 'Sample Silver Client',
        Direction: 'Sell',
        Metal: 'XAU',
        Qty: 15000,
        StockCode: 'OZ',
        Price: 2659.66,
        EqOz: 15000,
        Amount: 39894900,
        Notes: 'Sample sell row',
      },
    ]

    const customerRefRows = customers.map((c) => ({
      CustomerCode: c.code || '',
      CustomerName: c.name || '',
      CustomerId: c._id || '',
    }))

    const instructionsRows = [
      { Rule: 'Direction', Value: 'Must be Buy or Sell' },
      { Rule: 'Metal', Value: 'Use XAU, XAG, XPT, XPD (or your configured symbol)' },
      { Rule: 'Qty', Value: 'Must be greater than zero' },
      { Rule: 'Price', Value: 'Must be greater than zero' },
      { Rule: 'Amount', Value: 'Optional. If blank, system uses Qty x Price' },
      { Rule: 'CustomerCode', Value: 'Recommended to match code from Customer Reference sheet' },
    ]

    const ExcelJS = await loadExcel()
    const wb = new ExcelJS.Workbook()
    addJsonSheet(wb, 'Import Template', sampleRows)
    addJsonSheet(wb, 'Instructions', instructionsRows)
    addJsonSheet(wb, 'Customer Reference', customerRefRows.length ? customerRefRows : [{ CustomerCode: '', CustomerName: '', CustomerId: '' }])
    const buffer = await wb.xlsx.writeBuffer()
    triggerDownload(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'direct-deals-import-template.xlsx')
  }

  const openDeal = (deal, idxOverride) => {
    const idx = idxOverride !== undefined ? idxOverride : deals.findIndex((d) => d._id === deal._id)
    setCurrentDealIdx(idx)
    setEditingId(deal._id)
    setViewMode('VIEW')
    setForm({
      docNo: deal.docNo || '',
      entryType: deal.entryType || 'fixing',
      docDate: deal.docDate ? String(deal.docDate).slice(0, 10) : today(),
      valueDate: deal.valueDate ? String(deal.valueDate).slice(0, 10) : today(),
      currency: deal.currency || 'USD',
      branch: deal.branch || 'HO',
      status: deal.status || 'draft',
      remarks: deal.remarks || '',
      lineItems: (deal.lineItems || []).map((line) => ({
        customerId: line.customerId?._id || line.customerId || '',
        customerCode: line.customerCode || '',
        customerName: line.customerName || '',
        direction: line.direction || 'buy',
        metal: line.metal || 'XAU',
        qty: String(line.qty ?? ''),
        stockCode: String(line.stockCode || 'OZ').toUpperCase(),
        price: String(line.price ?? ''),
        eqOz: String(line.eqOz ?? ''),
        amount: String(line.amount ?? ''),
        notes: line.notes || '',
      })),
    })
    setError('')
    setShowModal(true)
  }

  const openDealForEdit = (deal) => {
    openDeal(deal)
    if (hasManage && !(deal.status === 'confirmed' && !isSuperAdmin)) {
      setViewMode('EDIT')
    }
  }

  // Navigate to a deal by index in the deals array
  const navToDeal = (idx) => {
    if (idx < 0 || idx >= deals.length) return
    const deal = deals[idx]
    openDeal(deal, idx)
  }

  const validate = () => {
    if (!form.docDate || !form.valueDate) return 'Doc date and value date are required'
    if (!form.lineItems.length) return 'At least one line item is required'

    for (const [idx, line] of form.lineItems.entries()) {
      if (!line.customerId) return `Line ${idx + 1}: customer is required`
      if (!line.direction || !['buy', 'sell'].includes(line.direction)) return `Line ${idx + 1}: direction must be Buy or Sell`
      if (!line.metal) return `Line ${idx + 1}: metal is required`
      if (toNumber(line.qty) <= 0) return `Line ${idx + 1}: quantity must be greater than zero`
      if (toNumber(line.price) <= 0) return `Line ${idx + 1}: price must be greater than zero`
    }
    return ''
  }

  const saveFormData = async (statusOverride) => {
    if (!hasManage || isEditingLocked) {
      setError('You have read-only access for direct deals')
      return
    }

    const validationMessage = validate()
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        status: statusOverride || form.status,
        lineItems: form.lineItems.map((line) => ({
          ...line,
          qty: toNumber(line.qty),
          stockCode: normalizeStockCode(line.stockCode),
          price: toNumber(line.price),
          eqOz: toNumber(line.eqOz || calcEqOzFromQtyAndStock(toNumber(line.qty), normalizeStockCode(line.stockCode))),
          amount: toNumber(line.amount || calcAmountFromWeightAndPrice(toNumber(line.qty), normalizeStockCode(line.stockCode), toNumber(line.price))),
        })),
      }

      if (editingId) {
        await erpAccountingAPI.updateDirectDeal(token, editingId, payload)
        showSuccess('Direct deal updated successfully')
      } else {
        await erpAccountingAPI.createDirectDeal(token, payload)
        showSuccess('Direct deal created successfully')
      }

      resetForm()
      setShowModal(false)
      await loadDeals()
    } catch (e2) {
      setError(e2.response?.data?.message || 'Failed to save direct deal')
    } finally {
      setSaving(false)
    }
  }

  const removeDeal = async (id) => {
    if (!hasManage) return
    if (typeof window !== 'undefined' && !window.confirm('Delete this direct deal?')) return

    setDeletingId(id)
    setError('')
    try {
      await erpAccountingAPI.deleteDirectDeal(token, id)
      showSuccess('Direct deal deleted')
      if (editingId === id) resetForm()
      await loadDeals()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete direct deal')
    } finally {
      setDeletingId('')
    }
  }

  // Derive ORD badge text from doc number
  const ordBadge = form.docNo
    ? (form.docNo.split('/').pop() || 'ORD')
    : 'ORD'

  return (
    <div>
      {error && <div style={{ background: '#FEE2E2', color: COLORS.red, border: '1px solid #FCA5A5', borderRadius: '0.45rem', padding: '0.6rem 0.75rem', marginBottom: '0.9rem' }}>{error}</div>}
      {success && <div style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: '0.45rem', padding: '0.6rem 0.75rem', marginBottom: '0.9rem' }}>{success}</div>}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.7rem', marginBottom: '1rem' }}>
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', padding: '0.7rem' }}>
          <p style={{ margin: 0, color: COLORS.muted, fontSize: '0.75rem' }}>{t('fixingEntries')}</p>
          <p style={{ margin: '0.25rem 0 0', color: COLORS.ink, fontSize: '1.1rem', fontWeight: 800 }}>{summary.fixing}</p>
        </div>
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', padding: '0.7rem' }}>
          <p style={{ margin: 0, color: COLORS.muted, fontSize: '0.75rem' }}>{t('nonFixingEntries')}</p>
          <p style={{ margin: '0.25rem 0 0', color: COLORS.ink, fontSize: '1.1rem', fontWeight: 800 }}>{summary.nonFixing}</p>
        </div>
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', padding: '0.7rem' }}>
          <p style={{ margin: 0, color: COLORS.muted, fontSize: '0.75rem' }}>{t('totalQty')}</p>
          <p style={{ margin: '0.25rem 0 0', color: COLORS.ink, fontSize: '1.1rem', fontWeight: 800 }}>{fmtQty(summary.totalQty)}</p>
        </div>
        <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', padding: '0.7rem' }}>
          <p style={{ margin: 0, color: COLORS.muted, fontSize: '0.75rem' }}>{t('totalAmount')}</p>
          <p style={{ margin: '0.25rem 0 0', color: COLORS.ink, fontSize: '1.1rem', fontWeight: 800 }}>{form.currency || 'USD'} {fmtMoney(summary.totalAmount)}</p>
        </div>
      </div>

      {/* ── Create Entry button ── */}
      {hasManage && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            style={{ ...btnStyle(), padding: '0.5rem 1.3rem', fontSize: '0.88rem' }}
            onClick={openCreateModal}
          >
            + Create Entry
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════
          ERP CLASSIC WINDOW MODAL
      ══════════════════════════════════════════════ */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 860, maxWidth: '98vw', border: '2px solid #6a8cbf', borderRadius: 4, boxShadow: '4px 4px 18px rgba(0,0,0,.5)', background: '#f0f0f0', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>

            {/* ── Title bar ── */}
            <div style={{ background: 'linear-gradient(180deg,#6a8cbf 0%,#3a5f9a 40%,#2a4f8a 100%)', color: '#fff', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #2a4f8a', flexShrink: 0 }}>
              <div style={{ width: 60 }} />
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'center', letterSpacing: '.3px' }}>Fixing Deals</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {['─', '□'].map((ch) => (
                  <button key={ch} type="button" style={{ width: 18, height: 16, background: 'linear-gradient(180deg,#d0d0d0,#a0a0a0)', border: '1px solid #888', borderRadius: 2, cursor: 'pointer', fontSize: 9, color: '#222', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{ch}</button>
                ))}
                <button type="button" onClick={() => setShowModal(false)} style={{ width: 18, height: 16, background: 'linear-gradient(180deg,#d0d0d0,#a0a0a0)', border: '1px solid #888', borderRadius: 2, cursor: 'pointer', fontSize: 9, color: '#222', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            {/* ── Toolbar ── */}
            <div style={{ background: 'linear-gradient(180deg,#d8d8d8,#c0c0c0)', borderBottom: '2px solid #888', padding: '3px 6px', display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, flexWrap: 'wrap' }}>

              {/* Group 1 — Record Actions */}
              <button type="button" title="New — Open a blank form for a new entry" style={tbBtnSt} onClick={() => { openCreateModal() }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>🗋</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>New</span>
                </span>
              </button>
              <button type="button" title="Edit — Unlock current record for modification" style={{ ...tbBtnSt, color: viewMode === 'EDIT' ? '#005099' : '#333' }} onClick={() => { if (editingId || viewMode === 'EDIT') setViewMode('EDIT') }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>✏️</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Edit</span>
                </span>
              </button>
              <button type="button" title="Delete — Remove the current voucher (asks confirmation)" style={{ ...tbBtnSt, color: '#c00' }} onClick={() => { if (!editingId) { setError('Open an existing entry to delete'); return } removeDeal(editingId); setShowModal(false) }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>🗑</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Del</span>
                </span>
              </button>
              <button type="button" title="Save — Save your data permanently" style={{ ...tbBtnSt, color: '#060' }} onClick={() => saveFormData()} disabled={saving || !hasManage || isEditingLocked || viewMode !== 'EDIT'}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>💾</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Save</span>
                </span>
              </button>
              <button type="button" title="Cancel — Discard unsaved changes" style={tbBtnSt} onClick={() => { if (!editingId) { resetForm(); setShowModal(false) } else { openDeal(deals.find((d) => d._id === editingId)) } }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>↩</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Cancel</span>
                </span>
              </button>

              <div style={{ width: 1, height: 28, background: '#999', margin: '0 3px' }} />

              {/* Group 2 — Navigation */}
              <button type="button" title="|◀ First — Jump to the first voucher" style={tbBtnSt} onClick={() => navToDeal(0)} disabled={deals.length === 0}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>⏮</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>First</span>
                </span>
              </button>
              <button type="button" title="◀ Previous — Go to the previous record" style={tbBtnSt} onClick={() => navToDeal(Math.max(0, currentDealIdx - 1))} disabled={deals.length === 0 || currentDealIdx <= 0}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>◀</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Prev</span>
                </span>
              </button>
              <button type="button" title="▶ Next — Move to the next record" style={tbBtnSt} onClick={() => navToDeal(Math.min(deals.length - 1, currentDealIdx + 1))} disabled={deals.length === 0 || currentDealIdx >= deals.length - 1}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>▶</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Next</span>
                </span>
              </button>
              <button type="button" title="▶| Last — Jump to the latest voucher" style={tbBtnSt} onClick={() => navToDeal(deals.length - 1)} disabled={deals.length === 0}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>⏭</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Last</span>
                </span>
              </button>

              <div style={{ width: 1, height: 28, background: '#999', margin: '0 3px' }} />

              {/* Group 3 — Other Buttons */}
              <button type="button" title="Print/Preview — Print or preview the invoice" style={tbBtnSt} onClick={() => { if (editingId && currentEditingDeal) exportDealToPdf(currentEditingDeal); else showSuccess('Printing...') }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>🖨</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Print</span>
                </span>
              </button>
              <button type="button" title="Search/Find — Search by voucher number, party, or date" style={tbBtnSt} onClick={() => showSuccess('Search mode')}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>🔍</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Search</span>
                </span>
              </button>
              <button type="button" title="Barcode — Scan or view item barcode linked to stock" style={tbBtnSt} onClick={() => showSuccess('Barcode scan')}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, letterSpacing: -1 }}>▌▐</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Barcode</span>
                </span>
              </button>
              <button type="button" title="Post — Confirm and post the voucher" style={{ ...tbBtnSt, color: '#060' }} onClick={() => saveFormData('confirmed')} disabled={saving || !hasManage || isEditingLocked || viewMode !== 'EDIT'}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>✅</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Post</span>
                </span>
              </button>

              <div style={{ width: 1, height: 28, background: '#999', margin: '0 3px' }} />

              {/* Group 4 — Exit */}
              <button type="button" title="Exit — Close the form and return to the main menu" style={{ ...tbBtnSt, color: '#c00' }} onClick={() => { resetForm(); setShowModal(false) }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                  <span style={{ fontSize: 10 }}>🚪</span>
                  <span style={{ fontSize: 7, marginTop: 1 }}>Exit</span>
                </span>
              </button>

              <div style={{ flex: 1 }} />
              <div style={{ background: '#fff', border: '1px solid #ccc', padding: '3px 14px', fontSize: 18, fontWeight: 700, color: '#1a1a1a', borderRadius: 2, minWidth: 70, textAlign: 'center', letterSpacing: 1, fontFamily: 'monospace' }}>
                {ordBadge}
              </div>
            </div>

            {/* ── Body ── */}
            <div style={{ padding: 12, flex: 1, overflowY: 'auto', background: '#f0f0f0' }}>

              {/* Inline errors */}
              {error && (
                <div style={{ background: '#FEE2E2', color: COLORS.red, border: '1px solid #FCA5A5', borderRadius: '0.4rem', padding: '0.5rem 0.65rem', marginBottom: '0.65rem', fontSize: '0.82rem' }}>{error}</div>
              )}
              {/* Mode indicator banner */}
              {viewMode === 'VIEW' && editingId && (
                <div style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '0.4rem', padding: '4px 10px', marginBottom: '0.65rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>👁 VIEW MODE</span>
                  <span style={{ color: '#555', fontWeight: 400 }}>— Click <strong>Edit</strong> in the toolbar to unlock for editing</span>
                </div>
              )}
              {editingId && isEditingLocked && (
                <div style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '0.4rem', padding: '0.5rem 0.65rem', marginBottom: '0.65rem', fontSize: '0.82rem', fontWeight: 700 }}>
                  This entry is confirmed and locked. Only super admin can edit or reopen it.
                </div>
              )}

              {/* Top fields row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, color: '#222', fontWeight: 500, whiteSpace: 'nowrap' }}>Doc No :</label>
                  <input
                    value={form.docNo}
                    onChange={(e) => setForm((prev) => ({ ...prev, docNo: e.target.value }))}
                    style={{ ...erpInpSt, width: 155 }}
                    disabled={viewMode !== 'EDIT' || !hasManage || saving}
                    readOnly
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, color: '#222', fontWeight: 500, whiteSpace: 'nowrap' }}>Doc Date :</label>
                  <input
                    type="date"
                    value={form.docDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, docDate: e.target.value }))}
                    style={{ ...erpInpSt, width: 120 }}
                    disabled={viewMode !== 'EDIT' || !hasManage || saving}
                  />
                  <span style={{ width: 22, height: 22, border: '1px solid #999', borderRadius: 2, background: 'linear-gradient(180deg,#e8e8e8,#c8c8c8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📅</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label style={{ fontSize: 12, color: '#222', fontWeight: 500, whiteSpace: 'nowrap' }}>Value Date :</label>
                  <input
                    type="date"
                    value={form.valueDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, valueDate: e.target.value }))}
                    style={{ ...erpInpSt, width: 120 }}
                    disabled={viewMode !== 'EDIT' || !hasManage || saving}
                  />
                  <span style={{ width: 22, height: 22, border: '1px solid #999', borderRadius: 2, background: 'linear-gradient(180deg,#e8e8e8,#c8c8c8)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📅</span>
                </div>
              </div>

              {/* Customer tab */}
              <div style={{ display: 'flex', marginBottom: 0 }}>
                <div style={{ background: 'linear-gradient(180deg,#7a9a60,#5a7a40)', color: '#fff', padding: '5px 18px', fontSize: 12, fontWeight: 500, border: '1px solid #4a6a30', borderBottom: 'none', borderRadius: '3px 3px 0 0', cursor: 'default' }}>
                  Customer
                </div>
              </div>

              {/* Lines table */}
              <div style={{ border: '2px solid #888', background: '#fff' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed', minWidth: 780 }}>
                    <colgroup>
                      <col style={{ width: 160 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 68 }} />
                      <col style={{ width: 95 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 95 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 34 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: '#4a6a30' }}>
                        {['Customer', 'Direction', 'Metal', 'Qty', 'Stock Code', 'Price', 'EQ.OZ', 'Amount', ''].map((h) => (
                          <th key={h} style={{ padding: '6px 4px', textAlign: 'center', fontSize: 11, fontWeight: 500, color: '#fff', borderRight: '1px solid #5a7a40', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {form.lineItems.map((line, idx) => (
                        <tr key={`line-${idx}`} style={{ borderBottom: '1px solid #ccc', background: '#fff' }}>
                          {/* Customer */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <select
                              value={line.customerId}
                              onChange={(e) => updateLine(idx, 'customerId', e.target.value)}
                              style={{ ...erpSelSt, width: '100%', border: '1px solid #bbb', padding: '3px 4px' }}
                              disabled={viewMode !== 'EDIT' || !hasManage || saving}
                            >
                              <option value="">Select customer</option>
                              {customers.map((customer) => (
                                <option key={customer._id} value={customer._id}>{customerDisplayLabel(customer)}</option>
                              ))}
                            </select>
                          </td>
                          {/* Direction */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <select value={line.direction} onChange={(e) => updateLine(idx, 'direction', e.target.value)} style={erpSelSt} disabled={viewMode !== 'EDIT' || !hasManage || saving}>
                              <option value="buy">Buy</option>
                              <option value="sell">Sell</option>
                            </select>
                          </td>
                          {/* Metal */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <select value={line.metal} onChange={(e) => updateLine(idx, 'metal', e.target.value)} style={erpSelSt} disabled={viewMode !== 'EDIT' || !hasManage || saving}>
                              <option value="XAU">XAU</option>
                              <option value="XAG">XAG</option>
                            </select>
                          </td>
                          {/* Qty */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <input value={line.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} onBlur={() => formatLineNumber(idx, 'qty', 3)} style={{ ...erpInpSt, textAlign: 'right', width: '100%', border: '1px solid #bbb', padding: '4px 5px' }} disabled={viewMode !== 'EDIT' || !hasManage || saving} placeholder="0.000" />
                          </td>
                          {/* Stock Code */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <select value={line.stockCode} onChange={(e) => updateLine(idx, 'stockCode', e.target.value)} style={erpSelSt} disabled={viewMode !== 'EDIT' || !hasManage || saving}>
                              <option value="OZ">OZ</option>
                              <option value="GRAM">Gram</option>
                              <option value="KG">KG</option>
                            </select>
                          </td>
                          {/* Price */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <input value={line.price} onChange={(e) => updateLine(idx, 'price', e.target.value)} onBlur={() => formatLineNumber(idx, 'price', 4)} style={{ ...erpInpSt, textAlign: 'right', width: '100%', border: '1px solid #bbb', padding: '4px 5px' }} disabled={viewMode !== 'EDIT' || !hasManage || saving} placeholder="0.0000" />
                          </td>
                          {/* EQ.OZ */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <input value={line.eqOz ? fmtFixed(line.eqOz, 3) : ''} readOnly style={{ ...erpInpSt, textAlign: 'right', width: '100%', background: '#f5f5f5', border: '1px solid #bbb', padding: '4px 5px' }} tabIndex={-1} />
                          </td>
                          {/* Amount */}
                          <td style={{ padding: '3px 3px', borderRight: '1px solid #ddd' }}>
                            <input value={line.amount ? fmtMoney(line.amount) : ''} readOnly style={{ ...erpInpSt, textAlign: 'right', width: '100%', background: '#f5f5f5', border: '1px solid #bbb', padding: '4px 5px' }} tabIndex={-1} />
                          </td>
                          {/* Delete */}
                          <td style={{ padding: '3px 3px', textAlign: 'center' }}>
                            <button type="button" onClick={() => removeLine(idx)} disabled={viewMode !== 'EDIT' || !hasManage || saving || form.lineItems.length === 1} style={{ width: 24, height: 20, background: 'linear-gradient(180deg,#e0e0e0,#b8b8b8)', border: '1px solid #888', borderRadius: 2, cursor: 'pointer', fontSize: 9, color: '#444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                      {Array.from({ length: Math.max(0, 6 - form.lineItems.length) }).map((_, idx) => (
                        <tr key={`empty-${idx}`} style={{ borderBottom: '1px solid #ccc', background: '#fff' }}>
                          {Array.from({ length: 8 }).map((__, colIdx) => (
                            <td key={`empty-cell-${idx}-${colIdx}`} style={{ height: 22, borderRight: colIdx === 7 ? 'none' : '1px solid #e0e0e0' }} />
                          ))}
                          <td style={{ height: 22 }} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>{/* end body */}

            {/* ── Bottom bar ── */}
            <div style={{ background: 'linear-gradient(180deg,#d8d8d8,#c0c0c0)', borderTop: '2px solid #888', padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" onClick={addLine} style={btmBtnSt} disabled={viewMode !== 'EDIT' || !hasManage || saving}>+ Add Line</button>
                <button type="button" onClick={() => saveFormData()} disabled={saving || viewMode !== 'EDIT' || !hasManage || isEditingLocked} style={btmBtnSt}>💾 Save Draft</button>
                <button type="button" onClick={() => saveFormData('confirmed')} disabled={saving || viewMode !== 'EDIT' || !hasManage || isEditingLocked} style={{ ...btmBtnSt, background: 'linear-gradient(180deg,#7aba70,#4a8a40)', color: '#fff', borderColor: '#3a6a30' }}>✓ Post</button>
                <button type="button" onClick={() => { resetForm(); setShowModal(false) }} style={btmBtnSt}>Cancel</button>
              </div>
              <div style={{ display: 'flex', gap: 20, fontSize: 12, alignItems: 'center' }}>
                <span style={{ background: viewMode === 'EDIT' ? '#D1FAE5' : '#DBEAFE', color: viewMode === 'EDIT' ? '#065F46' : '#1D4ED8', border: `1px solid ${viewMode === 'EDIT' ? '#6EE7B7' : '#BFDBFE'}`, borderRadius: 3, padding: '2px 10px', fontWeight: 700, fontSize: 11, letterSpacing: 1 }}>Mode: {viewMode}</span>
                <span><span style={{ color: '#555' }}>Total Qty: </span><span style={{ fontWeight: 600, color: '#222' }}>{fmtQty(formTotals.totalQty)}</span></span>
                <span><span style={{ color: '#555' }}>Total Amount: {form.currency} </span><span style={{ fontWeight: 600, color: '#222' }}>{fmtMoney(formTotals.totalAmount)}</span></span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Filters + list ── */}
      <div style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '0.55rem', padding: '0.85rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.55rem', marginBottom: '0.7rem' }}>
          <input placeholder='Search doc/customer/metal' value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} style={inputStyle} />
          <select value={filters.entryType} onChange={(e) => setFilters((prev) => ({ ...prev, entryType: e.target.value }))} style={inputStyle}>
            <option value=''>{t('allTypes')}</option>
            <option value='fixing'>{t('fixing')}</option>
            <option value='non_fixing'>{t('nonFixing')}</option>
          </select>
          <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle}>
            <option value=''>{t('all')} {t('status')}</option>
            <option value='draft'>{t('statusDraft')}</option>
            <option value='confirmed'>{t('statusConfirmed')}</option>
          </select>
          <input type='date' value={filters.startDate} onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} style={inputStyle} />
          <input type='date' value={filters.endDate} onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} style={inputStyle} />
          <button type='button' style={btnStyle('ghost')} onClick={loadDeals}>{t('applyFilters')}</button>
        </div>

        <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '0.7rem', flexWrap: 'wrap' }}>
          <button type='button' style={btnStyle('ghost')} onClick={downloadCsvTemplate}>Download CSV Template</button>
          <button type='button' style={btnStyle('ghost')} onClick={downloadXlsxTemplate}>Download XLSX Template</button>
          <label style={{ ...btnStyle('secondary'), display: 'inline-flex', alignItems: 'center' }}>
            Bulk Import Excel/CSV
            <input
              type='file'
              accept='.xlsx,.csv'
              onChange={(e) => handleBulkImport(e.target.files?.[0])}
              style={{ display: 'none' }}
              disabled={!hasManage || saving || isEditingLocked}
            />
          </label>
          <span style={{ color: COLORS.muted, fontSize: '0.78rem', alignSelf: 'center' }}>
            Expected columns: CustomerCode, CustomerName, Direction, Metal, Qty, StockCode, Price, EqOz, Amount, Notes
          </span>
        </div>

        {importPreviewRows.length > 0 && (
          <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: '0.5rem', marginBottom: '0.8rem', background: '#FFFBEB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0.75rem', borderBottom: `1px solid ${COLORS.border}`, flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, color: COLORS.ink, fontWeight: 800, fontSize: '0.86rem' }}>Import Preview: {importPreviewFileName}</p>
                <p style={{ margin: '0.2rem 0 0', color: COLORS.muted, fontSize: '0.77rem' }}>
                  Total: {importPreviewStats.total} | Valid: {importPreviewStats.valid} | Invalid: {importPreviewStats.invalid}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button type='button' style={btnStyle()} onClick={applyImportPreviewToForm} disabled={saving || !hasManage || isEditingLocked || importPreviewStats.invalid > 0}>
                  Apply To Form
                </button>
                <button type='button' style={btnStyle('ghost')} onClick={clearImportPreview} disabled={saving}>{t('clearPreview')}</button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#FEF3C7' }}>
                    {['Row', 'CustomerCode', 'CustomerName', 'Direction', 'Metal', 'Qty', 'Stock', 'Price', 'Eq.OZ', 'Amount', 'Notes', 'Validation', ''].map((h) => (
                      <th key={h} style={{ padding: '0.42rem 0.45rem', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {importPreviewRows.map((row, idx) => (
                    <tr key={`preview-${idx}`} style={{ background: row.validationError ? '#FEF2F2' : '#ECFDF5' }}>
                      <td style={{ padding: '0.35rem 0.4rem', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700 }}>{row.rowNo}</td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '115px' }}>
                        <input value={row.customerCode} onChange={(e) => updatePreviewRow(idx, 'customerCode', e.target.value)} style={inputStyle} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '160px' }}>
                        <input value={row.customerName} onChange={(e) => updatePreviewRow(idx, 'customerName', e.target.value)} style={inputStyle} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '95px' }}>
                        <select value={row.direction} onChange={(e) => updatePreviewRow(idx, 'direction', e.target.value)} style={inputStyle}>
                          <option value='buy'>buy</option>
                          <option value='sell'>sell</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '88px' }}>
                        <input value={row.metal} onChange={(e) => updatePreviewRow(idx, 'metal', e.target.value.toUpperCase())} style={inputStyle} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '86px' }}>
                        <input type='number' step='0.000001' value={row.qty} onChange={(e) => updatePreviewRow(idx, 'qty', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '86px' }}>
                        <input value={row.stockCode} onChange={(e) => updatePreviewRow(idx, 'stockCode', e.target.value.toUpperCase())} style={inputStyle} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '86px' }}>
                        <input type='number' step='0.01' value={row.price} onChange={(e) => updatePreviewRow(idx, 'price', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '86px' }}>
                        <input type='number' step='0.000001' value={row.eqOz} onChange={(e) => updatePreviewRow(idx, 'eqOz', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '100px' }}>
                        <input type='number' step='0.01' value={row.amount} onChange={(e) => updatePreviewRow(idx, 'amount', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '130px' }}>
                        <input value={row.notes} onChange={(e) => updatePreviewRow(idx, 'notes', e.target.value)} style={inputStyle} />
                      </td>
                      <td style={{ padding: '0.35rem 0.45rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '190px', color: row.validationError ? '#B91C1C' : '#166534', fontWeight: 700 }}>
                        {row.validationError || 'OK'}
                      </td>
                      <td style={{ padding: '0.3rem', borderBottom: `1px solid ${COLORS.border}` }}>
                        <button
                          type='button'
                          style={btnStyle('danger')}
                          onClick={() => setImportPreviewRows((prev) => prev.filter((_, i) => i !== idx).map((item, i) => normalizePreviewRow(item, i)))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
            <thead>
              <tr style={{ background: '#F3F4F6' }}>
                {['Doc No', 'Type', 'Doc Date', 'Value Date', 'Currency', 'Lines', 'Qty', 'Amount', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '0.48rem 0.55rem', borderBottom: `1px solid ${COLORS.border}`, textAlign: h === 'Qty' || h === 'Amount' || h === 'Lines' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ padding: '1rem', color: COLORS.muted, textAlign: 'center' }}>{t('loading')}</td></tr>
              ) : deals.length ? deals.map((deal, idx) => (
                <tr key={deal._id} style={{ background: idx % 2 ? '#FCFCFD' : '#FFFFFF' }}>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}`, fontWeight: 700 }}>{deal.docNo}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}` }}>{deal.entryType === 'fixing' ? 'Fixing' : 'Non-Fixing'}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}` }}>{deal.docDate ? String(deal.docDate).slice(0, 10) : '-'}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}` }}>{deal.valueDate ? String(deal.valueDate).slice(0, 10) : '-'}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}` }}>{deal.currency}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>{deal.lineItems?.length || 0}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right' }}>{fmtQty(deal.totalQty)}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', fontWeight: 700 }}>{deal.currency} {fmtMoney(deal.totalAmount)}</td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}` }}>
                    <span style={{ padding: '0.2rem 0.45rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700, background: deal.status === 'confirmed' ? '#DCFCE7' : '#FEF3C7', color: deal.status === 'confirmed' ? '#166534' : '#92400E' }}>{deal.status}</span>
                  </td>
                  <td style={{ padding: '0.45rem 0.55rem', borderBottom: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button type='button' style={btnStyle('secondary')} onClick={() => exportDealToPdf(deal)}>{t('exportPdf')}</button>
                      <button type='button' style={btnStyle('ghost')} onClick={() => exportDealToExcel(deal)}>{t('exportExcel')}</button>
                      <button type='button' style={btnStyle('secondary')} onClick={() => openDeal(deal)}>{t('open')}</button>
                      <button type='button' style={btnStyle('secondary')} onClick={() => openDealForEdit(deal)} disabled={deal.status === 'confirmed' && !isSuperAdmin}>{t('edit')}</button>
                      {deal.status === 'draft' && hasManage && (
                        <button
                          type='button'
                          style={btnStyle()}
                          onClick={async () => {
                            try {
                              setSaving(true)
                              await erpAccountingAPI.updateDirectDeal(token, deal._id, { status: 'confirmed' })
                              showSuccess('Entry confirmed and locked')
                              await loadDeals()
                            } catch (e) {
                              setError(e.response?.data?.message || 'Failed to confirm entry')
                            } finally {
                              setSaving(false)
                            }
                          }}
                          disabled={saving}
                        >
                          Confirm
                        </button>
                      )}
                      {deal.status === 'confirmed' && isSuperAdmin && (
                        <button
                          type='button'
                          style={btnStyle('ghost')}
                          onClick={async () => {
                            try {
                              setSaving(true)
                              await erpAccountingAPI.updateDirectDeal(token, deal._id, { status: 'draft' })
                              showSuccess('Entry reopened to draft')
                              await loadDeals()
                            } catch (e) {
                              setError(e.response?.data?.message || 'Failed to reopen entry')
                            } finally {
                              setSaving(false)
                            }
                          }}
                          disabled={saving}
                        >
                          Reopen
                        </button>
                      )}
                      <button type='button' style={btnStyle('danger')} onClick={() => removeDeal(deal._id)} disabled={!hasManage || deletingId === deal._id || (deal.status === 'confirmed' && !isSuperAdmin)}>{deletingId === deal._id ? 'Deleting...' : 'Delete'}</button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={10} style={{ padding: '1rem', color: COLORS.muted, textAlign: 'center' }}>{t('noFixingEntriesFound')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
