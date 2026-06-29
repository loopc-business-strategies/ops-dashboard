/**
 * Safe ERPTab phase-3 patch (targeted replacements only).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(__dirname, '../src/components/tabs/ERPTab.jsx')
let src = fs.readFileSync(file, 'utf8')

function replaceOnce(haystack, needle, replacement, label) {
  if (!haystack.includes(needle)) {
    console.warn(`SKIP (not found): ${label}`)
    return haystack
  }
  console.log(`OK: ${label}`)
  return haystack.replace(needle, replacement)
}

const importBlock = `import { useFixingRegisterPanelDrag } from './erp/useFixingRegisterPanelDrag'
import { useJvModalDragResize } from './erp/useJvModalDragResize'
import { useFixingRegisterStockTypeOptions } from './erp/useFixingRegisterStockTypeOptions'
import { loadFixingRegisterData } from './erp/fixingRegisterDataLoader'
import { useTransactionComposer } from './erp/useTransactionComposer'
import { useJournalVoucher } from './erp/useJournalVoucher'
import {
  fixingRegFmtQty,
  fixingRegFmtRate,
  fixingRegFmtAmt,
} from './erp/fixingRegisterUtils'
`

if (!src.includes('useFixingRegisterPanelDrag')) {
  src = replaceOnce(
    src,
    "import { useErpDashWidgets } from './erp/useErpDashWidgets'",
    `import { useErpDashWidgets } from './erp/useErpDashWidgets'\n${importBlock}`,
    'imports',
  )
}

src = replaceOnce(
  src,
  `  const [transactionForm, setTransactionForm] = useState(createTransactionForm)
  const [editingTransactionId, setEditingTransactionId] = useState('')
`,
  '',
  'transaction state',
)

// fixing register stock options
const stockOld = `  const fixingRegisterStockTypeOptions = useMemo(() => {
    const normalizeToMetalCode = (rawValue) => {
      const normalized = String(rawValue || '').trim().toLowerCase()
      if (!normalized) return ''
      if (normalized === 'xau' || normalized === 'gold') return 'XAU'
      if (normalized === 'xag' || normalized === 'silver') return 'XAG'
      if (normalized === 'xpt' || normalized === 'platinum') return 'XPT'
      if (normalized === 'xpd' || normalized === 'palladium') return null
      return String(rawValue || '').trim().toUpperCase()
    }
    const stockTypeOptions = inventoryMappingProducts.map((item) => {
      const meta = decodeInventoryCategoryMeta(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const labelName = titleCaseWords(meta.mainStock || meta.metalType || item.name || item.sku || 'Stock Type')
      const puritySuffix = meta.purity ? \` (\${meta.purity})\` : ''
      return {
        id: item._id,
        value: \`\${metalCode}::\${item._id}\`,
        metalCode,
        label: \`\${labelName}\${puritySuffix}\`,
      }
    }).filter((option) => Boolean(option.metalCode))
    if (stockTypeOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...stockTypeOptions,
      ]
    }
    // Legacy fallback for older datasets where stock types were not encoded in mapping records.
    const legacyProductOptions = inventoryCatalogProducts.map((item) => {
      const meta = decodeInventoryCategoryPairs(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const productLabel = titleCaseWords(meta.productCategory || item.name || item.sku || 'Product')
      const puritySuffix = meta.productPurity ? \` (\${meta.productPurity})\` : ''
      return {
        id: item._id,
        value: \`\${metalCode}::\${item._id}\`,
        metalCode,
        label: \`\${productLabel}\${puritySuffix}\`,
      }
    }).filter((option) => Boolean(option.metalCode))
    if (legacyProductOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...legacyProductOptions,
      ]
    }
    // Final fallback: allow fixing register to work even when no inventory stock type/product records exist.
    return [
      { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
      { id: 'metal-gold', value: 'XAU::fallback-gold', metalCode: 'XAU', label: 'Gold (XAU)' },
      { id: 'metal-silver', value: 'XAG::fallback-silver', metalCode: 'XAG', label: 'Silver (XAG)' },
      { id: 'metal-platinum', value: 'XPT::fallback-platinum', metalCode: 'XPT', label: 'Platinum (XPT)' },
      { id: 'metal-other', value: 'OTHER::fallback-other', metalCode: 'OTHER', label: 'Other Metals' },
    ]
  }, [inventoryCatalogProducts, inventoryMappingProducts])`

src = replaceOnce(
  src,
  stockOld,
  `  const fixingRegisterStockTypeOptions = useFixingRegisterStockTypeOptions({
    inventoryMappingProducts,
    inventoryCatalogProducts,
  })`,
  'fixing stock options',
)

const dragOld = `  const beginFixingRegPanelDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setFixingRegPanelDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: fixingRegPanelOffset.x,
      startY: fixingRegPanelOffset.y,
    })
  }
  const beginJvModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setJvModalDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: jvModalOffset.x,
      startY: jvModalOffset.y,
    })
  }
  const beginJvModalResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    setJvModalResize({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startW: jvModalSize.width,
      startH: jvModalSize.height,
    })
  }
`

src = replaceOnce(
  src,
  dragOld,
  `  const { beginFixingRegPanelDrag } = useFixingRegisterPanelDrag({
    activeTab,
    fixingRegPanelOffset,
    fixingRegPanelDrag,
    setFixingRegPanelDrag,
    setFixingRegPanelOffset,
  })
  const { beginJvModalDrag, beginJvModalResize } = useJvModalDragResize({
    showLedgerForm,
    jvModalDrag,
    setJvModalDrag,
    jvModalOffset,
    setJvModalOffset,
    jvModalResize,
    setJvModalResize,
    jvModalSize,
    setJvModalSize,
    jvModalDefaultSize: JV_MODAL_DEFAULT_SIZE,
  })
`,
  'drag handlers',
)

const jvFxEffect = `  useEffect(() => {
    if (!showLedgerForm) {
      setJvModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setJvModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      setJvModalResize((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startW === JV_MODAL_DEFAULT_SIZE.width && prev.startH === JV_MODAL_DEFAULT_SIZE.height) return prev
        return { active: false, pointerX: 0, pointerY: 0, startW: JV_MODAL_DEFAULT_SIZE.width, startH: JV_MODAL_DEFAULT_SIZE.height }
      })
      setJvModalSize((prev) => (prev.width === JV_MODAL_DEFAULT_SIZE.width && prev.height === JV_MODAL_DEFAULT_SIZE.height ? prev : JV_MODAL_DEFAULT_SIZE))
      return undefined
    }
    if (!jvModalDrag.active) return undefined
    const onMouseMove = (event) => {
      setJvModalOffset({
        x: jvModalDrag.startX + (event.clientX - jvModalDrag.pointerX),
        y: jvModalDrag.startY + (event.clientY - jvModalDrag.pointerY),
      })
    }
    const onMouseUp = () => {
      setJvModalDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalDrag])
  useEffect(() => {
    if (!showLedgerForm || !jvModalResize.active) return undefined
    const onMouseMove = (event) => {
      const nextWidth = Math.max(860, Math.min(window.innerWidth - 24, jvModalResize.startW + (event.clientX - jvModalResize.pointerX)))
      const nextHeight = Math.max(500, Math.min(window.innerHeight - 24, jvModalResize.startH + (event.clientY - jvModalResize.pointerY)))
      setJvModalSize({ width: nextWidth, height: nextHeight })
    }
    const onMouseUp = () => {
      setJvModalResize((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [showLedgerForm, jvModalResize])
  useEffect(() => {
    if (activeTab !== 'fixing-register') {
      setFixingRegPanelOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setFixingRegPanelDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }
    if (!fixingRegPanelDrag.active) return undefined
    const onMouseMove = (event) => {
      setFixingRegPanelOffset({
        x: fixingRegPanelDrag.startX + (event.clientX - fixingRegPanelDrag.pointerX),
        y: fixingRegPanelDrag.startY + (event.clientY - fixingRegPanelDrag.pointerY),
      })
    }
    const onMouseUp = () => {
      setFixingRegPanelDrag((prev) => ({ ...prev, active: false }))
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [activeTab, fixingRegPanelDrag])
`

src = replaceOnce(src, jvFxEffect, '', 'jv/fixing drag effects')

src = replaceOnce(
  src,
  `  const resetTransactionComposer = () => {
    setEditingTransactionId('')
    setTransactionForm({
      ...createTransactionForm(),
      currency: baseCurrencyCode,
      exchangeRate: '1',
    })
  }
`,
  '',
  'resetTransactionComposer',
)

src = replaceOnce(
  src,
  `  const populateTransactionForm = (tx) => {
    void loadTransactionReferenceData()
    setEditingTransactionId(tx._id)
    setSelectedTransactionId(tx._id)
    setTransactionForm({
      type: tx.type || 'expense',
      metalFixStatus: String(tx.voucherMeta?.fixingType || '').toLowerCase().includes('non') ? 'unfixed' : 'fixed',
      amount: String(tx.amount ?? ''),
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      currency: tx.currency || 'USD',
      exchangeRate: String(tx.exchangeRate ?? 1),
      description: tx.description || '',
      customerId: tx.customerId?._id || tx.customerId || '',
      vendorId: tx.vendorId?._id || tx.vendorId || '',
      inventoryItemId: tx.inventoryItemId?._id || tx.inventoryItemId || '',
      mappingId: tx.mappingId?._id || tx.mappingId || '',
      debitAccountId: tx.debitAccountId?._id || tx.debitAccountId || '',
      creditAccountId: tx.creditAccountId?._id || tx.creditAccountId || '',
    })
  }
  const getTransactionValidationMessage = () => {
    if (!transactionForm.type || !transactionForm.amount) return 'Transaction type and amount are required'
    if (Number(transactionForm.amount) <= 0) return 'Amount must be greater than zero'
    if (['sale', 'receipt'].includes(transactionForm.type) && !transactionForm.customerId) return 'Customer is required for sales and receipts'
    if (['purchase', 'payment'].includes(transactionForm.type) && !transactionForm.vendorId) return 'Vendor is required for purchases and payments'
    return ''
  }
  useEffect(() => {
    const normalizedType = String(transactionForm.type || '').toLowerCase()
    if (!['receipt', 'payment'].includes(normalizedType)) return
    let selectedAccountCurrency = ''
    if (normalizedType === 'receipt' && transactionForm.customerId) {
      const customer = customers.find((item) => String(item._id) === String(transactionForm.customerId))
      selectedAccountCurrency = String(customer?.ledgerAccountId?.currency || customer?.currency || '').trim().toUpperCase()
    }
    if (normalizedType === 'payment' && transactionForm.vendorId) {
      const vendor = vendors.find((item) => String(item._id) === String(transactionForm.vendorId))
      selectedAccountCurrency = String(vendor?.ledgerAccountId?.currency || vendor?.currency || '').trim().toUpperCase()
    }
    if (!selectedAccountCurrency) return
    if (String(transactionForm.currency || '').toUpperCase() === selectedAccountCurrency) return
    const matchedCurrency = currencies.find((currency) => String(currency.code || '').toUpperCase() === selectedAccountCurrency)
    const nextRate = Number(matchedCurrency?.exchangeRate || 1)
    setTransactionForm((prev) => ({
      ...prev,
      currency: selectedAccountCurrency,
      exchangeRate: Number.isFinite(nextRate) && nextRate > 0 ? String(nextRate) : prev.exchangeRate,
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync party account currency when party changes only (omit manual \`currency\` edits)
  }, [transactionForm.type, transactionForm.customerId, transactionForm.vendorId, customers, vendors, currencies])
`,
  '',
  'transaction composer helpers',
)

src = replaceOnce(
  src,
  `  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    const validationMessage = getTransactionValidationMessage()
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...transactionForm,
        currency: baseCurrencyCode,
        exchangeRate: 1,
        amount: Number(transactionForm.amount),
        ...(['sale', 'purchase'].includes(String(transactionForm.type || '').toLowerCase()) ? { metalFixStatus: transactionForm.metalFixStatus || 'fixed' } : {}),
      }
      const response = isTransactionEditMode
        ? await erpAccountingAPI.updateTransaction(token, editingTransactionId, payload)
        : await erpAccountingAPI.createTransaction(token, payload)
      resetTransactionComposer()
      setSelectedTransactionId(response.transaction?._id || '')
      await loadTransactions({ cursor: null, cursorHistory: [] })
      showNotification(isTransactionEditMode ? '✅ Transaction updated' : '✅ Transaction created as draft')
    } catch (e) {
      setError(e.response?.data?.message || \`Failed to \${isTransactionEditMode ? 'update' : 'create'} transaction\`)
    } finally {
      setSaving(false)
    }
  }
`,
  '',
  'handleCreateTransaction',
)

if (!src.includes('useTransactionComposer({')) {
  src = replaceOnce(
    src,
    `    setTransactionsLoading(false)
  }
  const toggleTransactionSelection = (id) => {`,
    `    setTransactionsLoading(false)
  }
  const {
    transactionForm,
    setTransactionForm,
    editingTransactionId,
    setEditingTransactionId,
    isTransactionEditMode,
    resetTransactionComposer,
    populateTransactionForm,
    getTransactionValidationMessage: _getTransactionValidationMessage,
    handleCreateTransaction,
  } = useTransactionComposer({
    baseCurrencyCode,
    customers,
    vendors,
    currencies,
    token,
    loadTransactionReferenceData,
    loadTransactions,
    setError,
    setSaving,
    setSelectedTransactionId,
    showNotification,
    erpAccountingAPI,
  })
  const toggleTransactionSelection = (id) => {`,
    'useTransactionComposer hook',
  )
}

src = replaceOnce(
  src,
  '  const isTransactionEditMode = Boolean(editingTransactionId)\n',
  '',
  'duplicate isTransactionEditMode',
)

// fixing register: remove inline utils + huge proceed handler — use marker boundaries
const fixStart = src.indexOf('  const FIXING_REG_UNIT_PER_OZ = { GOZ: 1')
const fixEnd = src.indexOf('  const getDepartmentBadgeStyle = (department) => {')
if (fixStart !== -1 && fixEnd > fixStart) {
  const fixHandler = `  const handleFixingRegProceed = async () => {
    setFixingRegError('')
    setFixingRegLoading(true)
    try {
      const { rows, opening } = await loadFixingRegisterData({ token, fixingRegFilter })
      setFixingRegOpening(opening)
      setFixingRegResults(rows)
      setFixingRegShown(true)
    } catch (err) {
      setFixingRegError(err?.response?.data?.message || err.message || 'Failed to load fixing register data.')
    } finally {
      setFixingRegLoading(false)
    }
  }
`
  src = `${src.slice(0, fixStart)}${fixHandler}${src.slice(fixEnd)}`
  console.log('OK: fixing register loader')
}

if (!src.includes('useJournalVoucher({')) {
  src = replaceOnce(
    src,
    `    w.print()
  }
  const escapeHtml = (value) => String(value ?? '')`,
    `    w.print()
  }
  const {
    updateJvLine,
    resolveJvLineAccount,
    getJvValidation,
    addJvLine,
    removeJvLine,
    handleJvLineKeyDown,
    handleJvAccountKeyDown,
    resetJvForm: _resetJvForm,
    handleOpenJv,
    handleEditJv,
    closeJvModal,
    openJvModal,
    switchJvMode,
    handleRepairJvFxPreview,
    handleRepairJvFxApply,
    handleSaveMultiLineJV,
    handlePrintJvVoucher,
    getJvAccountById: _getJvAccountById,
    isExchangeLine: _isExchangeLine,
  } = useJournalVoucher({
    jvMode,
    setJvMode,
    jvLines,
    setJvLines,
    jvHeader,
    setJvHeader,
    nextJvLineId,
    setNextJvLineId,
    jvEditEntryIds,
    setJvEditEntryIds,
    jvReadOnly,
    setJvReadOnly,
    entryAccountOptions,
    baseCurrencyCode,
    inventoryTenantKey,
    convertJvAmount,
    inferJvAccountCurrency,
    token,
    erpAccountingAPI,
    currencies,
    setError,
    setSaving,
    loadLedger,
    loadDashboard,
    showNotification,
    branding,
    buildBrandingLogoTag,
    openPrintWindow,
    defaultCompanyName: DEFAULT_BRANDING.companyName,
    user,
    JV_MODAL_DEFAULT_SIZE,
    setJvModalOffset,
    setJvModalDrag,
    setJvModalResize,
    setJvModalSize,
    setShowLedgerForm,
    buildJvDocNo,
    ledgerVoucherTab,
    canCloseLedgerPeriod,
  })
  const escapeHtml = (value) => String(value ?? '')`,
    'useJournalVoucher hook',
  )
}

const jvBlockStart = src.indexOf('  // ─── Multi-line Journal Voucher helpers ──────────────────────────────────────')
const jvBlockEnd = src.indexOf('  // ─────────────────────────────────────────────────────────────────────────────\n  const handleCreateCustomer = async (e) => {')
if (jvBlockStart !== -1 && jvBlockEnd > jvBlockStart) {
  src = `${src.slice(0, jvBlockStart)}${src.slice(jvBlockEnd)}`
  console.log('OK: removed inline JV block')
}

fs.writeFileSync(file, src)
console.log('Done.')
