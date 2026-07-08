import { useMemo } from 'react'
import { resolveErpUserTenantBranding } from '../erp/resolveErpUserTenant'
import { resolveVoucherPrintSettings } from '../erp/documentBranding'
import {
  fmt,
  getAccountCodeValue,
  isMetalStockVoucherType,
  normalizeLineType,
  normalizeVoucherFixingType,
  numberToWords,
} from './voucherTabShared'

/**
 * Pure print-model builder for voucher documents (MG layouts + generic print).
 */
export function buildVoucherPrintModel({
  voucherType,
  header,
  effectiveLineItems,
  totals,
  accounts,
  user,
  reportBranding,
  voucherLabel,
  isMetalVoucher,
  isSimpleMetalVoucher,
  findPartyOptionByCode = () => null,
  resolveVoucherParty = () => ({}),
  lineItems,
}) {
  const branding = user?.branding || {}
  const tenant = user?.tenant || {}
  const activeTenantBranding = resolveErpUserTenantBranding(user)
  const voucherPrintSettings = resolveVoucherPrintSettings({ reportBranding, user, tenantBranding: activeTenantBranding })
  const documentBranding = voucherPrintSettings
  const voucher = {
    currency: header?.currCode || 'USD',
    partyName: header?.partyName || '',
    partyAccount: header?.partyCode || '',
  }
  const companyPhone = documentBranding.phone || branding?.phone || tenant?.phone || activeTenantBranding?.phone || ''
  const companyTrn = documentBranding.trn || branding?.trn || tenant?.trn || activeTenantBranding?.trn || ''
  const currencyLabel = voucher?.currency || 'USD'
  const payNoValue = header?.vocNo || ''
  const payDateValue = header?.docDate || ''
  const preparedByValue = user?.name || ''
  const trnValue = companyTrn || ''
  const phoneValue = companyPhone || ''

  const printTitleByType = {
    payment: 'Payment Voucher',
    receipt: 'Receipt Voucher',
    purchase: 'Metal Purchase Voucher',
    sale: 'Metal Sale Voucher',
    metal_receipt: 'Metal Receipt Voucher',
    metal_payment: 'Metal Payment Voucher',
  }
  const printTitle = printTitleByType[voucherType] || voucherLabel
  const printMeta = [
    { label: 'Doc No', value: payNoValue },
    { label: 'Doc Date', value: payDateValue },
    ...(isSimpleMetalVoucher ? [] : [{ label: 'Value Date', value: header?.valueDate || payDateValue }]),
    { label: 'Prepared By', value: preparedByValue },
    ...(isMetalVoucher && !isSimpleMetalVoucher ? [{ label: 'Fixing', value: normalizeVoucherFixingType(header?.fixingType) }] : []),
  ]
  const printAmountLabel = `Amount (${currencyLabel || 'USD'})`
  const printPostingDirection = (voucherType === 'receipt' || voucherType === 'sale' || voucherType === 'metal_payment') ? 'CREDITED' : 'DEBITED'
  const accountNameByCode = (code) => (accounts || []).find((a) => getAccountCodeValue(a) === String(code || '').trim())?.accountName || ''
  const tenantIdentity = [
    activeTenantBranding?.key,
    tenant?.key,
    tenant?.name,
    user?.company,
    documentBranding?.companyName,
    branding?.displayName,
  ].map((value) => String(value || '').trim().toLowerCase()).join(' ')
  const isModernGoldTenant = /\bmg\b/.test(tenantIdentity) || tenantIdentity.includes('modern gold')
  const isMgCurrencyVoucher = isModernGoldTenant && ['payment', 'receipt'].includes(voucherType)
  const isMgMetalVoucher = isModernGoldTenant && isMetalStockVoucherType(voucherType)
  const mgPrintTitle = voucherType === 'receipt' ? 'RECEIPT CURRENCY' : 'CURRENCY PAYMENT'
  const mgBranch = header?.branch || effectiveLineItems?.find((line) => line?.branch)?.branch || 'HO'
  const mgLogoImage = documentBranding.logoUrl || ''
  const mgCompanyName = 'MODERN GOLD JEWELRY MANUFACTURING'
  const mgCompanyAddress = '242, Girvonbulok Street, Davlatabad District,\nNamangan City, Namangan Region,\nRepublic of Uzbekistan.'
  const mgLineItems = Array.isArray(effectiveLineItems) ? effectiveLineItems : []
  const mgPrimaryLine = mgLineItems[0] || {}
  const mgSelectedParty = findPartyOptionByCode(voucher?.partyAccount)
  const mgResolvedParty = resolveVoucherParty(String(header?.partyCode || '').trim())
  const mgPartyPrintPhone = String(mgResolvedParty?.phone || '').trim()
  const mgPartyPrintAddress = String(mgResolvedParty?.address || '').trim()
  const mgPartyAccountCode = String(voucher?.partyAccount || mgSelectedParty?.partyCode || '').trim()
  const mgPartyAccountName = String(voucher?.partyName || mgSelectedParty?.partyName || accountNameByCode(mgPartyAccountCode) || '').trim()
  const mgAccountDescription = () => {
    const joined = `${mgPartyAccountName}${mgPartyAccountCode ? ` ${mgPartyAccountCode}` : ''}`.trim()
    return joined || mgPartyAccountCode || mgPartyAccountName || ''
  }
  const mgAmountCurrencyName = {
    AED: 'United Arab Emirates Dirham',
    USD: 'United States Dollar',
    EUR: 'Euro',
    GBP: 'Pound Sterling',
    UZS: 'Uzbekistani Som',
  }[String(currencyLabel || '').toUpperCase()] || currencyLabel || ''
  const mgAmountWords = totals.grandTotal > 0
    ? `${numberToWords(totals.grandTotal)} ${mgAmountCurrencyName} Only`
    : ''
  const mgFixingDisplay = normalizeVoucherFixingType(header?.fixingType) === 'non-fixing' ? 'UNFIXED' : 'FIXED'
  const mgMetalInvoiceTitle = `${
    voucherType === 'purchase'
      ? 'PURCHASE INVOICE'
      : voucherType === 'metal_receipt'
        ? 'METAL RECEIPT'
        : voucherType === 'metal_payment'
          ? 'METAL PAYMENT'
          : 'SALE INVOICE'
  } (${mgFixingDisplay})`
  const mgMetalCopyLabel = (voucherType === 'purchase' || voucherType === 'metal_receipt') ? 'ACCOUNTS COPY' : 'PARTY COPY'
  const mgMetalPostingDirection = (voucherType === 'purchase' || voucherType === 'metal_receipt') ? 'DEBITED' : 'CREDITED'
  const mgMetalRateValue = mgLineItems.find((line) => Number(line?.metalRate || 0) > 0)?.metalRate || ''
  const mgMetalRateLabel = mgMetalRateValue ? `${fmt(mgMetalRateValue)} / SOZ (${currencyLabel || 'USD'})` : ''

  return {
    documentBranding,
    voucherPrintSettings,
    voucherPrint: voucherPrintSettings.voucherPrint,
    voucher,
    header,
    currencyLabel,
    payNoValue,
    payDateValue,
    preparedByValue,
    trnValue,
    phoneValue,
    printTitle,
    printMeta,
    printAmountLabel,
    printPostingDirection,
    accountNameByCode,
    isMgCurrencyVoucher,
    isMgMetalVoucher,
    mgPrintTitle,
    mgBranch,
    mgLogoImage,
    mgCompanyName,
    mgCompanyAddress,
    mgLineItems,
    mgPrimaryLine,
    mgPartyPrintPhone,
    mgPartyPrintAddress,
    mgPartyAccountCode,
    mgPartyAccountName,
    mgAccountDescription,
    mgAmountWords,
    mgFixingDisplay,
    mgMetalInvoiceTitle,
    mgMetalCopyLabel,
    mgMetalPostingDirection,
    mgMetalRateLabel,
    numberToWords,
    fmt,
    normalizeLineType,
    lineItems,
    effectiveLineItems,
    totals,
    isMetalVoucher,
    voucherType,
  }
}

/**
 * Print-layout derived values for voucher documents (MG layouts + generic print).
 */
export function useVoucherPrintModel({
  voucherType,
  header,
  effectiveLineItems,
  totals,
  accounts,
  user,
  reportBranding,
  voucherLabel,
  isMetalVoucher,
  isSimpleMetalVoucher,
  findPartyOptionByCode,
  resolveVoucherParty,
  lineItems,
}) {
  return useMemo(
    () => buildVoucherPrintModel({
      voucherType,
      header,
      effectiveLineItems,
      totals,
      accounts,
      user,
      reportBranding,
      voucherLabel,
      isMetalVoucher,
      isSimpleMetalVoucher,
      findPartyOptionByCode,
      resolveVoucherParty,
      lineItems,
    }),
    [
      voucherType,
      header,
      effectiveLineItems,
      totals,
      accounts,
      user,
      reportBranding,
      voucherLabel,
      isMetalVoucher,
      isSimpleMetalVoucher,
      findPartyOptionByCode,
      resolveVoucherParty,
      lineItems,
    ],
  )
}
