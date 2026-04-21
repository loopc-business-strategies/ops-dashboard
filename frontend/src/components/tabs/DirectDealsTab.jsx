import { useEffect, useMemo, useState } from 'react'
import erpAccountingAPI from '../../api/erp-accounting'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLanguage } from '../../context/LanguageContext'

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

const fmtMoney = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtQty = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 6 })
const today = () => new Date().toISOString().slice(0, 10)

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

export default function DirectDealsTab({ token, customers = [], currencies = [], canManage = false, isSuperAdmin = false }) {
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
  const [importPreviewRows, setImportPreviewRows] = useState([])
  const [importPreviewFileName, setImportPreviewFileName] = useState('')
  const [form, setForm] = useState({
    docNo: '',
    entryType: 'fixing',
    docDate: today(),
    valueDate: today(),
    currency: 'AED',
    branch: 'HO',
    status: 'draft',
    remarks: '',
    lineItems: [makeLine()],
  })

  const hasManage = permissions.canManage || canManage
  const currentEditingDeal = editingId ? deals.find((d) => d._id === editingId) : null
  const isEditingLocked = Boolean(currentEditingDeal && currentEditingDeal.status === 'confirmed' && !isSuperAdmin)

  const loadDeals = async () => {
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
  }

  useEffect(() => { loadDeals() }, [])

  const showSuccess = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  const formTotals = useMemo(() => {
    const totalQty = form.lineItems.reduce((sum, line) => sum + Number(line.qty || 0), 0)
    const totalAmount = form.lineItems.reduce((sum, line) => sum + Number(line.amount || (Number(line.qty || 0) * Number(line.price || 0))), 0)
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
    const matchedCustomer = customers.find((c) => String(c.code || '').toLowerCase() === customerCode.toLowerCase())
    const qty = Number(row.qty || 0)
    const price = Number(row.price || 0)
    const amount = Number(row.amount || (qty * price) || 0)

    const normalized = {
      rowNo: row.rowNo || idx + 2,
      customerId: matchedCustomer?._id || row.customerId || '',
      customerCode: customerCode || matchedCustomer?.code || '',
      customerName: customerName || matchedCustomer?.name || '',
      direction: String(row.direction || '').toLowerCase(),
      metal: String(row.metal || 'XAU').toUpperCase(),
      qty: String(row.qty || ''),
      stockCode: String(row.stockCode || 'OZ').toUpperCase(),
      price: String(row.price || ''),
      eqOz: String(row.eqOz || row.qty || ''),
      amount: String(Number.isFinite(amount) ? Number(amount.toFixed(2)) : ''),
      notes: String(row.notes || '').trim(),
    }

    return {
      ...normalized,
      validationError: validateImportedRow(normalized, idx),
    }
  }

  const updateLine = (idx, key, value) => {
    setForm((prev) => {
      const next = prev.lineItems.map((line, i) => {
        if (i !== idx) return line
        const updated = { ...line, [key]: value }
        if (key === 'customerId') {
          const customer = customers.find((c) => c._id === value)
          if (customer) {
            updated.customerCode = customer.code || ''
            updated.customerName = customer.name || ''
          }
        }
        if (key === 'qty' || key === 'price') {
          const qty = Number(key === 'qty' ? value : updated.qty || 0)
          const price = Number(key === 'price' ? value : updated.price || 0)
          const amount = qty * price
          updated.amount = amount ? String(Number(amount.toFixed(2))) : ''
          if (!updated.eqOz) updated.eqOz = updated.qty
        }
        return updated
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
      currency: 'AED',
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

  const exportDealToExcel = (deal) => {
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

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(headerRows), 'Deal Summary')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lineRows), 'Line Items')
    XLSX.writeFile(wb, `direct-deal-${deal.docNo || deal._id}.xlsx`)
  }

  const exportDealToPdf = (deal) => {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    pdf.setFontSize(14)
    pdf.text('Direct Deal Voucher', 40, 36)
    pdf.setFontSize(10)
    pdf.text(`Doc No: ${deal.docNo || '-'}`, 40, 56)
    pdf.text(`Type: ${deal.entryType === 'fixing' ? 'Fixing' : 'Non-Fixing'}`, 220, 56)
    pdf.text(`Doc Date: ${deal.docDate ? String(deal.docDate).slice(0, 10) : '-'}`, 380, 56)
    pdf.text(`Value Date: ${deal.valueDate ? String(deal.valueDate).slice(0, 10) : '-'}`, 560, 56)
    pdf.text(`Branch: ${deal.branch || '-'}`, 40, 72)
    pdf.text(`Currency: ${deal.currency || '-'}`, 220, 72)
    pdf.text(`Status: ${deal.status || '-'}`, 380, 72)
    pdf.text(`Total Qty: ${fmtQty(deal.totalQty)}`, 40, 88)
    pdf.text(`Total Amount: ${deal.currency || 'AED'} ${fmtMoney(deal.totalAmount)}`, 220, 88)

    autoTable(pdf, {
      startY: 104,
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

    try {
      setSaving(true)
      setError('')
      const data = await file.arrayBuffer()
      const wb = XLSX.read(data, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      if (!rows.length) {
        setError('Import file is empty')
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

  const downloadXlsxTemplate = () => {
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

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleRows), 'Import Template')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instructionsRows), 'Instructions')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(customerRefRows.length ? customerRefRows : [{ CustomerCode: '', CustomerName: '', CustomerId: '' }]), 'Customer Reference')
    XLSX.writeFile(wb, 'direct-deals-import-template.xlsx')
  }

  const editDeal = (deal) => {
    setEditingId(deal._id)
    setForm({
      docNo: deal.docNo || '',
      entryType: deal.entryType || 'fixing',
      docDate: deal.docDate ? String(deal.docDate).slice(0, 10) : today(),
      valueDate: deal.valueDate ? String(deal.valueDate).slice(0, 10) : today(),
      currency: deal.currency || 'AED',
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
        stockCode: line.stockCode || 'OZ',
        price: String(line.price ?? ''),
        eqOz: String(line.eqOz ?? ''),
        amount: String(line.amount ?? ''),
        notes: line.notes || '',
      })),
    })
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const validate = () => {
    if (!form.docDate || !form.valueDate) return 'Doc date and value date are required'
    if (!form.lineItems.length) return 'At least one line item is required'

    for (const [idx, line] of form.lineItems.entries()) {
      if (!line.direction || !['buy', 'sell'].includes(line.direction)) return `Line ${idx + 1}: direction must be Buy or Sell`
      if (!line.metal) return `Line ${idx + 1}: metal is required`
      if (Number(line.qty || 0) <= 0) return `Line ${idx + 1}: quantity must be greater than zero`
      if (Number(line.price || 0) <= 0) return `Line ${idx + 1}: price must be greater than zero`
    }
    return ''
  }

  const submitForm = async (e) => {
    e.preventDefault()
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
        lineItems: form.lineItems.map((line) => ({
          ...line,
          qty: Number(line.qty || 0),
          price: Number(line.price || 0),
          eqOz: Number(line.eqOz || line.qty || 0),
          amount: Number(line.amount || (Number(line.qty || 0) * Number(line.price || 0))),
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

  return (
    <div>
      {error && <div style={{ background: '#FEE2E2', color: COLORS.red, border: '1px solid #FCA5A5', borderRadius: '0.45rem', padding: '0.6rem 0.75rem', marginBottom: '0.9rem' }}>{error}</div>}
      {success && <div style={{ background: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7', borderRadius: '0.45rem', padding: '0.6rem 0.75rem', marginBottom: '0.9rem' }}>{success}</div>}

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
          <p style={{ margin: '0.25rem 0 0', color: COLORS.ink, fontSize: '1.1rem', fontWeight: 800 }}>{form.currency || 'AED'} {fmtMoney(summary.totalAmount)}</p>
        </div>
      </div>

      <form onSubmit={submitForm} style={{ background: COLORS.white, border: `1px solid ${COLORS.border}`, borderRadius: '0.55rem', padding: '0.85rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, color: COLORS.ink, fontSize: '1rem', fontWeight: 800 }}>{editingId ? 'Edit Entry' : 'New Entry'} - Fixing / Non-Fixing</h3>
          <div style={{ display: 'flex', gap: '0.45rem' }}>
            {editingId && <button type='button' onClick={resetForm} style={btnStyle('ghost')}>{t('cancelEdit')}</button>}
            <button type='submit' disabled={saving || !hasManage || isEditingLocked} style={btnStyle()}>{saving ? 'Saving...' : (editingId ? 'Update Entry' : 'Create Entry')}</button>
          </div>
        </div>

        {editingId && isEditingLocked && (
          <div style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', borderRadius: '0.4rem', padding: '0.5rem 0.65rem', marginBottom: '0.65rem', fontSize: '0.82rem', fontWeight: 700 }}>
            This entry is confirmed and locked. Only super admin can edit or reopen it.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.55rem', marginBottom: '0.6rem' }}>
          <input placeholder='Doc No (auto if blank)' value={form.docNo} onChange={(e) => setForm((prev) => ({ ...prev, docNo: e.target.value }))} style={inputStyle} disabled={!hasManage || saving} />
          <select value={form.entryType} onChange={(e) => setForm((prev) => ({ ...prev, entryType: e.target.value }))} style={inputStyle} disabled={!hasManage || saving}>
            <option value='fixing'>{t('fixing')}</option>
            <option value='non_fixing'>{t('nonFixing')}</option>
          </select>
          <input type='date' value={form.docDate} onChange={(e) => setForm((prev) => ({ ...prev, docDate: e.target.value }))} style={inputStyle} disabled={!hasManage || saving} />
          <input type='date' value={form.valueDate} onChange={(e) => setForm((prev) => ({ ...prev, valueDate: e.target.value }))} style={inputStyle} disabled={!hasManage || saving} />
          <select value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))} style={inputStyle} disabled={!hasManage || saving}>
            {[{ _id: 'aed', code: 'AED' }, ...currencies].map((c, i) => <option key={`${c.code}-${i}`} value={c.code}>{c.code}</option>)}
          </select>
          <input placeholder='Branch' value={form.branch} onChange={(e) => setForm((prev) => ({ ...prev, branch: e.target.value }))} style={inputStyle} disabled={!hasManage || saving} />
          <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} style={inputStyle} disabled={!hasManage || saving}>
            <option value='draft'>{t('statusDraft')}</option>
            <option value='confirmed'>{t('statusConfirmed')}</option>
          </select>
        </div>

        <textarea placeholder='Remarks / Notes' value={form.remarks} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} style={{ ...inputStyle, minHeight: '58px', marginBottom: '0.7rem' }} disabled={!hasManage || saving} />

        <div style={{ overflowX: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: '0.45rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#F3F4F6' }}>
                {['Customer', 'Direction', 'Metal', 'Qty', 'Stock', 'Price', 'EQ.OZ', 'Amount', ''].map((h) => (
                  <th key={h} style={{ padding: '0.45rem', borderBottom: `1px solid ${COLORS.border}`, textAlign: h === 'Qty' || h === 'Price' || h === 'EQ.OZ' || h === 'Amount' ? 'right' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.lineItems.map((line, idx) => (
                <tr key={`line-${idx}`} style={{ background: idx % 2 ? '#FCFCFD' : '#FFFFFF' }}>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '220px' }}>
                    <select value={line.customerId} onChange={(e) => updateLine(idx, 'customerId', e.target.value)} style={inputStyle} disabled={!hasManage || saving}>
                      <option value=''>{t('selectCustomer')}</option>
                      {customers.map((c) => <option key={c._id} value={c._id}>{c.code || 'N/A'} - {c.name}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '120px' }}>
                    <select value={line.direction} onChange={(e) => updateLine(idx, 'direction', e.target.value)} style={inputStyle} disabled={!hasManage || saving}>
                      <option value='buy'>Buy</option>
                      <option value='sell'>Sell</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '95px' }}>
                    <select value={line.metal} onChange={(e) => updateLine(idx, 'metal', e.target.value)} style={inputStyle} disabled={!hasManage || saving}>
                      <option value='XAU'>XAU</option>
                      <option value='XAG'>XAG</option>
                      <option value='XPT'>XPT</option>
                      <option value='XPD'>XPD</option>
                    </select>
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '95px' }}>
                    <input type='number' step='0.000001' value={line.qty} onChange={(e) => updateLine(idx, 'qty', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} disabled={!hasManage || saving} />
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '95px' }}>
                    <input value={line.stockCode} onChange={(e) => updateLine(idx, 'stockCode', e.target.value.toUpperCase())} style={inputStyle} disabled={!hasManage || saving} />
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '95px' }}>
                    <input type='number' step='0.01' value={line.price} onChange={(e) => updateLine(idx, 'price', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} disabled={!hasManage || saving} />
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '95px' }}>
                    <input type='number' step='0.000001' value={line.eqOz} onChange={(e) => updateLine(idx, 'eqOz', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} disabled={!hasManage || saving} />
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '115px' }}>
                    <input type='number' step='0.01' value={line.amount} onChange={(e) => updateLine(idx, 'amount', e.target.value)} style={{ ...inputStyle, textAlign: 'right' }} disabled={!hasManage || saving} />
                  </td>
                  <td style={{ padding: '0.35rem', borderBottom: `1px solid ${COLORS.border}`, minWidth: '72px' }}>
                    <button type='button' onClick={() => removeLine(idx)} style={btnStyle('danger')} disabled={!hasManage || saving || form.lineItems.length === 1}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.7rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type='button' style={btnStyle('secondary')} onClick={addLine} disabled={!hasManage || saving}>+ Add Line</button>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.82rem', color: COLORS.ink, fontWeight: 700 }}>
            <span>Total Qty: {fmtQty(formTotals.totalQty)}</span>
            <span>Total Amount: {form.currency} {fmtMoney(formTotals.totalAmount)}</span>
          </div>
        </div>
      </form>

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
          <button
            type='button'
            style={btnStyle('ghost')}
            onClick={downloadCsvTemplate}
          >
            Download CSV Template
          </button>
          <button
            type='button'
            style={btnStyle('ghost')}
            onClick={downloadXlsxTemplate}
          >
            Download XLSX Template
          </button>
          <label style={{ ...btnStyle('secondary'), display: 'inline-flex', alignItems: 'center' }}>
            Bulk Import Excel/CSV
            <input
              type='file'
              accept='.xlsx,.xls,.csv'
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
                      <button type='button' style={btnStyle('secondary')} onClick={() => editDeal(deal)} disabled={deal.status === 'confirmed' && !isSuperAdmin}>{t('edit')}</button>
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
