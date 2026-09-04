import { useCallback, useEffect, useState } from 'react'
import { resolveLiveVoucherMetalRate } from '../../../utils/liveMetalRates'
import { parseAmount, roundMoney } from '../../../utils/money'
import {
  decodeFullMeta,
  decodeInventoryCategoryMeta,
  isMetalStockVoucherType,
  isMetalTransferVoucherType,
  normalizeMetalSymbol,
  normalizeRateType,
  normalizeStockGroup,
  toTitle,
} from './voucherTabShared'

/**
 * Metal/product line auto-calc + inventory product lookup for VoucherTab.
 * Extracted to shrink the shell.
 */
export function useVoucherLineAutoCalc({
  token,
  canView,
  voucherType,
  voucherErpApi,
  latestMetalRates,
  showLineForm,
  setLineForm,
  lineFormGrossWeight,
  lineFormPurity,
  lineFormMetalRate,
  lineFormRateType,
  lineFormVatPer,
  lineFormPremiumValue,
  lineFormMakingCharges,
  headerCurrCode = '',
  baseCurrencyCode = 'USD',
}) {
  const [inventoryProducts, setInventoryProducts] = useState([])
  const [loadingInventoryProducts, setLoadingInventoryProducts] = useState(false)

  const resolveLineCurrency = useCallback((line) => {
    const code = String(line?.currCode || headerCurrCode || baseCurrencyCode || 'USD').trim().toUpperCase()
    return code || 'USD'
  }, [headerCurrCode, baseCurrencyCode])

  const applyLineAutoCalc = useCallback((line, options = {}) => {
    const preserveKeys = new Set(options.preserveKeys || [])
    const next = { ...line }
    const moneyCur = resolveLineCurrency(next)
    const grossWeight = parseAmount(next.grossWeight) || 0
    const purityValue = parseAmount(next.purity)
    const purityRatio = purityValue == null || purityValue <= 0
      ? 0
      : (purityValue > 1.2 ? purityValue / 1000 : purityValue)

    const pureWeight = grossWeight > 0 && purityRatio > 0
      ? Number((grossWeight * purityRatio).toFixed(3))
      : 0

    const weightInOz = pureWeight > 0
      ? Number((pureWeight / 31.1034768).toFixed(3))
      : 0

    const rateType = normalizeRateType(next.rateType)
    const metalRate = parseAmount(next.metalRate) || 0
    const rateQty = rateType === 'GRAM'
      ? pureWeight
      : rateType === 'KG'
        ? pureWeight / 1000
        : weightInOz

    const computedMetalAmount = rateQty > 0 && metalRate > 0
      ? roundMoney(rateQty * metalRate, moneyCur)
      : 0
    const existingMetalAmount = parseAmount(next.metalAmount) || 0
    const effectiveMetalAmount = computedMetalAmount > 0 ? computedMetalAmount : existingMetalAmount

    const premiumRate = parseAmount(next.premiumValue) || 0
    const computedPremiumAmount = rateQty > 0 && premiumRate !== 0
      ? roundMoney(rateQty * premiumRate, moneyCur)
      : 0
    const makingChargesAmt = parseAmount(next.makingCharges) || 0

    const baseTotal = roundMoney(effectiveMetalAmount + computedPremiumAmount + makingChargesAmt, moneyCur)
    const vatPer = parseAmount(next.vatPer) || 0
    const vatAmount = roundMoney((baseTotal * vatPer) / 100, moneyCur)
    const amountWithVAT = roundMoney(baseTotal + vatAmount, moneyCur)
    const derivedMetalRate = rateQty > 0 && effectiveMetalAmount > 0
      ? roundMoney(effectiveMetalAmount / rateQty, moneyCur)
      : 0
    const effectiveMetalRate = metalRate > 0 ? metalRate : derivedMetalRate

    const out = {
      ...next,
      pureWeight: pureWeight > 0 ? pureWeight.toFixed(3) : '',
      weightInOz: weightInOz > 0 ? weightInOz.toFixed(3) : '',
      metalRate: effectiveMetalRate > 0 ? String(roundMoney(effectiveMetalRate, moneyCur)) : (next.metalRate || ''),
      metalAmount: effectiveMetalAmount > 0 ? String(roundMoney(effectiveMetalAmount, moneyCur)) : '',
      premiumAmount: computedPremiumAmount !== 0 ? String(roundMoney(computedPremiumAmount, moneyCur)) : '',
      totalAmount: baseTotal > 0 ? String(roundMoney(baseTotal, moneyCur)) : '',
      amountLC: baseTotal > 0 ? String(roundMoney(baseTotal, moneyCur)) : '',
      vatAmountLC: vatPer > 0 ? String(roundMoney(vatAmount, moneyCur)) : '',
      vatAmountFC: vatPer > 0 ? String(roundMoney(vatAmount, moneyCur)) : '',
      amountWithVAT: baseTotal > 0 ? String(roundMoney(amountWithVAT, moneyCur)) : '',
    }

    // Keep the field the user is actively editing as raw typed text (no toFixed rewrite).
    for (const key of preserveKeys) {
      if (Object.prototype.hasOwnProperty.call(next, key)) out[key] = next[key]
    }
    return out
  }, [resolveLineCurrency])

  const applyProductTypeAutoFill = useCallback((line, productNameOverride) => {
    const productName = String(productNameOverride ?? (line.productType || '')).trim()
    if (!productName) return line

    const product = inventoryProducts.find(
      (item) => item.name === productName && String(item.category || '').includes('recordType=product')
    )
    if (!product) {
      return { ...line, productType: productName, inventoryItemId: '' }
    }

    const meta = decodeFullMeta(product.category)
    const simMeta = decodeInventoryCategoryMeta(product.category)
    const unitWeight = parseFloat(meta.weight || product.weight || '') || 0
    const pcs = Math.max(0, parseFloat(line.pcs) || 0)
    const grossWeight = unitWeight > 0
      ? (pcs > 0 ? unitWeight * pcs : unitWeight)
      : (parseFloat(line.grossWeight) || 0)
    const rawPurity = parseFloat(meta.productPurity || simMeta.purity || '') || 0
    const productVatPer = parseFloat(meta.vatPercent || '') || 0
    const productTaxType = String(meta.taxType || 'VAT').trim()

    return applyLineAutoCalc({
      ...line,
      inventoryItemId: String(product._id),
      productType: productName,
      grossWeight: grossWeight > 0 ? String(Number(grossWeight.toFixed(3))) : line.grossWeight,
      purity: rawPurity > 0 ? String(rawPurity) : line.purity,
      vatType: isMetalTransferVoucherType(voucherType) ? 'None' : (productTaxType || line.vatType || 'VAT'),
      vatPer: isMetalTransferVoucherType(voucherType) ? '0' : (productVatPer > 0 ? String(productVatPer) : line.vatPer),
    })
  }, [applyLineAutoCalc, inventoryProducts, voucherType])

  const handleStockSelection = useCallback((selectedStockCode) => {
    const normalizedStockCode = String(selectedStockCode || '').trim()
    if (!normalizedStockCode) {
      setLineForm((prev) => ({ ...prev, stockCode: '', inventoryItemId: '' }))
      return
    }

    const product = inventoryProducts.find((item) => String(item.sku || '').trim().toLowerCase() === normalizedStockCode.toLowerCase())

    if (!product) {
      setLineForm((prev) => ({ ...prev, stockCode: normalizedStockCode, inventoryItemId: '' }))
      return
    }

    const fullMeta = decodeFullMeta(product.category)
    const meta = decodeInventoryCategoryMeta(product.category)
    const mainStock = meta.mainStock || meta.metalType || ''
    const symbol = normalizeMetalSymbol(mainStock, meta.metalType)
    const stockGroup = normalizeStockGroup(mainStock, meta.metalType)
    const storedPriceUnit = String(fullMeta.priceUnit || '').trim().toUpperCase()
    const resolvedRateType = normalizeRateType(storedPriceUnit || 'OZ')
    const storedCurrency = String(fullMeta.priceCurrency || product.currency || 'USD').toUpperCase()
    const productVatPer = parseFloat(fullMeta.vatPercent || '') || 0
    const productTaxType = String(fullMeta.taxType || 'VAT').trim()
    const liveRate = resolveLiveVoucherMetalRate(symbol, mainStock, latestMetalRates, resolvedRateType)
    const storedRate = (voucherType === 'sale' || voucherType === 'metal_payment')
      ? Number(product.sellingPrice || 0)
      : Number(product.unitCost || 0)
    const defaultRate = liveRate > 0 ? liveRate : storedRate

    setLineForm((prev) => applyLineAutoCalc({
      ...prev,
      inventoryItemId: String(product._id),
      stockCode: String(product.sku || normalizedStockCode),
      stockGroup,
      metalSymbol: symbol,
      metalName: toTitle(mainStock || meta.metalType || product.name || 'Metal'),
      location: String(product.wipStage || prev.location || ''),
      availStock: `${Number(product.quantity || 0).toLocaleString()} ${String(product.unit || '').trim()}`.trim(),
      purity: String(meta.purity || prev.purity || ''),
      metalRate: defaultRate > 0 ? String(roundMoney(defaultRate, storedCurrency || resolveLineCurrency(prev))) : prev.metalRate,
      rateType: resolvedRateType,
      currCode: storedCurrency,
      vatType: isMetalTransferVoucherType(voucherType) ? 'None' : (productTaxType || prev.vatType || 'VAT'),
      vatPer: isMetalTransferVoucherType(voucherType) ? '0' : (productVatPer > 0 ? String(productVatPer) : prev.vatPer),
    }))
  }, [applyLineAutoCalc, inventoryProducts, latestMetalRates, resolveLineCurrency, setLineForm, voucherType])

  useEffect(() => {
    if (!canView) return
    let mounted = true

    const loadInventoryProducts = async () => {
      setLoadingInventoryProducts(true)
      try {
        const res = await voucherErpApi.getInventoryProducts(token)
        if (!mounted) return
        setInventoryProducts(res.products || [])
      } catch {
        if (mounted) setInventoryProducts([])
      } finally {
        if (mounted) setLoadingInventoryProducts(false)
      }
    }

    loadInventoryProducts()
    return () => { mounted = false }
  }, [canView, token, voucherErpApi])

  useEffect(() => {
    if (!showLineForm || !isMetalStockVoucherType(voucherType)) return
    setLineForm((prev) => {
      // Preserve metalRate while typing so toFixed does not jump the cursor.
      const calculated = applyLineAutoCalc(prev, { preserveKeys: ['metalRate', 'grossWeight', 'purity', 'premiumValue', 'makingCharges', 'vatPer'] })
      const keys = ['pureWeight', 'weightInOz', 'metalAmount', 'totalAmount', 'amountLC', 'vatAmountLC', 'vatAmountFC', 'amountWithVAT']
      const hasChanges = keys.some((key) => String(prev[key] || '') !== String(calculated[key] || ''))
      return hasChanges ? calculated : prev
    })
  }, [
    showLineForm,
    voucherType,
    lineFormGrossWeight,
    lineFormPurity,
    lineFormMetalRate,
    lineFormRateType,
    lineFormVatPer,
    lineFormPremiumValue,
    lineFormMakingCharges,
    applyLineAutoCalc,
    setLineForm,
  ])

  return {
    inventoryProducts,
    loadingInventoryProducts,
    applyLineAutoCalc,
    applyProductTypeAutoFill,
    handleStockSelection,
  }
}
