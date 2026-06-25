import { useCallback, useEffect, useMemo, useState } from 'react'
import { calculateAccountSummaryMetrics } from './statementHelpers'
import {
  computeMarginMetricsRaw,
  shouldSuppressSpotMetalMtmForCustomerDashboard,
} from './metalMarginPolicy'

function positionMarginContextMenu(event) {
  const menuWidth = 292
  const menuHeight = 242
  const viewportPad = 8
  let x = event.clientX + 6
  let y = event.clientY + 6
  if (x + menuWidth > window.innerWidth - viewportPad) {
    x = Math.max(viewportPad, window.innerWidth - menuWidth - viewportPad)
  }
  if (y + menuHeight > window.innerHeight - viewportPad) {
    y = Math.max(viewportPad, window.innerHeight - menuHeight - viewportPad)
  }
  return { x, y }
}

function sortMarginRows(rows, sortKey, nameKey) {
  if (sortKey === 'margin-asc') {
    rows.sort((a, b) => {
      const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
      const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
      return av - bv
    })
  } else if (sortKey === 'name-asc') {
    rows.sort((a, b) => String(a[nameKey] || '').localeCompare(String(b[nameKey] || '')))
  } else {
    rows.sort((a, b) => {
      const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
      const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
      return bv - av
    })
  }
  return rows
}

