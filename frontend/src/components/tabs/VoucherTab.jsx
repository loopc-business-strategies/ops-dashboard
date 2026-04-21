import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'

const BASE = '/api/erp-accounting'
const cfg = () => ({ withCredentials: true })

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

const S = {
  // Colours
  green: '#059669',
  greenDark: '#047857',
  danger: '#DC2626',
  ink: '#111827',
  muted: '#6B7280',
  border: '#D1D5DB',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  blueSoft: '#EFF6FF',
  headerBg: '#F3F4F6',
}

const fieldRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '0.6rem 1rem',
  marginBottom: '0.5rem',
}

const fieldGroup = (label, children, span) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  gridColumn: span ? `span ${span}` : undefined,
})

const labelStyle = { fontSize: '0.72rem', fontWeight: '600', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }

const inputStyle = {
  padding: '0.35rem 0.6rem',
  border: `1px solid ${S.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.875rem',
  background: S.white,
  color: S.ink,
  width: '100%',
  boxSizing: 'border-box',
}

const readInput = { ...inputStyle, background: S.bg, color: S.muted }

const sectionBox = {
  border: `1px solid ${S.border}`,
  borderRadius: '0.5rem',
  marginBottom: '1rem',
  overflow: 'hidden',
}

const sectionHeader = {
  background: S.headerBg,
  padding: '0.4rem 0.8rem',
  fontWeight: '700',
  fontSize: '0.8rem',
  color: S.ink,
  borderBottom: `1px solid ${S.border}`,
  letterSpacing: '0.03em',
}

const sectionBody = { padding: '0.75rem' }

const btn = (variant = 'primary') => ({
  padding: '0.45rem 1rem',
  borderRadius: '0.375rem',
  fontSize: '0.85rem',
  fontWeight: '600',
  cursor: 'pointer',
  border: 'none',
  ...(variant === 'primary' ? { background: S.green, color: S.white } :
     variant === 'secondary' ? { background: S.white, color: S.ink, border: `1px solid ${S.border}` } :
     variant === 'danger' ? { background: S.danger, color: S.white } :
     variant === 'gray' ? { background: '#E5E7EB', color: S.ink } : {}),
})

const tabBtn = (active) => ({
  padding: '0.4rem 1rem',
  fontSize: '0.82rem',
  fontWeight: active ? '700' : '600',
  color: active ? S.white : S.ink,
  background: active ? S.green : 'transparent',
  border: active ? 'none' : `1px solid ${S.border}`,
  borderRadius: '0.3rem',
  cursor: 'pointer',
})

const emptyLine = () => ({
  branch: 'HO',
  acCode: '',
  type: 'Cash',
  typeCode: '',
  currCode: 'USD',
  currRate: '',
  exp: '',
  trnNumber: '',
  trnInv: '',
  trnInvDate: '',
  hsnAc: '',
  trnRef: '',
  chqNo: '',
  chqDate: today(),
  chqBank: '',
  amountFC: '',
  amountLC: '',
  headerAmt: '',
  trnPer: '',
  trnAmountFC: '',
  trnAmountLC: '',
  amountWithTRN: '',
  headerAmountWithTRN: '',
  narration: '',
})

const emptyHeader = () => ({
  branch: 'HO',
  partyCode: '',
  partyName: '',
  currCode: 'USD',
  currRate: '1.000000',
  vocDate: today(),
  vocNo: '',
  salesman: '',
  refNo: '',
  refDate: today(),
  narration: '',
  postedDate: today(),
})

const normalizeLookupValue = (value) => String(value || '').trim().toLowerCase()
const normalizeLineType = (value) => (value === 'Transfer' ? 'TT' : (value || 'Cash'))

const getAccountCodeValue = (account) => String(account?.code || account?.accountCode || '').trim()
const getAccountNameValue = (account) => String(account?.name || account?.accountName || '').trim().toLowerCase()

const pickDefaultAccountCodeByType = (accounts, lineType) => {
  const normalizedType = normalizeLineType(lineType)
  const accountList = Array.isArray(accounts) ? accounts : []

  if (normalizedType === 'TT') {
    const bank = accountList.find((a) => {
      const name = getAccountNameValue(a)
      return name.includes('bank')
    })
    return getAccountCodeValue(bank)
  }

  if (normalizedType === 'Cash') {
    const petty = accountList.find((a) => {
      const name = getAccountNameValue(a)
      return name.includes('petty cash')
    })
    if (petty) return getAccountCodeValue(petty)

    const cash = accountList.find((a) => {
      const name = getAccountNameValue(a)
      return name.includes('cash')
    })
    return getAccountCodeValue(cash)
  }

  return ''
}

export default function VoucherTab({ token, user, accounts = [], customers = [], vendors = [], currencies = [] }) {
  const { t } = useLanguage()
  const role = user?.role || ''
  const dept = (user?.department || '').toLowerCase()
  const isSuperAdmin = role === 'super_admin'
  const isFinance = isSuperAdmin || (role === 'department_head' && dept === 'finance')
  const isSales = isSuperAdmin || (role === 'department_head' && dept === 'sales') || role === 'management'
  const isManagementOnly = role === 'management'

  const canView = isFinance || isSales || isManagementOnly || isSuperAdmin
  const canCreatePayment = isFinance || isSuperAdmin
  const canCreateReceipt = isFinance || isSales || isSuperAdmin
  const isReadOnly = isManagementOnly && !isFinance

  // ─── top-level state ────────────────────────────────────────────────────────
  const [voucherType, setVoucherType] = useState('payment')
  const [vouchers, setVouchers] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mode, setMode] = useState('list')            // 'list' | 'create' | 'view'
  const [editingId, setEditingId] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('') // workflow filter
  const [innerTab, setInnerTab] = useState('lineItems')   // 'lineItems' | 'attachments'
  const [headerTab, setHeaderTab] = useState('header')    // 'header' | 'accounts'
  const [workflowNote, setWorkflowNote] = useState('')
  const [selectedPartyId, setSelectedPartyId] = useState('')
  const [recentPartyVouchers, setRecentPartyVouchers] = useState([])
  const [loadingRecentPartyVouchers, setLoadingRecentPartyVouchers] = useState(false)
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 })
  const [modalDrag, setModalDrag] = useState(null)
  const dragMetaRef = useRef({ moved: false })

  // ─── header form ────────────────────────────────────────────────────────────
  const [header, setHeader] = useState(emptyHeader())
  const setHdr = (k, v) => setHeader(prev => ({ ...prev, [k]: v }))

  const resolveVoucherParty = useCallback((partyCode) => {
    const lookupValue = normalizeLookupValue(partyCode)
    if (!lookupValue) return null

    if (voucherType === 'payment') {
      const vendor = vendors.find((item) => {
        const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
        return lookupValue === normalizeLookupValue(item._id)
          || lookupValue === normalizeLookupValue(item.vendorCode)
          || lookupValue === ledgerCode
      })
      if (vendor) {
        return {
          customerId: '',
          vendorId: vendor._id,
          partyName: vendor.name || '',
          partyCode: vendor.vendorCode || vendor.ledgerAccountId?.accountCode || String(vendor._id),
          partyId: `vendor:${String(vendor._id)}`,
          partyType: 'vendor',
        }
      }

      const customer = customers.find((item) => {
        const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
        return lookupValue === normalizeLookupValue(item._id) || lookupValue === ledgerCode
      })

      return customer
        ? {
            customerId: customer._id,
            vendorId: '',
            partyName: customer.name || '',
            partyCode: customer.ledgerAccountId?.accountCode || String(customer._id),
            partyId: `customer:${String(customer._id)}`,
            partyType: 'customer',
          }
        : null
    }

    const customer = customers.find((item) => {
      const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
      return lookupValue === normalizeLookupValue(item._id) || lookupValue === ledgerCode
    })

    return customer
      ? {
          customerId: customer._id,
          vendorId: '',
          partyName: customer.name || '',
          partyCode: customer.ledgerAccountId?.accountCode || String(customer._id),
          partyId: `customer:${String(customer._id)}`,
          partyType: 'customer',
        }
      : null
  }, [customers, vendors, voucherType])

  const partyGroups = voucherType === 'payment'
    ? [
        {
          label: 'Vendors - Linked',
          options: vendors
            .filter((item) => Boolean(item.ledgerAccountId?.accountCode))
            .map((item) => ({
              id: `vendor:${String(item._id)}`,
              label: `${item.name || 'Vendor'}${item.vendorCode ? ` (${item.vendorCode})` : ''}`,
              partyCode: item.vendorCode || item.ledgerAccountId?.accountCode || String(item._id),
              partyName: item.name || '',
            })),
        },
        {
          label: 'Vendors - Other',
          options: vendors
            .filter((item) => !item.ledgerAccountId?.accountCode)
            .map((item) => ({
              id: `vendor:${String(item._id)}`,
              label: `${item.name || 'Vendor'}${item.vendorCode ? ` (${item.vendorCode})` : ''}`,
              partyCode: item.vendorCode || String(item._id),
              partyName: item.name || '',
            })),
        },
        {
          label: 'Customers - Linked',
          options: customers
            .filter((item) => Boolean(item.ledgerAccountId?.accountCode))
            .map((item) => ({
              id: `customer:${String(item._id)}`,
              label: `${item.name || 'Customer'}${item.ledgerAccountId?.accountCode ? ` (${item.ledgerAccountId.accountCode})` : ''}`,
              partyCode: item.ledgerAccountId?.accountCode || String(item._id),
              partyName: item.name || '',
            })),
        },
        {
          label: 'Customers - Other',
          options: customers
            .filter((item) => !item.ledgerAccountId?.accountCode)
            .map((item) => ({
              id: `customer:${String(item._id)}`,
              label: `${item.name || 'Customer'}`,
              partyCode: String(item._id),
              partyName: item.name || '',
            })),
        },
      ]
    : [
        {
          label: 'Linked Customers',
          options: customers
            .filter((item) => Boolean(item.ledgerAccountId?.accountCode))
            .map((item) => ({
              id: `customer:${String(item._id)}`,
              label: `${item.name || 'Customer'}${item.ledgerAccountId?.accountCode ? ` (${item.ledgerAccountId.accountCode})` : ''}`,
              partyCode: item.ledgerAccountId?.accountCode || String(item._id),
              partyName: item.name || '',
            })),
        },
        {
          label: 'Other Customers',
          options: customers
            .filter((item) => !item.ledgerAccountId?.accountCode)
            .map((item) => ({
              id: `customer:${String(item._id)}`,
              label: `${item.name || 'Customer'}`,
              partyCode: String(item._id),
              partyName: item.name || '',
            })),
        },
      ]

  const partyOptions = partyGroups.flatMap((group) => group.options)

  const loadRecentPartyVouchers = useCallback(async (resolvedParty) => {
    if (!resolvedParty || (!resolvedParty.customerId && !resolvedParty.vendorId)) {
      setRecentPartyVouchers([])
      return
    }

    setLoadingRecentPartyVouchers(true)
    try {
      const params = {
        limit: 5,
        type: voucherType,
      }
      if (resolvedParty.customerId) params.customerId = resolvedParty.customerId
      if (resolvedParty.vendorId) params.vendorId = resolvedParty.vendorId

      const response = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params,
      })

      const items = (response.data.transactions || [])
        .filter((item) => item.voucherMeta?.vocNo)
        .slice(0, 5)
        .map((item) => ({
          id: item._id,
          vocNo: item.voucherMeta?.vocNo || '-',
          date: item.date ? String(item.date).slice(0, 10) : '-',
          amount: Number(item.amount || 0),
          currency: item.currency || 'USD',
          type: item.type || '-',
          status: item.status || 'draft',
        }))

      setRecentPartyVouchers(items)
    } catch {
      setRecentPartyVouchers([])
    } finally {
      setLoadingRecentPartyVouchers(false)
    }
  }, [voucherType])

  // ─── line items ─────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState([])
  const [showLineForm, setShowLineForm] = useState(false)
  const [editingLineIdx, setEditingLineIdx] = useState(null)
  const [lineForm, setLineForm] = useState(emptyLine())
  const setLF = (k, v) => setLineForm(prev => ({ ...prev, [k]: v }))

  // ─── helpers ─────────────────────────────────────────────────────────────────
  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  const clearError = () => setError('')

  const totals = {
    total: lineItems.reduce((s, l) => s + (parseFloat(l.amountLC) || 0), 0),
    trnAmount: lineItems.reduce((s, l) => s + (parseFloat(l.trnAmountLC) || 0), 0),
    grandTotal: lineItems.reduce((s, l) => s + (parseFloat(l.amountWithTRN) || parseFloat(l.amountLC) || 0), 0),
  }

  const canCreate = voucherType === 'payment' ? canCreatePayment : canCreateReceipt

  // ─── load vouchers ───────────────────────────────────────────────────────────
  const loadVouchers = useCallback(async () => {
    if (!canView) return
    setLoadingList(true)
    try {
      const res = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const txs = (res.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo)
      setVouchers(txs)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vouchers')
    } finally {
      setLoadingList(false)
    }
  }, [voucherType, canView])

  useEffect(() => { loadVouchers() }, [loadVouchers])

  useEffect(() => {
    if (!modalDrag) return

    const onMouseMove = (e) => {
      const dx = e.clientX - modalDrag.startX
      const dy = e.clientY - modalDrag.startY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragMetaRef.current.moved = true
      }
      setModalOffset({
        x: modalDrag.baseX + dx,
        y: modalDrag.baseY + dy,
      })
    }

    const onMouseUp = () => {
      setModalDrag(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [modalDrag])

  // ─── next voucher number ─────────────────────────────────────────────────────
  const nextVocNo = () => {
    const nos = vouchers.map(v => parseInt(v.voucherMeta?.vocNo) || 0).filter(n => n > 0)
    return nos.length ? String(Math.max(...nos) + 1) : '1'
  }

  // ─── open create ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null)
    setHeader({ ...emptyHeader(), vocNo: nextVocNo() })
    setSelectedPartyId('')
    setRecentPartyVouchers([])
    setLineItems([])
    setShowLineForm(false)
    setInnerTab('lineItems')
    setHeaderTab('header')
    setWorkflowNote('')
    setModalOffset({ x: 0, y: 0 })
    setModalDrag(null)
    setError('')
    setMode('create')
  }

  const handleModalHeaderMouseDown = (e) => {
    if (mode !== 'create' || e.button !== 0) return
    if (e.target instanceof Element && e.target.closest('button')) return

    dragMetaRef.current.moved = false
    setModalDrag({
      startX: e.clientX,
      startY: e.clientY,
      baseX: modalOffset.x,
      baseY: modalOffset.y,
    })
  }

  const handleCreateModalBackdropClick = () => {
    if (mode !== 'create') return
    if (dragMetaRef.current.moved) {
      dragMetaRef.current.moved = false
      return
    }
    setMode('list')
  }

  // ─── open view/edit ──────────────────────────────────────────────────────────
  const openVoucher = (v) => {
    const m = v.voucherMeta || {}
    const resolvedParty = resolveVoucherParty(m.partyCode || '')
    setEditingId(v._id)
    setHeader({
      branch: m.branch || 'HO',
      partyCode: m.partyCode || '',
      partyName: m.partyName || '',
      currCode: v.currency || 'USD',
      currRate: String(v.exchangeRate || '1.000000'),
      vocDate: v.date ? v.date.slice(0, 10) : today(),
      vocNo: m.vocNo || '',
      salesman: m.salesman || '',
      refNo: m.refNo || '',
      refDate: m.refDate ? m.refDate.slice(0, 10) : today(),
      narration: v.description || '',
      postedDate: m.postedDate ? m.postedDate.slice(0, 10) : today(),
    })
    setSelectedPartyId(resolvedParty?.partyId || '')
    setLineItems((m.lineItems || []).map((line) => ({ ...line, type: normalizeLineType(line.type) })))
    setShowLineForm(false)
    setInnerTab('lineItems')
    setHeaderTab('header')
    setWorkflowNote('')
    setError('')
    setMode('view')
  }

  const handleWorkflowAction = async (action) => {
    if (!editingId) return
    const routeMap = {
      submit: 'submit',
      approve: 'approve',
      return: 'return',
      reject: 'reject',
      post: 'post',
    }
    const route = routeMap[action]
    if (!route) return

    if ((action === 'return' || action === 'reject') && !workflowNote.trim()) {
      setError(action === 'return' ? 'Return reason is required' : 'Rejection reason is required')
      return
    }

    setSaving(true)
    clearError()
    try {
      await axios.post(`${BASE}/transactions/${editingId}/${route}`, { comment: workflowNote }, cfg())
      await loadVouchers()
      setWorkflowNote('')
      const actionLabel = action === 'submit'
        ? 'submitted'
        : action === 'approve'
          ? 'approved'
          : action === 'return'
            ? 'returned for edit'
            : action === 'reject'
              ? 'rejected'
              : 'posted'
      showMsg(`Voucher ${actionLabel} successfully`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} voucher`)
    } finally {
      setSaving(false)
    }
  }

  // ─── save voucher ────────────────────────────────────────────────────────────
  const saveVoucher = async () => {
    clearError()

    let effectiveLineItems = [...lineItems]
    if (showLineForm) {
      if (!lineForm.acCode.trim() || (!lineForm.amountLC && !lineForm.amountFC)) {
        setError('Complete line details and click Save Line, or cancel the open line before saving voucher')
        return
      }
      const draftLine = {
        ...lineForm,
        type: normalizeLineType(lineForm.type),
        amountWithTRN: lineForm.amountWithTRN || lineForm.amountLC || lineForm.amountFC,
      }
      if (editingLineIdx !== null) {
        effectiveLineItems = effectiveLineItems.map((l, i) => (i === editingLineIdx ? draftLine : l))
      } else {
        effectiveLineItems.push(draftLine)
      }
      setLineItems(effectiveLineItems)
      setShowLineForm(false)
      setEditingLineIdx(null)
    }

    if (!header.partyCode.trim()) { setError('Party Code is required'); return }
    if (!effectiveLineItems.length) { setError('Add at least one line item'); return }
    const resolvedParty = resolveVoucherParty(header.partyCode)
    if (voucherType === 'receipt' && !resolvedParty?.customerId) {
      setError('Party Code must match an existing customer account for receipt vouchers')
      return
    }
    if (voucherType === 'payment' && !resolvedParty?.vendorId) {
      if (!resolvedParty?.customerId) {
        setError('Party Code must match an existing vendor or customer account for payment vouchers')
        return
      }
    }
    const payload = {
      type: voucherType,
      amount: totals.grandTotal || 0.01,
      date: header.vocDate,
      description: header.narration,
      currency: header.currCode,
      exchangeRate: parseFloat(header.currRate) || 1,
      customerId: resolvedParty?.customerId || undefined,
      vendorId: resolvedParty?.vendorId || undefined,
      voucherMeta: {
        branch: header.branch,
        partyCode: header.partyCode,
        partyName: header.partyName || resolvedParty?.partyName || '',
        salesman: header.salesman,
        vocNo: header.vocNo,
        refNo: header.refNo,
        refDate: header.refDate || null,
        postedDate: header.postedDate || null,
        lineItems: effectiveLineItems.map(l => ({
          ...l,
          amountFC: parseFloat(l.amountFC) || 0,
          amountLC: parseFloat(l.amountLC) || 0,
          headerAmt: parseFloat(l.headerAmt) || 0,
          currRate: parseFloat(l.currRate) || 1,
          trnPer: parseFloat(l.trnPer) || 0,
          trnAmountFC: parseFloat(l.trnAmountFC) || 0,
          trnAmountLC: parseFloat(l.trnAmountLC) || 0,
          amountWithTRN: parseFloat(l.amountWithTRN) || parseFloat(l.amountLC) || 0,
          headerAmountWithTRN: parseFloat(l.headerAmountWithTRN) || 0,
        })),
      },
    }
    const payloadLineTotal = effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountWithTRN) || parseFloat(l.amountLC) || 0), 0)
    payload.amount = payloadLineTotal || 0.01
    setSaving(true)
    try {
      if (editingId) {
        await axios.put(`${BASE}/transactions/${editingId}`, payload, cfg())
        showMsg('Voucher updated successfully')
      } else {
        await axios.post(`${BASE}/transactions`, payload, cfg())
        showMsg('Voucher saved successfully')
      }
      await loadVouchers()
      setMode('list')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save voucher')
    } finally {
      setSaving(false)
    }
  }

  // ─── line form actions ───────────────────────────────────────────────────────
  const openAddLine = () => {
    setEditingLineIdx(null)
    const defaultType = 'Cash'
    const defaultAccountCode = pickDefaultAccountCodeByType(accounts, defaultType)
    setLineForm({
      ...emptyLine(),
      branch: header.branch || 'HO',
      currCode: header.currCode || 'USD',
      type: defaultType,
      typeCode: defaultType.toUpperCase(),
      acCode: defaultAccountCode || '',
    })
    setShowLineForm(true)
  }

  const openEditLine = (idx) => {
    setEditingLineIdx(idx)
    const normalizedType = normalizeLineType(lineItems[idx]?.type)
    setLineForm({
      ...lineItems[idx],
      type: normalizedType,
      typeCode: normalizedType.toUpperCase(),
    })
    setShowLineForm(true)
  }

  const deleteLine = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx))

  const cancelLine = () => { setShowLineForm(false); setEditingLineIdx(null); clearError() }

  const saveLine = () => {
    if (!lineForm.acCode.trim()) { setError('A/C Code is required'); return }
    if (!lineForm.amountLC && !lineForm.amountFC) { setError('Amount is required'); return }
    const line = {
      ...lineForm,
      type: normalizeLineType(lineForm.type),
      amountWithTRN: lineForm.amountWithTRN || lineForm.amountLC || lineForm.amountFC,
    }
    if (editingLineIdx !== null) {
      setLineItems(prev => prev.map((l, i) => i === editingLineIdx ? line : l))
    } else {
      setLineItems(prev => [...prev, line])
    }
    setShowLineForm(false)
    setEditingLineIdx(null)
    clearError()
  }

  // When type changes to Cash, clear cheque fields
  const handleLineTypeChange = (val) => {
    const normalized = normalizeLineType(val)
    setLF('type', normalized)
    setLF('typeCode', normalized.toUpperCase())

    const suggestedAccountCode = pickDefaultAccountCodeByType(accounts, normalized)
    if (suggestedAccountCode) {
      setLF('acCode', suggestedAccountCode)
    }

    if (normalized === 'Cash') {
      setLF('chqNo', '')
      setLF('chqDate', '')
      setLF('chqBank', '')
    }
  }

  // Auto-calc amountLC from FC and rate
  const handleAmountFC = (val) => {
    setLF('amountFC', val)
    const rate = parseFloat(lineForm.currRate) || parseFloat(header.currRate) || 1
    const lc = (parseFloat(val) || 0) * rate
    setLF('amountLC', lc ? lc.toFixed(2) : '')
    setLF('amountWithTRN', lc ? lc.toFixed(2) : '')
  }

  const handleAmountLC = (val) => {
    setLF('amountLC', val)
    setLF('amountWithTRN', val)
  }

  const handleLineAmountEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!showLineForm) return
    saveLine()
  }

  // Lookup party name from the relevant customer/vendor master record.
  const lookupParty = (code) => {
    const resolvedParty = resolveVoucherParty(code)
    setSelectedPartyId(resolvedParty?.partyId || '')
    setHdr('partyName', resolvedParty?.partyName || '')
  }

  const handlePartySelect = (partyId) => {
    setSelectedPartyId(partyId)
    const selected = partyOptions.find((item) => item.id === partyId)
    if (!selected) {
      setHdr('partyCode', '')
      setHdr('partyName', '')
      return
    }
    setHdr('partyCode', selected.partyCode)
    setHdr('partyName', selected.partyName)
  }

  useEffect(() => {
    if (headerTab !== 'accounts') return
    const resolvedParty = resolveVoucherParty(header.partyCode)
    if (!resolvedParty) {
      setRecentPartyVouchers([])
      return
    }
    loadRecentPartyVouchers(resolvedParty)
  }, [headerTab, header.partyCode, resolveVoucherParty, loadRecentPartyVouchers])

  // ─── filtered list ───────────────────────────────────────────────────────────
  const filteredVouchers = selectedStatus
    ? vouchers.filter(v => v.status === selectedStatus)
    : vouchers
  const currentVoucher = editingId ? vouchers.find(v => v._id === editingId) : null
  const currentVoucherStatus = currentVoucher?.status || 'draft'
  const canSubmitWorkflow = Boolean(editingId) && !isReadOnly && ['draft', 'returned', 'rejected'].includes(currentVoucherStatus)
  const canApproveWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && currentVoucherStatus === 'submitted'
  const canReturnWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && ['submitted', 'approved'].includes(currentVoucherStatus)
  const canRejectWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && ['submitted', 'approved', 'returned'].includes(currentVoucherStatus)
  const canPostWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && ['submitted', 'approved'].includes(currentVoucherStatus)

  // ─── guard ───────────────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <div style={{ padding: '2rem', background: '#FEE2E2', borderRadius: '0.5rem', color: S.danger, textAlign: 'center' }}>
        You do not have permission to access the Vouchers module.
      </div>
    )
  }

  const voucherLabel = voucherType === 'payment' ? 'Payment Voucher' : 'Receipt Voucher'
  const voucherCode = voucherType === 'payment' ? 'PAY' : 'REC'
  const voucherLabelT = voucherType === 'payment' ? t('paymentVoucher') : t('receiptVoucher')

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Notifications */}
      {error && (
        <div style={{ background: '#FEE2E2', color: S.danger, padding: '0.65rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: S.danger, cursor: 'pointer', fontWeight: '700', fontSize: '1rem' }}>×</button>
        </div>
      )}
      {success && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '0.65rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {success}
        </div>
      )}

      {/* ── Voucher type switcher ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          style={tabBtn(voucherType === 'payment')}
          onClick={() => { setVoucherType('payment'); setMode('list') }}
        >
          💳 {t('paymentVoucher')}
        </button>
        <button
          style={tabBtn(voucherType === 'receipt')}
          onClick={() => { setVoucherType('receipt'); setMode('list') }}
        >
          🧾 {t('receiptVoucher')}
        </button>
        {mode !== 'list' && (
          <button style={btn('secondary')} onClick={() => setMode('list')}>
            ← Back to List
          </button>
        )}
        {mode === 'list' && canCreate && (
          <button style={{ ...btn('primary'), marginLeft: 'auto' }} onClick={openCreate}>
            + {t('create')} {voucherLabelT}
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ LIST MODE */}
      {mode === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: S.ink }}>
              {voucherLabel} — List
            </h3>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{ ...inputStyle, width: '140px' }}
            >
              <option value="">{t('all')} {t('status')}</option>
              <option value="draft">{t('statusDraft')}</option>
              <option value="submitted">{t('statusSubmitted')}</option>
              <option value="approved">{t('statusApproved')}</option>
              <option value="posted">{t('statusPosted')}</option>
              <option value="returned">{t('statusReturned')}</option>
              <option value="rejected">{t('statusRejected')}</option>
            </select>
            <button style={btn('gray')} onClick={loadVouchers}>↺ Refresh</button>
          </div>

          {loadingList ? (
            <p style={{ color: S.muted }}>{t('loading')}</p>
          ) : filteredVouchers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: S.muted, border: `2px dashed ${S.border}`, borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
              <p>No {voucherLabel.toLowerCase()}s found.</p>
              {canCreate && (
                <button style={{ ...btn('primary'), marginTop: '0.5rem' }} onClick={openCreate}>
                  + Create First {voucherLabel}
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: S.headerBg }}>
                    {['Voc No', 'Date', 'Branch', 'Party Code', 'Party Name', 'Currency', 'Grand Total', 'Narration', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: S.ink, borderBottom: `2px solid ${S.border}`, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.map((v, i) => {
                    const m = v.voucherMeta || {}
                    const grand = (m.lineItems || []).reduce((s, l) => s + (l.amountWithTRN || l.amountLC || 0), 0)
                    const statusColors = {
                      draft: { bg: '#FEF3C7', color: '#92400E' },
                      submitted: { bg: '#DBEAFE', color: '#1D4ED8' },
                      approved: { bg: '#DCFCE7', color: '#166534' },
                      posted: { bg: '#D1FAE5', color: '#065F46' },
                      returned: { bg: '#FCE7F3', color: '#9D174D' },
                      rejected: { bg: '#FEE2E2', color: '#B91C1C' },
                    }
                    const sc = statusColors[v.status] || { bg: '#F3F4F6', color: '#374151' }
                    return (
                      <tr key={v._id} style={{ background: i % 2 === 0 ? S.white : S.bg, borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: '700', color: S.green }}>{m.vocNo}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>{v.date ? v.date.slice(0, 10) : '-'}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>{m.branch || '-'}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>{m.partyCode || '-'}</td>
                        <td style={{ padding: '0.55rem 0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.partyName || '-'}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>{v.currency}</td>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: '700', textAlign: 'right' }}>{fmt(grand)}</td>
                        <td style={{ padding: '0.55rem 0.75rem', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.description || '-'}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', background: sc.bg, color: sc.color }}>
                            {v.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <button style={{ ...btn('secondary'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }} onClick={() => openVoucher(v)}>
                            {isReadOnly ? 'View' : 'Open'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p style={{ marginTop: '0.5rem', color: S.muted, fontSize: '0.8rem' }}>{filteredVouchers.length} voucher(s)</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ CREATE / VIEW MODE */}
      {(mode === 'create' || mode === 'view') && (
        <div
          style={mode === 'create'
            ? {
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.45)',
                zIndex: 1200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }
            : undefined}
          onClick={mode === 'create' ? handleCreateModalBackdropClick : undefined}
        >
          <div
            style={mode === 'create'
              ? {
                  width: 'min(1180px, 96vw)',
                  maxHeight: '92vh',
                  overflowY: 'auto',
                  background: S.white,
                  borderRadius: '0.7rem',
                  border: `1px solid ${S.border}`,
                  boxShadow: '0 24px 64px rgba(15, 23, 42, 0.35)',
                  padding: '0.9rem',
                  transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)`,
                }
              : undefined}
            onClick={mode === 'create' ? (e) => e.stopPropagation() : undefined}
          >
          {/* ── Top title bar ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
              cursor: mode === 'create' ? (modalDrag ? 'grabbing' : 'grab') : 'default',
              userSelect: mode === 'create' ? 'none' : 'auto',
            }}
            onMouseDown={mode === 'create' ? handleModalHeaderMouseDown : undefined}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: S.ink }}>
                {voucherLabelT} {header.vocNo ? `— #${header.vocNo}` : ''}
              </h3>
              {editingId && (
                <p style={{ margin: 0, fontSize: '0.78rem', color: S.muted }}>
                  Mode: {isReadOnly ? 'View Only' : 'Edit'} &nbsp;|&nbsp; Status: {currentVoucherStatus}
                </p>
              )}
            </div>
            {!isReadOnly && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button style={{ ...btn('primary'), background: '#B45309' }}>
                  🖨 Print Cheque
                </button>
                {mode === 'create' && (
                  <button style={btn('secondary')} onClick={() => setMode('list')}>
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Header / Account Details tabs ── */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0' }}>
            <button style={tabBtn(headerTab === 'header')} onClick={() => setHeaderTab('header')}>
              Header Details
            </button>
            <button style={tabBtn(headerTab === 'accounts')} onClick={() => setHeaderTab('accounts')}>
              Account Details
            </button>
          </div>

          {/* ── Header Details ── */}
          {headerTab === 'header' && (
            <div style={sectionBox}>
              <div style={sectionBody}>
                {/* Row 1 */}
                <div style={fieldRow}>
                  <div style={fieldGroup('Party Account')}>
                    <label style={labelStyle}>Party Account</label>
                    <select
                      style={isReadOnly ? readInput : inputStyle}
                      value={selectedPartyId}
                      onChange={e => handlePartySelect(e.target.value)}
                      disabled={isReadOnly}
                    >
                      <option value="">Select {voucherType === 'payment' ? 'Vendor / Customer' : 'Customer'}</option>
                      {partyGroups.map((group) => (
                        group.options.length > 0 ? (
                          <optgroup key={group.label} label={group.label}>
                            {group.options.map((item) => (
                              <option key={item.id} value={item.id}>{item.label}</option>
                            ))}
                          </optgroup>
                        ) : null
                      ))}
                    </select>
                  </div>
                  <div style={fieldGroup('Branch')}>
                    <label style={labelStyle}>Branch</label>
                    <input style={isReadOnly ? readInput : inputStyle} value={header.branch} onChange={e => setHdr('branch', e.target.value)} readOnly={isReadOnly} />
                  </div>
                  <div style={fieldGroup('Party Code')}>
                    <label style={labelStyle}>Party Code</label>
                    <input
                      style={readInput}
                      value={header.partyCode}
                      onChange={e => { setHdr('partyCode', e.target.value); lookupParty(e.target.value) }}
                      placeholder={voucherType === 'payment' ? 'Auto from vendor' : 'Auto from customer'}
                      readOnly
                    />
                  </div>
                  <div style={{ ...fieldGroup('Party Name'), gridColumn: 'span 1' }}>
                    <label style={labelStyle}>Party Name</label>
                    <input style={{ ...readInput, fontWeight: '700', color: S.green }} value={header.partyName} onChange={e => setHdr('partyName', e.target.value)} readOnly placeholder="Party / Company Name" />
                  </div>
                </div>

                {/* Row 2 */}
                <div style={fieldRow}>
                  <div style={fieldGroup('Voc Type')}>
                    <label style={labelStyle}>Voc Type</label>
                    <input style={readInput} value={voucherCode} readOnly />
                  </div>
                  <div style={fieldGroup('Curr. Code')}>
                    <label style={labelStyle}>Curr. Code</label>
                    <select style={isReadOnly ? readInput : inputStyle} value={header.currCode} onChange={e => setHdr('currCode', e.target.value)} disabled={isReadOnly}>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div style={fieldGroup('Curr. Rate')}>
                    <label style={labelStyle}>Curr. Rate</label>
                    <input style={isReadOnly ? readInput : inputStyle} value={header.currRate} onChange={e => setHdr('currRate', e.target.value)} type="number" step="0.000001" readOnly={isReadOnly} />
                  </div>
                </div>

                {/* Row 3 */}
                <div style={fieldRow}>
                  <div style={fieldGroup('Voc Date')}>
                    <label style={labelStyle}>Voc Date</label>
                    <input style={isReadOnly ? readInput : inputStyle} type="date" value={header.vocDate} onChange={e => setHdr('vocDate', e.target.value)} readOnly={isReadOnly} />
                  </div>
                  <div style={fieldGroup('Voc No')}>
                    <label style={labelStyle}>Voc No</label>
                    <input style={isReadOnly ? readInput : inputStyle} value={header.vocNo} onChange={e => setHdr('vocNo', e.target.value)} readOnly={isReadOnly} />
                  </div>
                  <div style={fieldGroup('Salesman')}>
                    <label style={labelStyle}>Salesman</label>
                    <input style={isReadOnly ? readInput : inputStyle} value={header.salesman} onChange={e => setHdr('salesman', e.target.value)} readOnly={isReadOnly} />
                  </div>
                </div>

                {/* Row 4 — Reference */}
                <div style={{ border: `1px solid ${S.border}`, borderRadius: '0.3rem', padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: '700', color: S.muted, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reference</div>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <label style={labelStyle}>Number</label>
                      <input style={isReadOnly ? readInput : inputStyle} value={header.refNo} onChange={e => setHdr('refNo', e.target.value)} readOnly={isReadOnly} />
                    </div>
                    <div style={{ flex: 1, minWidth: '160px' }}>
                      <label style={labelStyle}>Date</label>
                      <input style={isReadOnly ? readInput : inputStyle} type="date" value={header.refDate} onChange={e => setHdr('refDate', e.target.value)} readOnly={isReadOnly} />
                    </div>
                  </div>
                </div>

                {/* Row 5 — Narration + Posted Date */}
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 3, minWidth: '200px' }}>
                    <label style={labelStyle}>Narration</label>
                    <input style={isReadOnly ? readInput : inputStyle} value={header.narration} onChange={e => setHdr('narration', e.target.value)} readOnly={isReadOnly} placeholder="Description / Narration" />
                  </div>
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={labelStyle}>Posted Date</label>
                    <input style={isReadOnly ? readInput : inputStyle} type="date" value={header.postedDate} onChange={e => setHdr('postedDate', e.target.value)} readOnly={isReadOnly} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Account Details tab ── */}
          {headerTab === 'accounts' && (
            <div style={sectionBox}>
              <div style={sectionBody}>
                <div style={{ marginBottom: '0.85rem', border: `1px solid ${S.border}`, borderRadius: '0.45rem', padding: '0.6rem 0.7rem', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: S.ink }}>
                      Recent {voucherType === 'payment' ? 'Payment' : 'Receipt'} Vouchers (Last 5)
                    </p>
                    {loadingRecentPartyVouchers && <span style={{ fontSize: '0.75rem', color: S.muted }}>Loading...</span>}
                  </div>
                  {!recentPartyVouchers.length ? (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: S.muted }}>
                      No recent vouchers found for this account.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: S.headerBg }}>
                            {['Voc No', 'Date', 'Type', 'Amount', 'Status'].map((headerCell) => (
                              <th key={headerCell} style={{ padding: '0.38rem 0.5rem', textAlign: headerCell === 'Amount' ? 'right' : 'left', borderBottom: `1px solid ${S.border}`, color: S.ink }}>{headerCell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentPartyVouchers.map((item, idx) => (
                            <tr key={item.id} style={{ background: idx % 2 === 0 ? S.white : S.bg, borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '0.35rem 0.5rem', fontWeight: '700', color: S.green }}>{item.vocNo}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{item.date}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{item.type}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{item.currency} {fmt(item.amount)}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{item.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {lineItems.length === 0 ? (
                  <p style={{ color: S.muted, fontSize: '0.875rem' }}>No line items added yet. Switch to Line Items tab to add entries.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: S.headerBg }}>
                        {['A/C Code', 'Type', 'Currency', 'Amount FC', 'Amount LC', 'Narration'].map(h => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: '700', color: S.ink, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((l, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.white : S.bg }}>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{l.acCode}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{l.type}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{l.currCode}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountFC)}</td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountLC)}</td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>{l.narration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Inner tabs: Line Items | Attachments ── */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0' }}>
            <button style={tabBtn(innerTab === 'lineItems')} onClick={() => setInnerTab('lineItems')}>
              1. {t('lineItems')}
            </button>
            <button style={tabBtn(innerTab === 'attachments')} onClick={() => setInnerTab('attachments')}>
              2. {t('attachments')}
            </button>
          </div>

          {/* ── Line Items panel ── */}
          {innerTab === 'lineItems' && (
            <div style={sectionBox}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', ...sectionHeader }}>
                <span>Line Items</span>
                {!isReadOnly && !showLineForm && (
                  <button style={{ ...btn('primary'), padding: '0.25rem 0.7rem', fontSize: '0.78rem' }} onClick={openAddLine}>
                    + Add Line
                  </button>
                )}
              </div>

              {/* Line items table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: S.headerBg }}>
                      {['No.', 'Branch', 'A/C Code', 'Type', 'Cheque No', 'Cheque Dt', 'Bank', 'Curr', 'Amount FC', 'Amount LC', ''].map(h => (
                        <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: h === 'Amount FC' || h === 'Amount LC' ? 'right' : 'left', fontWeight: '700', color: S.ink, borderBottom: `1px solid ${S.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={11} style={{ padding: '1.5rem', textAlign: 'center', color: S.muted }}>
                          {isReadOnly ? 'No line items.' : 'Click "+ Add Line" to add entries.'}
                        </td>
                      </tr>
                    ) : lineItems.map((l, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? S.white : S.bg, borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{i + 1}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{l.branch}</td>
                        <td style={{ padding: '0.4rem 0.6rem', fontWeight: '600' }}>{l.acCode}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>
                          <span style={{ padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '700', background: normalizeLineType(l.type) === 'Cash' ? '#D1FAE5' : normalizeLineType(l.type) === 'Cheque' || normalizeLineType(l.type) === 'TT' ? '#DBEAFE' : '#FEF3C7', color: normalizeLineType(l.type) === 'Cash' ? '#065F46' : normalizeLineType(l.type) === 'Cheque' || normalizeLineType(l.type) === 'TT' ? '#1D4ED8' : '#92400E' }}>
                            {normalizeLineType(l.type) === 'TT' ? 'TT' : normalizeLineType(l.type)}
                          </span>
                        </td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{l.chqNo || '-'}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{l.chqDate ? l.chqDate.slice(0, 10) : '-'}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{l.chqBank || '-'}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>{l.currCode}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{fmt(l.amountFC)}</td>
                        <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right', fontWeight: '700' }}>{fmt(l.amountLC)}</td>
                        <td style={{ padding: '0.4rem 0.6rem' }}>
                          {!isReadOnly && (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button style={{ ...btn('secondary'), padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => openEditLine(i)}>Edit</button>
                              <button style={{ ...btn('danger'), padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => deleteLine(i)}>Del</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Line Detail Add/Edit Form ── */}
              {showLineForm && (
                <div style={{ borderTop: `2px solid ${S.green}`, padding: '0.75rem', background: S.blueSoft }}>
                  <div style={{ fontWeight: '700', fontSize: '0.85rem', color: S.ink, marginBottom: '0.75rem' }}>
                    {editingLineIdx !== null ? '✏️ Edit Line Item' : '➕ Add Line Item'}
                  </div>

                  {/* Line form row 1 */}
                  <div style={fieldRow}>
                    <div>
                      <label style={labelStyle}>Branch</label>
                      <input style={inputStyle} value={lineForm.branch} onChange={e => setLF('branch', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select style={inputStyle} value={lineForm.type} onChange={e => handleLineTypeChange(e.target.value)}>
                        <option value="Cash">Cash</option>
                        <option value="Cheque">Cheque</option>
                        <option value="TT">TT</option>
                        <option value="Card">Card</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Type Code</label>
                      <input style={inputStyle} value={lineForm.typeCode} onChange={e => setLF('typeCode', e.target.value)} />
                    </div>
                  </div>

                  {/* Line form row 2 */}
                  <div style={fieldRow}>
                    <div>
                      <label style={labelStyle}>A/C Code *</label>
                      <input style={inputStyle} value={lineForm.acCode} onChange={e => setLF('acCode', e.target.value)} placeholder="e.g. 120000" list="accode-list" />
                      <datalist id="accode-list">
                        {accounts.map(a => <option key={a._id} value={a.code}>{a.code} — {a.name}</option>)}
                      </datalist>
                    </div>
                    <div>
                      <label style={labelStyle}>Curr Code</label>
                      <select style={inputStyle} value={lineForm.currCode} onChange={e => setLF('currCode', e.target.value)}>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Curr Rate</label>
                      <input style={inputStyle} type="number" step="0.000001" value={lineForm.currRate} onChange={e => setLF('currRate', e.target.value)} placeholder={header.currRate} />
                    </div>
                  </div>

                  {/* Line form row 3 */}
                  <div style={fieldRow}>
                    <div>
                      <label style={labelStyle}>Exp</label>
                      <input style={inputStyle} value={lineForm.exp} onChange={e => setLF('exp', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>TRN Number</label>
                      <input style={inputStyle} value={lineForm.trnNumber} onChange={e => setLF('trnNumber', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>TRN Inv.</label>
                      <input style={inputStyle} value={lineForm.trnInv} onChange={e => setLF('trnInv', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>TRN Inv. Date</label>
                      <input style={inputStyle} type="date" value={lineForm.trnInvDate} onChange={e => setLF('trnInvDate', e.target.value)} />
                    </div>
                  </div>

                  {/* Line form row 4 */}
                  <div style={fieldRow}>
                    <div>
                      <label style={labelStyle}>HSN. A/c</label>
                      <input style={inputStyle} value={lineForm.hsnAc} onChange={e => setLF('hsnAc', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>TRN Ref</label>
                      <input style={inputStyle} value={lineForm.trnRef} onChange={e => setLF('trnRef', e.target.value)} />
                    </div>
                  </div>

                  {/* Cheque fields — show only if type is Cheque */}
                  {lineForm.type === 'Cheque' && (
                    <div style={fieldRow}>
                      <div>
                        <label style={labelStyle}>Chq No</label>
                        <input style={inputStyle} value={lineForm.chqNo} onChange={e => setLF('chqNo', e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Chq Date</label>
                        <input style={inputStyle} type="date" value={lineForm.chqDate} onChange={e => setLF('chqDate', e.target.value)} />
                      </div>
                      <div>
                        <label style={labelStyle}>Chq Bank</label>
                        <input style={inputStyle} value={lineForm.chqBank} onChange={e => setLF('chqBank', e.target.value)} />
                      </div>
                    </div>
                  )}

                  {/* Amount fields */}
                  <div style={{ ...fieldRow, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    <div>
                      <label style={labelStyle}>Amount FC</label>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.01"
                        value={lineForm.amountFC}
                        onChange={e => handleAmountFC(e.target.value)}
                        onKeyDown={handleLineAmountEnter}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Amount LC *</label>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.01"
                        value={lineForm.amountLC}
                        onChange={e => handleAmountLC(e.target.value)}
                        onKeyDown={handleLineAmountEnter}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Header Amt</label>
                      <input style={inputStyle} type="number" step="0.01" value={lineForm.headerAmt} onChange={e => setLF('headerAmt', e.target.value)} />
                    </div>
                  </div>

                  {/* TRN amount fields */}
                  <div style={{ ...fieldRow, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    <div>
                      <label style={labelStyle}>TRN Per%</label>
                      <input style={inputStyle} type="number" step="0.01" value={lineForm.trnPer} onChange={e => {
                        setLF('trnPer', e.target.value)
                        const pct = parseFloat(e.target.value) || 0
                        const amtLC = parseFloat(lineForm.amountLC) || 0
                        const amtFC = parseFloat(lineForm.amountFC) || 0
                        const trnLC = (amtLC * pct) / 100
                        const trnFC = (amtFC * pct) / 100
                        setLF('trnAmountLC', trnLC.toFixed(2))
                        setLF('trnAmountFC', trnFC.toFixed(2))
                        setLF('amountWithTRN', (amtLC + trnLC).toFixed(2))
                      }} />
                    </div>
                    <div>
                      <label style={labelStyle}>TRN Amount FC</label>
                      <input style={inputStyle} type="number" step="0.01" value={lineForm.trnAmountFC} onChange={e => setLF('trnAmountFC', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>TRN Amount LC</label>
                      <input style={inputStyle} type="number" step="0.01" value={lineForm.trnAmountLC} onChange={e => setLF('trnAmountLC', e.target.value)} />
                    </div>
                  </div>

                  <div style={{ ...fieldRow, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                    <div>
                      <label style={labelStyle}>Amount With TRN</label>
                      <input style={inputStyle} type="number" step="0.01" value={lineForm.amountWithTRN} onChange={e => setLF('amountWithTRN', e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Header Amt With TRN</label>
                      <input style={inputStyle} type="number" step="0.01" value={lineForm.headerAmountWithTRN} onChange={e => setLF('headerAmountWithTRN', e.target.value)} />
                    </div>
                  </div>

                  {/* Narration */}
                  <div style={{ marginBottom: '0.5rem' }}>
                    <label style={labelStyle}>Narration</label>
                    <input style={inputStyle} value={lineForm.narration} onChange={e => setLF('narration', e.target.value)} />
                  </div>

                  {/* Continue / Save / Cancel */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <button style={btn('gray')} onClick={() => {
                      saveLine()
                      if (!lineForm.acCode.trim()) return
                      // Continue = save and open blank form again
                      setTimeout(() => openAddLine(), 50)
                    }}>
                      Continue
                    </button>
                    <button style={btn('primary')} onClick={saveLine}>Save Line</button>
                    <button style={btn('secondary')} onClick={cancelLine}>Cancel</button>
                  </div>
                </div>
              )}

              {/* ── Totals ── */}
              <div style={{ borderTop: `2px solid ${S.border}`, padding: '0.75rem', background: S.bg }}>
                <table style={{ marginLeft: 'auto', width: '320px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.3rem 0.75rem', color: S.muted, textAlign: 'right' }}>Total</td>
                      <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.total)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.3rem 0.75rem', color: S.muted, textAlign: 'right' }}>Party Curr → {header.currCode}</td>
                      <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.total)}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.3rem 0.75rem', color: S.muted, textAlign: 'right' }}>Total TRN Amount</td>
                      <td style={{ padding: '0.3rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.trnAmount)}</td>
                    </tr>
                    <tr style={{ borderTop: `2px solid ${S.border}` }}>
                      <td style={{ padding: '0.4rem 0.75rem', color: S.ink, textAlign: 'right', fontWeight: '700' }}>Grand Total</td>
                      <td style={{ padding: '0.4rem 0.75rem', textAlign: 'right', fontWeight: '800', fontSize: '1rem', color: S.green }}>{fmt(totals.grandTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Attachments panel ── */}
          {innerTab === 'attachments' && (
            <div style={sectionBox}>
              <div style={sectionHeader}>Attachments</div>
              <div style={{ ...sectionBody, color: S.muted, fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
                {editingId
                  ? 'Attachments can be managed via the Transactions tab.'
                  : 'Save the voucher first, then add attachments.'}
              </div>
            </div>
          )}

          {/* ── Voucher Workflow ── */}
          {editingId && (
            <div style={sectionBox}>
              <div style={sectionHeader}>{t('approvalWorkflow')}</div>
              <div style={sectionBody}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(320px, 1.6fr)', gap: '0.75rem', alignItems: 'start' }}>
                  <div>
                    <label style={labelStyle}>Workflow Note</label>
                    <textarea
                      value={workflowNote}
                      onChange={(e) => setWorkflowNote(e.target.value)}
                      rows={3}
                      placeholder="Optional note for submit / approve / post"
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '76px' }}
                      readOnly={isReadOnly || saving}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: '700', background: currentVoucherStatus === 'draft' ? '#FEF3C7' : currentVoucherStatus === 'submitted' ? '#DBEAFE' : currentVoucherStatus === 'approved' ? '#DCFCE7' : currentVoucherStatus === 'posted' ? '#D1FAE5' : currentVoucherStatus === 'returned' ? '#FCE7F3' : '#FEE2E2', color: currentVoucherStatus === 'draft' ? '#92400E' : currentVoucherStatus === 'submitted' ? '#1D4ED8' : currentVoucherStatus === 'approved' ? '#166534' : currentVoucherStatus === 'posted' ? '#065F46' : currentVoucherStatus === 'returned' ? '#9D174D' : '#B91C1C' }}>
                      Current: {currentVoucherStatus}
                    </span>
                    {canSubmitWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('submit')} style={{ ...btn('gray'), background: '#F59E0B', color: '#111827' }}>
                        {t('submit')}
                      </button>
                    )}
                    {canApproveWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('approve')} style={{ ...btn('gray'), background: '#0EA5E9', color: '#FFFFFF' }}>
                        {t('approve')}
                      </button>
                    )}
                    {canReturnWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('return')} style={{ ...btn('gray'), background: '#F472B6', color: '#831843' }}>
                        {t('returnForEdit')}
                      </button>
                    )}
                    {canRejectWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('reject')} style={{ ...btn('gray'), background: '#FEE2E2', color: '#B91C1C' }}>
                        {t('reject')}
                      </button>
                    )}
                    {canPostWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('post')} style={{ ...btn('primary') }}>
                        {t('post')}
                      </button>
                    )}
                    {!canSubmitWorkflow && !canApproveWorkflow && !canReturnWorkflow && !canRejectWorkflow && !canPostWorkflow && (
                      <span style={{ color: S.muted, fontSize: '0.82rem' }}>No workflow action available for your role or current status.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {!isReadOnly && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${S.border}` }}>
              <button
                style={{ ...btn('primary'), opacity: saving ? 0.7 : 1 }}
                onClick={saveVoucher}
                disabled={saving}
              >
                {saving ? 'Saving...' : (editingId ? '💾 Update Voucher' : '💾 Save Voucher')}
              </button>
              <button style={btn('secondary')} onClick={() => setMode('list')}>
                {t('cancel')}
              </button>
            </div>
          )}
          {isReadOnly && (
            <div style={{ marginTop: '0.75rem' }}>
              <button style={btn('secondary')} onClick={() => setMode('list')}>← Back</button>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}
