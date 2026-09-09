/**
 * Resolve vatType / vatPer when applying inventory product metadata to a voucher line.
 * Product vatPercent 0 must clear a prior line rate (do not keep line.vatPer).
 */
export function resolveProductLineVatFields({
  voucherType,
  isMetalTransferVoucherType,
  productTaxType = '',
  productVatPercent,
  lineVatType = '',
  lineVatPer = '',
} = {}) {
  if (typeof isMetalTransferVoucherType === 'function' && isMetalTransferVoucherType(voucherType)) {
    return { vatType: 'None', vatPer: '0' }
  }

  const vatType = String(productTaxType || lineVatType || 'VAT').trim() || 'VAT'
  if (vatType.toLowerCase() === 'none') {
    return { vatType: 'None', vatPer: '0' }
  }

  const raw = productVatPercent
  const hasDefinedVatPercent = raw !== undefined && raw !== null && String(raw).trim() !== ''
  if (hasDefinedVatPercent) {
    const parsed = Number.parseFloat(String(raw).trim())
    const rate = Number.isFinite(parsed) ? parsed : 0
    return { vatType, vatPer: String(rate) }
  }

  return { vatType, vatPer: lineVatPer }
}