export function useErpCustomerMargin({
  activeTab,
  customers,
  goldPriceUSD,
  silverPriceUSD,
  liveRecalcEnabled = false,
}) {
  const [customerMarginSearch, setCustomerMarginSearch] = useState('')
  const [customerMarginCompactView, setCustomerMarginCompactView] = useState(true)
  const [customerMarginSort, setCustomerMarginSort] = useState('margin-desc')
  const [customerMarginContextMenu, setCustomerMarginContextMenu] = useState({ open: false, x: 0, y: 0, row: null })

  const customerMarginRows = useMemo(() => {
    if (activeTab !== 'customer-margin') return []
    const query = String(customerMarginSearch || '').trim().toLowerCase()
    const rows = (customers || [])
      .map((customer) => {
        const outstanding = Number(customer?.outstandingBalance || 0)
        const goldPosition = Number(customer?.goldPosition || 0)
        const silverPosition = Number(customer?.silverPosition || 0)
        const accountType = customer?.ledgerAccountId?.accountType
        const suppressMetalSpotMtm = shouldSuppressSpotMetalMtmForCustomerDashboard(accountType)

        if (liveRecalcEnabled) {
          const goldPrice = Number(goldPriceUSD || 0)
          const silverPrice = Number(silverPriceUSD || 0)
          const metrics = computeMarginMetricsRaw({
            totalFunds: outstanding,
            goldPosition,
            silverPosition,
            goldPrice,
            silverPrice,
            suppressMetalSpotMtm,
            fundsMode: 'customerAbsIfNegative',
          })
          const excess = metrics.excess < 0 ? Math.abs(metrics.excess) : metrics.excess
          const equity = metrics.equity < 0 ? Math.abs(metrics.equity) : metrics.equity
          return {
            id: customer?._id,
            customerName: String(customer?.name || '-'),
            balanceAbs: Math.abs(excess),
            equity,
            rawOutstanding: outstanding,
            goldPosition,
            silverPosition,
            marginAmount: metrics.margin,
            excess,
            status: metrics.status,
            marginPercent: metrics.marginPercent,
            accountCode: String(customer?.ledgerAccountId?.accountCode || ''),
            description: String(customer?.ledgerAccountId?.accountName || `${String(customer?.name || '').trim()} customer`),
          }
        }

        const goldPrice = Number(customer?.metalRates?.goldPrice || goldPriceUSD || 0)
        const silverPrice = Number(customer?.metalRates?.silverPrice || silverPriceUSD || 0)
        const customerFunds = outstanding < 0 ? Math.abs(outstanding) : outstanding
        const isLiabilityCustomerLedger = suppressMetalSpotMtm
        const fallbackRevaluation = isLiabilityCustomerLedger
          ? 0
          : (goldPosition * goldPrice) + (silverPosition * silverPrice)
        const fallbackMargin = Math.abs(fallbackRevaluation) * 0.02
        const fallbackMetrics = calculateAccountSummaryMetrics({
          totalFunds: customerFunds,
          revaluation: fallbackRevaluation,
          marginAmount: fallbackMargin,
        })
        const marginAmount = Number(customer?.marginAmount ?? fallbackMargin)
        const rawExcess = Number(customer?.marginExcess ?? fallbackMetrics.excess)
        const rawEquity = Number(customer?.marginEquity ?? fallbackMetrics.netEquity)
        const excess = rawExcess < 0 ? Math.abs(rawExcess) : rawExcess
        const equity = rawEquity < 0 ? Math.abs(rawEquity) : rawEquity
        const marginPercent = Number(customer?.marginPercent ?? fallbackMetrics.marginPercent)
        const status = String(customer?.marginStatus || (equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL')).toUpperCase()
        return {
          id: customer?._id,
          customerName: String(customer?.name || '-'),
          balanceAbs: Math.abs(excess),
          equity,
          rawOutstanding: outstanding,
          goldPosition,
          silverPosition,
          marginAmount,
          excess,
          status,
          marginPercent,
          accountCode: String(customer?.ledgerAccountId?.accountCode || ''),
          description: String(customer?.ledgerAccountId?.accountName || `${String(customer?.name || '').trim()} customer`),
        }
      })
      .filter((row) => (!query ? true : row.customerName.toLowerCase().includes(query)))
    return sortMarginRows(rows, customerMarginSort, 'customerName')
  }, [activeTab, customers, customerMarginSearch, customerMarginSort, goldPriceUSD, silverPriceUSD, liveRecalcEnabled])

  const handleCustomerMarginRowContextMenu = useCallback((event, row) => {
    event.preventDefault()
    const { x, y } = positionMarginContextMenu(event)
    setCustomerMarginContextMenu({ open: true, x, y, row })
  }, [])

  return {
    customerMarginSearch,
    setCustomerMarginSearch,
    customerMarginCompactView,
    setCustomerMarginCompactView,
    customerMarginSort,
    setCustomerMarginSort,
    customerMarginContextMenu,
    setCustomerMarginContextMenu,
    customerMarginRows,
    handleCustomerMarginRowContextMenu,
  }
}

export function useErpSupplierMargin({
  activeTab,
  vendors,
  goldPriceUSD = 0,
  silverPriceUSD = 0,
  liveRecalcEnabled = false,
}) {
  const [supplierMarginSearch, setSupplierMarginSearch] = useState('')
  const [supplierMarginCompactView, setSupplierMarginCompactView] = useState(true)
  const [supplierMarginSort, setSupplierMarginSort] = useState('margin-desc')
  const [supplierMarginContextMenu, setSupplierMarginContextMenu] = useState({ open: false, x: 0, y: 0, row: null })

  const supplierMarginRows = useMemo(() => {
    if (activeTab !== 'supplier-margin') return []
    const query = String(supplierMarginSearch || '').trim().toLowerCase()
    const rows = (vendors || [])
      .map((vendor) => {
        const outstanding = -Math.abs(Number(vendor?.outstanding ?? vendor?.outstandingBalance ?? 0))
        const goldPosition = Number(vendor?.goldPosition || 0)
        const silverPosition = Number(vendor?.silverPosition || 0)

        if (liveRecalcEnabled) {
          const goldPrice = Number(goldPriceUSD || 0)
          const silverPrice = Number(silverPriceUSD || 0)
          const metrics = computeMarginMetricsRaw({
            totalFunds: outstanding,
            goldPosition,
            silverPosition,
            goldPrice,
            silverPrice,
            fundsMode: 'asIs',
          })
          const excess = metrics.excess < 0 ? Math.abs(metrics.excess) : metrics.excess
          const equity = metrics.equity < 0 ? Math.abs(metrics.equity) : metrics.equity
          return {
            id: vendor?._id,
            supplierName: String(vendor?.name || '-'),
            balanceAbs: Math.abs(excess),
            equity,
            rawOutstanding: outstanding,
            goldPosition,
            silverPosition,
            marginAmount: metrics.margin,
            excess,
            status: metrics.status,
            marginPercent: metrics.marginPercent,
            accountCode: String(vendor?.ledgerAccountId?.accountCode || ''),
            description: String(vendor?.ledgerAccountId?.accountName || `${String(vendor?.name || '').trim()} supplier`),
          }
        }

        const fallbackRevaluation = 0
        const fallbackMargin = 0
        const fallbackMetrics = calculateAccountSummaryMetrics({
          totalFunds: outstanding,
          revaluation: fallbackRevaluation,
          marginAmount: fallbackMargin,
        })
        const marginAmount = Number(vendor?.marginAmount ?? fallbackMargin)
        const excess = Number(vendor?.marginExcess ?? fallbackMetrics.excess)
        const equity = Number(vendor?.marginEquity ?? fallbackMetrics.netEquity)
        const marginPercent = Number(vendor?.marginPercent ?? fallbackMetrics.marginPercent)
        const status = String(vendor?.marginStatus || (equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL')).toUpperCase()
        return {
          id: vendor?._id,
          supplierName: String(vendor?.name || '-'),
          balanceAbs: Math.abs(excess),
          equity,
          rawOutstanding: outstanding,
          goldPosition,
          silverPosition,
          marginAmount,
          excess,
          status,
          marginPercent,
          accountCode: String(vendor?.ledgerAccountId?.accountCode || ''),
          description: String(vendor?.ledgerAccountId?.accountName || `${String(vendor?.name || '').trim()} supplier`),
        }
      })
      .filter((row) => (!query ? true : row.supplierName.toLowerCase().includes(query)))
    return sortMarginRows(rows, supplierMarginSort, 'supplierName')
  }, [activeTab, vendors, supplierMarginSearch, supplierMarginSort, goldPriceUSD, silverPriceUSD, liveRecalcEnabled])

  const handleSupplierMarginRowContextMenu = useCallback((event, row) => {
    event.preventDefault()
    const { x, y } = positionMarginContextMenu(event)
    setSupplierMarginContextMenu({ open: true, x, y, row })
  }, [])

  return {
    supplierMarginSearch,
    setSupplierMarginSearch,
    supplierMarginCompactView,
    setSupplierMarginCompactView,
    supplierMarginSort,
    setSupplierMarginSort,
    supplierMarginContextMenu,
    setSupplierMarginContextMenu,
    supplierMarginRows,
    handleSupplierMarginRowContextMenu,
  }
}

export function useErpMarginContextMenuDismissal({
  customerMarginContextMenu,
  setCustomerMarginContextMenu,
  supplierMarginContextMenu,
  setSupplierMarginContextMenu,
}) {
  useEffect(() => {
    if (!customerMarginContextMenu.open && !supplierMarginContextMenu.open) return undefined
    const closeMenu = () => {
      setCustomerMarginContextMenu((prev) => (prev.open ? { open: false, x: 0, y: 0, row: null } : prev))
      setSupplierMarginContextMenu((prev) => (prev.open ? { open: false, x: 0, y: 0, row: null } : prev))
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') closeMenu()
    }
    window.addEventListener('click', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [
    customerMarginContextMenu.open,
    supplierMarginContextMenu.open,
    setCustomerMarginContextMenu,
    setSupplierMarginContextMenu,
  ])
}
