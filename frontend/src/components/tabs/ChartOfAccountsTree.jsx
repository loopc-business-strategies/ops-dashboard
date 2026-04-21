import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import erpAccountingAPI from '../../api/erp-accounting'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'

const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']

const TYPE_CONFIG = {
  Asset:     { label: 'Assets',      color: '#2563EB', bg: '#EFF6FF', icon: '🏦' },
  Liability: { label: 'Liabilities', color: '#DC2626', bg: '#FEF2F2', icon: '📋' },
  Equity:    { label: 'Equity',      color: '#7C3AED', bg: '#F5F3FF', icon: '💰' },
  Income:    { label: 'Income',      color: '#059669', bg: '#F0FDF4', icon: '📈' },
  Expense:   { label: 'Expenses',    color: '#D97706', bg: '#FFFBEB', icon: '📉' },
}

const ACTION_PRESETS = {
  group:    { label: 'Add Group',             accountType: null },
  customer: { label: 'Add Customer Account',  accountType: 'Asset' },
  supplier: { label: 'Add Supplier Account',  accountType: 'Liability' },
  bank:     { label: 'Add Bank Account',      accountType: 'Asset' },
  general:  { label: 'Add General Account',   accountType: null },
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildTree(accounts) {
  const byId = {}
  accounts.forEach(a => { byId[a._id] = { ...a, children: [] } })

  const roots = { Asset: [], Liability: [], Equity: [], Income: [], Expense: [] }

  accounts.forEach(a => {
    const node = byId[a._id]
    const parentId = a.parentAccountId?._id || a.parentAccountId
    if (parentId && byId[parentId]) {
      byId[parentId].children.push(node)
    } else if (roots[a.accountType]) {
      roots[a.accountType].push(node)
    }
  })

  ACCOUNT_TYPES.forEach(t => roots[t].sort((a, b) => a.accountCode.localeCompare(b.accountCode)))

  return { byId, roots }
}

function countNodes(nodes) {
  let n = 0
  nodes.forEach(node => { n += 1 + countNodes(node.children || []) })
  return n
}

function nodeMatches(node, search) {
  const s = search.toLowerCase()
  return node.accountName.toLowerCase().includes(s) || node.accountCode.toLowerCase().includes(s)
}

function hasMatchInSubtree(node, search) {
  if (nodeMatches(node, search)) return true
  return (node.children || []).some(c => hasMatchInSubtree(c, search))
}

function collectExpandIdsForSearch(nodes, search, acc = new Set()) {
  nodes.forEach(node => {
    const childMatch = (node.children || []).some(c => hasMatchInSubtree(c, search))
    if (childMatch) acc.add(node._id)
    collectExpandIdsForSearch(node.children || [], search, acc)
  })
  return acc
}

const emptyForm = () => ({
  accountName: '',
  accountCode: '',
  accountType: '',
  parentAccountId: '',
  currency: 'USD',
  description: '',
  openingBalance: '',
  department: '',
  createAs: 'standard',
  linkedCustomerId: '',
})

// ─── main component ────────────────────────────────────────────────────────────

export default function ChartOfAccountsTree({ canManageAccounts, onOpenSummary }) {
  const { token } = useAuth()
  const { t } = useLanguage()

  const [accounts, setAccounts]         = useState([])
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')

  // tree state
  const [expandedIds, setExpandedIds]       = useState(new Set())
  const [expandedTypes, setExpandedTypes]   = useState(new Set(ACCOUNT_TYPES))
  const [selectedNode, setSelectedNode]     = useState(null)

  // search
  const [search, setSearch] = useState('')
  const searchRef = useRef(null)

  // context menu
  const [ctxMenu, setCtxMenu] = useState(null) // { x, y, node }
  const ctxRef = useRef(null)

  // modal
  const [modal, setModal]     = useState(null) // { mode:'add'|'edit'|'move', node, action }
  const [form, setForm]       = useState(emptyForm())
  const [moveTarget, setMoveTarget] = useState('')
  const [saving, setSaving]   = useState(false)
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 })
  const [modalDrag, setModalDrag] = useState({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })
  const [customers, setCustomers] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const receivableParentAccountId = accounts.find((item) => {
    const code = String(item.accountCode || '').trim()
    const name = String(item.accountName || '').toLowerCase()
    return code === '1100' || name.includes('accounts receivable') || name.includes('receivable')
  })?._id || ''
  const unlinkedCustomers = useMemo(
    () => customers.filter((item) => !item.ledgerAccountId),
    [customers]
  )
  const customerOptions = unlinkedCustomers.length > 0 ? unlinkedCustomers : customers

  // ── data loading ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await erpAccountingAPI.getAccounts(token)
      setAccounts(data.accounts || [])
    } catch (e) {
      setError(e?.response?.data?.message || t('failedToLoadAccounts'))
    } finally {
      setLoading(false)
    }
  }, [token, t])

  const loadCustomers = useCallback(async () => {
    setLoadingCustomers(true)
    try {
      const data = await erpAccountingAPI.getCustomers(token, { limit: 500 })
      setCustomers(data.customers || [])
    } catch {
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!modal) {
      setModalOffset({ x: 0, y: 0 })
      setModalDrag({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })
    }
  }, [modal])

  useEffect(() => {
    if (!modalDrag.active) return undefined

    const onMouseMove = (event) => {
      const dx = event.clientX - modalDrag.startX
      const dy = event.clientY - modalDrag.startY
      setModalOffset({ x: modalDrag.originX + dx, y: modalDrag.originY + dy })
    }

    const onMouseUp = () => {
      setModalDrag((prev) => ({ ...prev, active: false }))
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [modalDrag])

  // ── close context menu on outside click ──────────────────────────────────────
  useEffect(() => {
    const handler = e => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── auto-expand parents when searching ───────────────────────────────────────
  useEffect(() => {
    if (!search) return
    const { roots } = buildTree(accounts)
    const allNodes = ACCOUNT_TYPES.flatMap(t => roots[t])
    const ids = collectExpandIdsForSearch(allNodes, search)
    setExpandedIds(prev => new Set([...prev, ...ids]))
  }, [search, accounts])

  // ── derived tree ─────────────────────────────────────────────────────────────
  const { roots } = buildTree(accounts)

  const typeCount = {}
  ACCOUNT_TYPES.forEach(t => { typeCount[t] = countNodes(roots[t] || []) })

  // ── tree interactions ─────────────────────────────────────────────────────────
  const toggleExpand = id =>
    setExpandedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleType = type =>
    setExpandedTypes(prev => { const n = new Set(prev); n.has(type) ? n.delete(type) : n.add(type); return n })

  const handleSelect = node => {
    setSelectedNode(node)
    setCtxMenu(null)
    if (onOpenSummary) onOpenSummary(node)
  }

  const handleRightClick = (e, node) => {
    if (!canManageAccounts) return
    e.preventDefault()
    e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, node })
  }

  // ── modal openers ─────────────────────────────────────────────────────────────
  const openAdd = (action, parentNode) => {
    setCtxMenu(null)
    const preset = ACTION_PRESETS[action] || {}
    if (action === 'customer') {
      loadCustomers()
    }
    setForm({
      ...emptyForm(),
      createAs: action === 'customer' ? 'customer' : 'standard',
      accountType: preset.accountType || (parentNode?.accountType || ''),
      parentAccountId: parentNode?._id || '',
    })
    setModal({ mode: 'add', node: parentNode, action })
  }

  const openEdit = node => {
    setCtxMenu(null)
    setForm({
      accountName:     node.accountName,
      accountCode:     node.accountCode,
      accountType:     node.accountType,
      parentAccountId: node.parentAccountId?._id || node.parentAccountId || '',
      currency:        node.currency || 'USD',
      description:     node.description || '',
      openingBalance:  node.openingBalance ?? '',
      department:      node.department || '',
    })
    setModal({ mode: 'edit', node })
  }

  const openMove = node => {
    setCtxMenu(null)
    setMoveTarget(node.parentAccountId?._id || node.parentAccountId || '')
    setModal({ mode: 'move', node })
  }

  // ── delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async node => {
    setCtxMenu(null)
    if (!window.confirm(`Delete "${node.accountName}"? This will deactivate the account.`)) return
    setError('')
    try {
      await erpAccountingAPI.deleteAccount(token, node._id)
      setSuccess(`"${node.accountName}" deleted`)
      if (selectedNode?._id === node._id) setSelectedNode(null)
      load()
    } catch (e) {
      setError(e?.response?.data?.message || t('deleteFailed'))
    }
  }

  // ── form submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (modal.mode === 'add') {
        const creatingCustomerAccount = modal.action === 'customer' || form.createAs === 'customer'
        if (creatingCustomerAccount && !form.linkedCustomerId) {
          setError('Please select a customer')
          setSaving(false)
          return
        }

        const created = await erpAccountingAPI.createAccount(token, {
          accountName:     form.accountName.trim(),
          accountCode:     form.accountCode.trim(),
          accountType:     form.accountType,
          parentAccountId: form.parentAccountId || null,
          currency:        form.currency || 'USD',
          description:     form.description,
          openingBalance:  form.openingBalance ? Number(form.openingBalance) : 0,
          department:      form.department,
        })

        if (creatingCustomerAccount && form.linkedCustomerId && created?.account?._id) {
          await erpAccountingAPI.updateCustomer(token, form.linkedCustomerId, { ledgerAccountId: created.account._id })
        }

        setSuccess('Account created')
      } else if (modal.mode === 'edit') {
        await erpAccountingAPI.updateAccount(token, modal.node._id, {
          accountName:  form.accountName.trim(),
          description:  form.description,
          currency:     form.currency || 'USD',
          department:   form.department,
          isActive:     true,
        })
        setSuccess('Account updated')
      } else if (modal.mode === 'move') {
        await erpAccountingAPI.updateAccount(token, modal.node._id, {
          parentAccountId: moveTarget || null,
        })
        setSuccess('Account moved')
      }
      setModal(null)
      load()
    } catch (err) {
      setError(err?.response?.data?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const beginModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setModalDrag({
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      originX: modalOffset.x,
      originY: modalOffset.y,
    })
  }

  // ── render a single tree node ─────────────────────────────────────────────────
  const renderNode = (node, depth = 0) => {
    if (search && !hasMatchInSubtree(node, search)) return null

    const hasChildren = node.children?.length > 0
    const isExpanded  = expandedIds.has(node._id)
    const isSelected  = selectedNode?._id === node._id
    const highlight   = search && nodeMatches(node, search)

    return (
      <div key={node._id}>
        <div
          onContextMenu={e => handleRightClick(e, node)}
          onClick={() => handleSelect(node)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            padding: '0.3rem 0.5rem',
            paddingLeft: `${0.5 + depth * 1.25}rem`,
            borderRadius: '0.25rem',
            cursor: 'pointer',
            userSelect: 'none',
            background: isSelected ? '#DBEAFE' : 'transparent',
            borderLeft: isSelected ? '3px solid #2563EB' : '3px solid transparent',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#F3F4F6' }}
          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
        >
          {/* expand arrow */}
          <span
            onClick={e => { e.stopPropagation(); if (hasChildren) toggleExpand(node._id) }}
            style={{ width: '1rem', textAlign: 'center', fontSize: '0.65rem', color: '#9CA3AF', flexShrink: 0 }}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '·'}
          </span>

          {/* type icon */}
          <span style={{ fontSize: '0.75rem', flexShrink: 0 }}>
            {TYPE_CONFIG[node.accountType]?.icon || '📄'}
          </span>

          {/* code + name */}
          <span style={{ fontSize: '0.8rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: '#9CA3AF', marginRight: '0.4rem', fontFamily: 'monospace', fontSize: '0.75rem' }}>
              {node.accountCode}
            </span>
            <span style={{ fontWeight: isSelected || highlight ? '700' : '400', color: highlight ? '#059669' : '#111827' }}>
              {node.accountName}
            </span>
          </span>

          {/* children badge */}
          {hasChildren && (
            <span style={{ fontSize: '0.6rem', background: '#E5E7EB', color: '#6B7280', padding: '0.1rem 0.35rem', borderRadius: '999px', flexShrink: 0 }}>
              {node.children.length}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div>{node.children.map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  // ─── layout ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', gap: '1rem', minHeight: '600px' }}>

      {/* ── LEFT: TREE PANEL ────────────────────────────────────────────────── */}
      <div style={{ flex: '0 0 400px', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* panel header */}
        <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #E5E7EB', background: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: '700', color: '#111827', fontSize: '0.875rem' }}>📂 {t('accountTree')}</span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              title={t('refresh')}
              onClick={() => { setError(''); setSuccess(''); load() }}
              style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: '1px solid #D1D5DB', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', color: '#374151' }}
            >⟳</button>
            {canManageAccounts && (
              <button
                onClick={() => openAdd('general', null)}
                style={{ padding: '0.25rem 0.6rem', background: '#059669', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '700' }}
              >+ {t('add')}</button>
            )}
          </div>
        </div>

        {/* search bar */}
        <div style={{ padding: '0.4rem 0.5rem', borderBottom: '1px solid #F3F4F6' }}>
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`🔍 ${t('searchByNameOrCode')}`}
            style={{ width: '100%', padding: '0.4rem 0.6rem', border: '1px solid #E5E7EB', borderRadius: '0.375rem', fontSize: '0.8rem', color: '#111827', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* tree body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
          {loading ? (
            <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '2rem', margin: 0 }}>{t('loading')}</p>
          ) : (
            ACCOUNT_TYPES.map(type => {
              const cfg   = TYPE_CONFIG[type]
              const nodes = roots[type] || []

              // hide type when searching and nothing matches
              if (search && !nodes.some(n => hasMatchInSubtree(n, search))) return null

              const isOpen = expandedTypes.has(type)
              return (
                <div key={type} style={{ marginBottom: '0.2rem' }}>
                  {/* type header */}
                  <div
                    onClick={() => toggleType(type)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.35rem 0.5rem',
                      background: cfg.bg,
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      userSelect: 'none',
                      marginBottom: '0.1rem',
                    }}
                  >
                    <span style={{ color: cfg.color, fontSize: '0.7rem' }}>{isOpen ? '▼' : '▶'}</span>
                    <span style={{ fontSize: '0.8rem' }}>{cfg.icon}</span>
                    <span style={{ fontWeight: '700', color: cfg.color, fontSize: '0.82rem', flex: 1 }}>{cfg.label}</span>
                    <span style={{ fontSize: '0.65rem', background: cfg.color + '20', color: cfg.color, padding: '0.1rem 0.4rem', borderRadius: '999px', fontWeight: '600' }}>
                      {typeCount[type]}
                    </span>
                  </div>

                  {isOpen && (
                    <div style={{ marginLeft: '0.25rem' }}>
                      {nodes.map(node => renderNode(node, 0))}
                      {nodes.length === 0 && !search && (
                        <p style={{ margin: '0.25rem 0 0.5rem 1.5rem', fontSize: '0.75rem', color: '#D1D5DB', fontStyle: 'italic' }}>
                          {t('noAccounts')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT: DETAIL PANEL ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>

        {/* alerts */}
        {error && (
          <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontWeight: '700' }}>✕</button>
          </div>
        )}
        {success && (
          <div style={{ background: '#DCFCE7', color: '#166534', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>{success}</span>
            <button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534', fontWeight: '700' }}>✕</button>
          </div>
        )}

        {/* ── selected account detail card ── */}
        {selectedNode ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', padding: '1.25rem' }}>
            {/* header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: '700',
                    background: TYPE_CONFIG[selectedNode.accountType]?.bg || '#F3F4F6',
                    color: TYPE_CONFIG[selectedNode.accountType]?.color || '#374151',
                  }}>
                    {selectedNode.accountType}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: selectedNode.isActive ? '#059669' : '#DC2626', fontWeight: '600' }}>
                    {selectedNode.isActive ? '● Active' : '● Inactive'}
                  </span>
                </div>
                <h4 style={{ margin: '0.4rem 0 0.15rem', color: '#111827', fontSize: '1.05rem', fontWeight: '700' }}>
                  {selectedNode.accountName}
                </h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#6B7280', fontFamily: 'monospace' }}>
                  {selectedNode.accountCode}
                </p>
              </div>

              {canManageAccounts && (
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button onClick={() => openAdd('general', selectedNode)} style={btnStyle('#059669')}>+ Sub-Account</button>
                  <button onClick={() => openEdit(selectedNode)} style={btnStyle('#0F766E')}>✏️ Edit</button>
                  <button onClick={() => openMove(selectedNode)} style={btnStyle('#6366F1')}>↕️ Move</button>
                  <button onClick={() => handleDelete(selectedNode)} style={btnStyle('#DC2626')}>🗑️ Delete</button>
                </div>
              )}
            </div>

            {/* info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {[
                { label: 'Currency',        value: selectedNode.currency || 'USD' },
                { label: 'Department',      value: selectedNode.department || '—' },
                { label: 'Opening Balance', value: Number(selectedNode.openingBalance || 0).toLocaleString() },
                { label: 'Parent Account',  value: selectedNode.parentAccountId?.accountName || 'Root Account' },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#F9FAFB', padding: '0.6rem 0.75rem', borderRadius: '0.375rem' }}>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: '#6B7280' }}>{label}</p>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.875rem', color: '#111827', fontWeight: '600' }}>{value}</p>
                </div>
              ))}
            </div>

            {selectedNode.description && (
              <div style={{ background: '#F9FAFB', padding: '0.6rem 0.75rem', borderRadius: '0.375rem', marginBottom: '1rem' }}>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#6B7280', marginBottom: '0.2rem' }}>{t('description')}</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#374151' }}>{selectedNode.description}</p>
              </div>
            )}

            {/* sub-accounts */}
            {selectedNode.children?.length > 0 && (
              <div>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: '700', color: '#374151' }}>
                  Sub-Accounts ({selectedNode.children.length})
                </p>
                <div style={{ border: '1px solid #F3F4F6', borderRadius: '0.375rem', overflow: 'hidden' }}>
                  {selectedNode.children.map((child, i) => (
                    <div
                      key={child._id}
                      onClick={() => handleSelect(child)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.5rem 0.75rem',
                        borderBottom: i < selectedNode.children.length - 1 ? '1px solid #F9FAFB' : 'none',
                        cursor: 'pointer', background: '#FFFFFF',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F9FAFB'}
                      onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}
                    >
                      <span style={{ fontSize: '0.8rem', color: '#374151' }}>
                        <span style={{ color: '#9CA3AF', marginRight: '0.5rem', fontFamily: 'monospace' }}>{child.accountCode}</span>
                        {child.accountName}
                        {child.children?.length > 0 && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', color: '#9CA3AF' }}>
                            +{child.children.length}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: TYPE_CONFIG[child.accountType]?.color || '#6B7280', fontWeight: '600' }}>
                        {child.accountType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ background: '#FFFFFF', border: '1px dashed #D1D5DB', borderRadius: '0.5rem', padding: '3rem', textAlign: 'center', color: '#9CA3AF' }}>
            <p style={{ fontSize: '2.5rem', margin: '0 0 0.75rem' }}>📂</p>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#6B7280' }}>{t('selectAccountFromTree')}</p>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem' }}>{t('rightClickAccountForOptions')}</p>
          </div>
        )}

        {/* ── summary type cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(130px,1fr))', gap: '0.6rem' }}>
          {ACCOUNT_TYPES.map(type => (
            <div
              key={type}
              onClick={() => { setExpandedTypes(prev => new Set([...prev, type])) }}
              style={{
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                borderLeft: `4px solid ${TYPE_CONFIG[type].color}`,
                borderRadius: '0.375rem', padding: '0.6rem 0.75rem', cursor: 'pointer',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.65rem', color: '#6B7280' }}>{TYPE_CONFIG[type].label}</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '1.3rem', fontWeight: '700', color: TYPE_CONFIG[type].color }}>{typeCount[type]}</p>
              <p style={{ margin: 0, fontSize: '0.6rem', color: '#D1D5DB' }}>{t('accounts').toLowerCase()}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── CONTEXT MENU ────────────────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: 'fixed', left: ctxMenu.x, top: ctxMenu.y,
            background: '#FFFFFF', border: '1px solid #E5E7EB',
            borderRadius: '0.375rem', boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            zIndex: 9999, minWidth: '190px', padding: '0.3rem 0',
          }}
        >
          {[
            { icon: '📁', label: 'Add Group',            cb: () => openAdd('group', ctxMenu.node) },
            { icon: '👤', label: 'Add Customer Account', cb: () => openAdd('customer', ctxMenu.node) },
            { icon: '🏭', label: 'Add Supplier Account', cb: () => openAdd('supplier', ctxMenu.node) },
            { icon: '🏦', label: 'Add Bank Account',     cb: () => openAdd('bank', ctxMenu.node) },
            { icon: '📄', label: 'Add General Account',  cb: () => openAdd('general', ctxMenu.node) },
            null,
            ...(onOpenSummary ? [{ icon: '📊', label: 'Open Summary', cb: () => { setCtxMenu(null); onOpenSummary(ctxMenu.node) } }] : []),
            { icon: '✏️', label: 'Edit',                cb: () => openEdit(ctxMenu.node) },
            { icon: '🗑️', label: 'Delete', danger: true, cb: () => handleDelete(ctxMenu.node) },
            null,
            { icon: '🔍', label: 'Find',                 cb: () => { setCtxMenu(null); searchRef.current?.focus() } },
            { icon: '⟳',  label: 'Refresh',              cb: () => { setCtxMenu(null); load() } },
            { icon: '↕️', label: 'Move',                 cb: () => openMove(ctxMenu.node) },
          ].map((item, i) =>
            item === null
              ? <div key={i} style={{ height: '1px', background: '#F3F4F6', margin: '0.2rem 0' }} />
              : (
                <button
                  key={i}
                  onClick={item.cb}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    width: '100%', padding: '0.4rem 0.75rem',
                    textAlign: 'left', background: 'none', border: 'none',
                    cursor: 'pointer', fontSize: '0.8rem',
                    color: item.danger ? '#DC2626' : '#111827',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#FEF2F2' : '#F9FAFB'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
          )}
        </div>
      )}

      {/* ── MODAL ────────────────────────────────────────────────────────────── */}
      {modal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '0.75rem',
              width: '500px',
              maxWidth: '95vw',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)`,
            }}
          >

            {/* modal header */}
            <div
              onMouseDown={beginModalDrag}
              style={{
                padding: '1.1rem 1.5rem',
                borderBottom: '1px solid #F3F4F6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: modalDrag.active ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
              title="Drag to move"
            >
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#111827' }}>
                {modal.mode === 'edit' ? `Edit: ${modal.node.accountName}`
                  : modal.mode === 'move' ? `Move: ${modal.node.accountName}`
                  : ACTION_PRESETS[modal.action]?.label || 'Add Account'}
              </h3>
              <button
                onClick={() => setModal(null)}
                onMouseDown={(e) => e.stopPropagation()}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#9CA3AF', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem' }}>
              {error && (
                <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.8rem' }}>
                  {error}
                </div>
              )}

              {/* ── MOVE mode ── */}
              {modal.mode === 'move' && (
                <Field label="Move to Parent Account">
                  <select value={moveTarget} onChange={e => setMoveTarget(e.target.value)} style={inputStyle}>
                    <option value="">— Root (No Parent) —</option>
                    {accounts
                      .filter(a => a._id !== modal.node._id)
                      .map(a => <option key={a._id} value={a._id}>{a.accountCode} — {a.accountName}</option>)}
                  </select>
                </Field>
              )}

              {/* ── ADD / EDIT mode ── */}
              {modal.mode !== 'move' && (
                <>
                  {modal.mode === 'add' && (
                    <Field label="Create As">
                      <select
                        value={form.createAs}
                        onChange={(e) => {
                          const nextMode = e.target.value
                          if (nextMode === 'customer') {
                            loadCustomers()
                          }
                          setForm((prev) => ({
                            ...prev,
                            createAs: nextMode,
                            linkedCustomerId: nextMode === 'customer' ? prev.linkedCustomerId : '',
                          }))
                        }}
                        style={inputStyle}
                      >
                        <option value="standard">Standard Account</option>
                        <option value="customer">Customer Account</option>
                      </select>
                    </Field>
                  )}

                  {modal.mode === 'add' && (modal.action === 'customer' || form.createAs === 'customer') && (
                    <Field label="Customer *">
                      <select
                        value={form.linkedCustomerId}
                        onChange={(e) => {
                          const customerId = e.target.value
                          const selected = customers.find((item) => item._id === customerId)
                          if (!selected) {
                            setForm({ ...form, linkedCustomerId: '' })
                            return
                          }

                          const generatedCode = `CUST-${selected._id.slice(-6).toUpperCase()}`
                          setForm({
                            ...form,
                            createAs: 'customer',
                            linkedCustomerId: customerId,
                            accountName: `${selected.name || 'Customer'} (Debtor)`,
                            accountCode: generatedCode,
                            accountType: 'Asset',
                            parentAccountId: receivableParentAccountId || form.parentAccountId,
                            currency: selected.currency || form.currency || 'USD',
                            description: form.description || `Auto-created customer ledger account for ${selected.name || 'customer'}`,
                          })
                        }}
                        style={inputStyle}
                        required
                        disabled={loadingCustomers}
                      >
                        <option value="">{loadingCustomers ? 'Loading customers...' : 'Select customer'}</option>
                        {customerOptions.map((item) => (
                          <option key={item._id} value={item._id}>
                            {item.name}{item.ledgerAccountId ? ' (already linked)' : ''}
                          </option>
                        ))}
                      </select>
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: '#6B7280' }}>
                        {unlinkedCustomers.length > 0
                          ? 'Selecting a customer will auto-fill account fields and link this account to that customer.'
                          : 'All listed customers are already linked. Selecting one will create a new customer account and replace its ledger link.'}
                      </p>
                    </Field>
                  )}

                  <Field label="Account Name *">
                    <input required value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} style={inputStyle} />
                  </Field>

                  {modal.mode === 'add' && (
                    <Field label="Account Code *">
                      <input required value={form.accountCode} onChange={e => setForm({ ...form, accountCode: e.target.value })} style={inputStyle} placeholder={t('exampleAccountCode')} />
                    </Field>
                  )}

                  {modal.mode === 'add' && (
                    <Field label="Account Type *">
                      <select required value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })} style={inputStyle}>
                        <option value="">{t('selectType')}</option>
                        {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </Field>
                  )}

                  {modal.mode === 'add' && (
                    <Field label="Parent Account">
                      <select value={form.parentAccountId} onChange={e => setForm({ ...form, parentAccountId: e.target.value })} style={inputStyle}>
                        <option value="">— Root (No Parent) —</option>
                        {accounts.map(a => <option key={a._id} value={a._id}>{a.accountCode} — {a.accountName}</option>)}
                      </select>
                    </Field>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <Field label="Currency">
                      <input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value.toUpperCase() })} style={inputStyle} />
                    </Field>
                    <Field label="Department">
                      <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} style={inputStyle} />
                    </Field>
                  </div>

                  {modal.mode === 'add' && (
                    <Field label="Opening Balance">
                      <input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} style={inputStyle} placeholder="0.00" />
                    </Field>
                  )}

                  <Field label="Description">
                    <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
                  </Field>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setModal(null)} style={{ padding: '0.5rem 1rem', background: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.25rem', background: '#059669', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.875rem', opacity: saving ? 0.7 : 1 }}>
                  {saving ? t('saving') : modal.mode === 'edit' ? t('update') : modal.mode === 'move' ? t('move') : t('create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── tiny helpers ──────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', fontSize: '0.78rem', color: '#374151', fontWeight: '600', marginBottom: '0.3rem' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%',
  padding: '0.45rem 0.6rem',
  border: '1px solid #D1D5DB',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
  color: '#111827',
  background: '#FFFFFF',
  boxSizing: 'border-box',
  outline: 'none',
}

function btnStyle(bg) {
  return {
    padding: '0.35rem 0.7rem',
    background: bg,
    color: '#fff',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.78rem',
    fontWeight: '600',
  }
}
