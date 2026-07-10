import { clampBrandingDimension, createLogoRenderAsset } from './ERPBrandingUtils'
import { isMasterDocumentSettingsEnabled } from '../../../config/tenantBranding'
import {
  computeStatementExportOpeningBalances,
  matchesStatementMetal,
  resolveStatementMetalBalance,
  resolveStatementSignedAmount,
  sortStatementEntriesForExport,
} from './statementHelpers'

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')

/**
 * Build printable Statement of Account HTML (account enquiry export / preview).
 * @param {object} ctx — runtime values from ERPTab (account enquiry UI state).
 */
export async function generateStatementHtml(ctx) {
  const {
    accountEnquiryData,
    filteredStatementEntries,
    resolveStatementReceiptNo,
    statementSelectedMetalCode,
    resolvePreferredStatementMetalCode,
    statementDisplayCurrency,
    rawStatementEntries,
    formatStatementDate,
    convertStatementDisplayAmount,
    tenantBranding,
    user,
    branding,
    defaultBranding: DEFAULT_BRANDING,
    statementFilters,
  } = ctx

  if (!accountEnquiryData) return null
  const exportEntries = sortStatementEntriesForExport(filteredStatementEntries, resolveStatementReceiptNo)
  const statementMetalCode = statementSelectedMetalCode || resolvePreferredStatementMetalCode(exportEntries)
  const exportDisplayCurrency = statementDisplayCurrency
  const endingPureWeight = resolveStatementMetalBalance(accountEnquiryData?.metals, statementMetalCode, rawStatementEntries)
  const matchesExportMetalEntry = (entry) => matchesStatementMetal(entry, statementMetalCode)
  const {
    openingUsdBalance,
    openingPureWeight,
    closingUsdBalance,
    closingPureWeight,
  } = computeStatementExportOpeningBalances({
    exportEntries,
    closingNetBalance: accountEnquiryData?.balances?.netBalance,
    closingPureWeight: endingPureWeight,
    matchesMetalEntry: matchesExportMetalEntry,
  })
  let runningUsdBalance = openingUsdBalance
  let runningPureWeight = openingPureWeight
  const formatDateForHeader = (value) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const day = String(date.getDate()).padStart(2, '0')
    const month = date.toLocaleString('en-US', { month: 'short' })
    const year = String(date.getFullYear()).slice(-2)
    return `${day}-${month}-${year}`
  }
  const formatNumber = (value, decimals = 2) => Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  const formatDrCr = (value, decimals = 2) => {
    const numeric = Number(value || 0)
    return `${formatNumber(Math.abs(numeric), decimals)}${numeric >= 0 ? 'Dr' : 'Cr'}`
  }
  const formatBlankable = (value, decimals = 2) => {
    const numeric = Number(value || 0)
    if (!numeric) return ''
    return formatNumber(numeric, decimals)
  }
  const buildNarration = (entry) => {
    const primary = String(entry?.description || '').trim()
    if (primary) return primary
    const reference = String(entry?.referenceType || '').trim().toUpperCase()
    const offset = entry?.offsetAccountCode
      ? `${String(entry.offsetAccountCode).trim()}${entry?.offsetAccountName ? ` ${String(entry.offsetAccountName).trim()}` : ''}`
      : ''
    return [reference, offset].filter(Boolean).join(' - ') || 'Statement entry'
  }
  const bodyRows = exportEntries.map((entry) => {
    const debitUsd = Number(entry?.debitAmount || 0)
    const creditUsd = Number(entry?.creditAmount || 0)
    const signedPureWeight = Number(entry?.metalSignedWeight || 0)
    const isSelectedMetalEntry = matchesStatementMetal(entry, statementMetalCode)
    const debitPure = isSelectedMetalEntry && signedPureWeight > 0 ? signedPureWeight : 0
    const creditPure = isSelectedMetalEntry && signedPureWeight < 0 ? Math.abs(signedPureWeight) : 0
    runningUsdBalance += resolveStatementSignedAmount(entry)
    if (isSelectedMetalEntry) runningPureWeight += signedPureWeight
    return `
        <tr>
          <td class="col-doc">${escapeHtml(resolveStatementReceiptNo(entry) || '-')}</td>
          <td class="col-date">${escapeHtml(formatDateForHeader(entry.date) || formatStatementDate(entry.date) || '-')}</td>
          <td class="narration">${escapeHtml(buildNarration(entry))}</td>
          <td class="num">${escapeHtml(formatBlankable(convertStatementDisplayAmount(debitUsd), 2))}</td>
          <td class="num">${escapeHtml(formatBlankable(convertStatementDisplayAmount(creditUsd), 2))}</td>
          <td class="num">${escapeHtml(formatDrCr(convertStatementDisplayAmount(runningUsdBalance), 2))}</td>
          <td class="num">${escapeHtml(formatBlankable(debitPure, 3))}</td>
          <td class="num">${escapeHtml(formatBlankable(creditPure, 3))}</td>
          <td class="num">${escapeHtml(formatDrCr(runningPureWeight, 3))}</td>
        </tr>
      `
  }).join('')
  const totalDebitUsd = exportEntries.reduce((sum, entry) => sum + Number(entry?.debitAmount || 0), 0)
  const totalCreditUsd = exportEntries.reduce((sum, entry) => sum + Number(entry?.creditAmount || 0), 0)
  const totalDebitPure = exportEntries.reduce((sum, entry) => {
    const signedPureWeight = Number(entry?.metalSignedWeight || 0)
    return sum + (matchesExportMetalEntry(entry) && signedPureWeight > 0 ? signedPureWeight : 0)
  }, 0)
  const totalCreditPure = exportEntries.reduce((sum, entry) => {
    const signedPureWeight = Number(entry?.metalSignedWeight || 0)
    return sum + (matchesExportMetalEntry(entry) && signedPureWeight < 0 ? Math.abs(signedPureWeight) : 0)
  }, 0)
  const tenantIdentity = [
    tenantBranding?.key,
    tenantBranding?.displayName,
    user?.tenant?.key,
    user?.tenant?.name,
    user?.company,
    branding?.companyName,
  ].map((value) => String(value || '').trim().toLowerCase()).join(' ')
  const isModernGoldStatement = /\bmg\b/.test(tenantIdentity) || tenantIdentity.includes('modern gold')
  const tenantKey = String(tenantBranding?.key || user?.company || user?.tenant?.key || '').trim().toLowerCase()
  const useMasterStatementLayout = isMasterDocumentSettingsEnabled(tenantKey)
  const statementPrint = branding?.statementPrint || {}
  const statementTitle = String(statementPrint.title || 'Statement of Account').trim() || 'Statement of Account'
  const statementSubtitle = String(statementPrint.subtitle || '').trim()
  const statementFooterNote = String(statementPrint.footerNote || '').trim()
  const visibleStatementSignatories = (Array.isArray(statementPrint.signatories) ? statementPrint.signatories : [])
    .filter((item) => item?.visible !== false)
  const showPrintNote = statementPrint.showPrintNote !== false
  const logoOffsetX = Number(statementPrint.logoOffsetX || 0)
  const logoOffsetY = Number(statementPrint.logoOffsetY || 0)
  const logoTransparent = statementPrint.logoTransparent !== false
  const brandingProfile = {
    ...branding,
    companyName: !useMasterStatementLayout && isModernGoldStatement && (!branding.companyName || branding.companyName === DEFAULT_BRANDING.companyName)
      ? 'MODERN GOLD JEWELRY MANUFACTURING'
      : branding.companyName,
  }
  const companyAddress = String(brandingProfile.address || '').trim()
  const companyPhone = String(brandingProfile.phone || '').trim()
  const companyTrn = String(brandingProfile.trn || '').trim()
  const accountAddress = String(accountEnquiryData?.account?.address || accountEnquiryData?.account?.description || '').trim()
  const headerStartDate = statementFilters.startDate || exportEntries[0]?.date || ''
  const headerEndDate = statementFilters.endDate || exportEntries[exportEntries.length - 1]?.date || ''
  const statementLogoWidth = !useMasterStatementLayout && isModernGoldStatement && brandingProfile.logoUrl
    ? Math.max(110, clampBrandingDimension(brandingProfile.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260))
    : clampBrandingDimension(brandingProfile.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
  const statementLogoHeight = !useMasterStatementLayout && isModernGoldStatement && brandingProfile.logoUrl
    ? Math.max(90, clampBrandingDimension(brandingProfile.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120))
    : clampBrandingDimension(brandingProfile.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)
  const processedLogo = await createLogoRenderAsset(
    brandingProfile.logoUrl,
    statementLogoWidth,
    statementLogoHeight,
    brandingProfile.logoFit,
  )
  const logoWidth = statementLogoWidth
  const logoHeight = statementLogoHeight
  const logoMarkup = processedLogo
    ? `<img src="${processedLogo}" alt="Company Logo" style="width:${logoWidth}px;height:${logoHeight}px;object-fit:contain;display:block;background:${logoTransparent ? 'transparent' : '#FFFFFF'};position:relative;top:${logoOffsetY}px;right:${-logoOffsetX}px;" />`
    : ''
  const companyBlock = `
              <div class="brand-copy${useMasterStatementLayout ? ' brand-copy-loopc' : ''}">
                <div class="company">${escapeHtml(brandingProfile.companyName || DEFAULT_BRANDING.companyName)}</div>
                ${companyAddress ? `<div class="muted">${escapeHtml(companyAddress).replace(/\n/g, '<br />')}</div>` : ''}
                ${companyPhone ? `<div class="muted">Telephone: ${escapeHtml(companyPhone)}${companyTrn ? `, TRN: ${escapeHtml(companyTrn)}` : ''}</div>` : (companyTrn ? `<div class="muted">TRN: ${escapeHtml(companyTrn)}</div>` : '')}
              </div>`
  const statementHeadBlock = `
              <div class="statement-head${useMasterStatementLayout ? ' statement-head-loopc' : ''}">
                <div class="title">${escapeHtml(statementTitle)}</div>
                ${statementSubtitle ? `<div class="subtitle">${escapeHtml(statementSubtitle)}</div>` : ''}
                <div class="dates">Doc Date From ${escapeHtml(formatDateForHeader(headerStartDate) || '-')} To ${escapeHtml(formatDateForHeader(headerEndDate) || '-')}</div>
              </div>`
  const headerMarkup = useMasterStatementLayout
    ? `
            <div class="header header-loopc">
              ${companyBlock}
              <div class="logo-wrap">${logoMarkup}</div>
            </div>
            ${statementHeadBlock}`
    : `
            <div class="header">
              <div>${logoMarkup}</div>
              ${companyBlock}
              ${statementHeadBlock}
            </div>`
  const signatoryMarkup = visibleStatementSignatories.length
    ? `
            <div class="signatories">
              ${visibleStatementSignatories.map((item) => `
                <div class="signatory">
                  ${item.name ? `<div class="signatory-name">${escapeHtml(item.name)}</div>` : '<div class="signatory-name">&nbsp;</div>'}
                  <div class="signatory-line">${escapeHtml(item.title || '')}</div>
                </div>
              `).join('')}
            </div>`
    : ''
  const html = `
      <html>
        <head>
          <title>Statement of Account ${escapeHtml(accountEnquiryData.account.accountCode)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            :root {
              --soa-header-bg: #E8ECF1;
              --soa-border: #374151;
              --soa-ink: #111827;
            }
            body { font-family: Arial, Helvetica, sans-serif; color: var(--soa-ink); margin: 0; padding: 16px 18px; background: #FFFFFF; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .sheet { width: 100%; }
            .header { display: grid; grid-template-columns: ${Math.max(164, logoWidth + 4)}px minmax(0, 1fr) 330px; align-items: start; gap: 18px; margin-bottom: 12px; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .header-loopc { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 8px; }
            .header-loopc .logo-wrap { min-width: ${Math.max(120, logoWidth)}px; display: flex; justify-content: flex-end; }
            .brand-copy-loopc { padding-top: 0; font-size: 10px; line-height: 1.5; max-width: 420px; word-break: normal; }
            .brand-copy-loopc .company { font-size: 15px; font-weight: 700; margin-bottom: 4px; line-height: 1.3; }
            .brand-copy-loopc .muted { font-size: 10px; line-height: 1.5; }
            .statement-head-loopc { text-align: center; padding-top: 8px; margin-bottom: 12px; }
            .statement-head-loopc .subtitle { font-size: 14px; color: #4B5563; margin-bottom: 4px; }
            .signatories { margin-top: 18px; display: grid; grid-template-columns: repeat(${Math.max(visibleStatementSignatories.length, 1)}, 1fr); gap: 24px; text-align: center; }
            .signatory-name { min-height: 24px; font-size: 12px; margin-bottom: 36px; }
            .signatory-line { border-top: 1px solid var(--soa-border); padding-top: 6px; font-weight: 700; font-size: 13px; }
            .statement-footer-note { margin-top: 10px; font-size: 12px; color: #4B5563; }
            .brand-copy { font-size: 18px; line-height: 1.34; padding-top: 24px; }
            .brand-copy .company { font-size: 29px; font-weight: 800; letter-spacing: 0; margin-bottom: 14px; color: #050505; }
            .muted { color: var(--soa-ink); }
            .statement-head { text-align: right; padding-top: 46px; color: #111111; }
            .statement-head .title { font-size: 20px; font-weight: 400; margin-bottom: 2px; color: #111111; }
            .statement-head .dates { font-size: 16px; color: #111111; }
            .party-box { border: 1.5px solid var(--soa-border); min-height: 74px; padding: 12px 22px; margin: 4px 0 0; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .party-code { font-size: 17px; margin-bottom: 10px; }
            .party-name { font-size: 16px; font-weight: 800; margin-bottom: 6px; text-transform: uppercase; }
            .party-address { font-size: 13px; line-height: 1.25; white-space: pre-line; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 0; table-layout: fixed; }
            th, td { border: 1.4px solid var(--soa-border); padding: 7px 8px; vertical-align: middle; color-adjust: exact; -webkit-print-color-adjust: exact; }
            thead th { background: var(--soa-header-bg); color: #1F2937; font-weight: 800; text-align: center; border-color: var(--soa-border); color-adjust: exact; -webkit-print-color-adjust: exact; }
            .subhead th { background: var(--soa-header-bg); font-size: 13px; color: #1F2937; border-color: var(--soa-border); color-adjust: exact; -webkit-print-color-adjust: exact; }
            .subhead th.num-head { text-align: right; padding-right: 8px; }
            .col-doc { text-align: left; }
            .col-date { text-align: center; }
            .narration { text-align: left; }
            .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-right: 8px; }
            .opening td { font-weight: 800; background: #FFFFFF; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .carry-label { text-align: left; font-weight: 800; }
            .footer { margin-top: 12px; display: flex; justify-content: space-between; font-size: 15px; font-style: italic; color: #111111; }
            .print-note { margin-top: 8px; font-size: 11px; color: #6B7280; text-align: right; }
            @media print { 
              body { padding: 0; color-adjust: exact; -webkit-print-color-adjust: exact; } 
              .print-note { display: none; } 
              * { color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${headerMarkup}
            <div class="party-box">
              <div class="party-code">${escapeHtml(accountEnquiryData.account.accountCode || '')}</div>
              <div class="party-name">${escapeHtml(accountEnquiryData.account.accountName || 'Account')}</div>
              <div class="party-address">${escapeHtml(accountAddress)}</div>
            </div>
            <table>
              <colgroup>
                <col style="width:11%;" />
                <col style="width:8%;" />
                <col style="width:22%;" />
                <col style="width:9.5%;" />
                <col style="width:9.5%;" />
                <col style="width:9.5%;" />
                <col style="width:9.5%;" />
                <col style="width:9.5%;" />
                <col style="width:9.5%;" />
              </colgroup>
              <thead>
                <tr>
                  <th rowspan="2">Doc No</th>
                  <th rowspan="2">Doc Date</th>
                  <th rowspan="2">Narration</th>
                  <th colspan="3">Amount (${escapeHtml(exportDisplayCurrency)})</th>
                  <th colspan="3">${escapeHtml(statementMetalCode)}(GMS)</th>
                </tr>
                <tr class="subhead">
                  <th class="num-head">Debit</th>
                  <th class="num-head">Credit</th>
                  <th class="num-head">Balance</th>
                  <th class="num-head">Debit</th>
                  <th class="num-head">Credit</th>
                  <th class="num-head">Balance</th>
                </tr>
              </thead>
              <tbody>
                <tr class="opening">
                  <td colspan="2"></td>
                  <td class="carry-label">Balance B/F</td>
                  <td class="num"></td>
                  <td class="num"></td>
                  <td class="num">${escapeHtml(formatDrCr(convertStatementDisplayAmount(openingUsdBalance), 2))}</td>
                  <td class="num"></td>
                  <td class="num"></td>
                  <td class="num">${escapeHtml(formatDrCr(openingPureWeight, 3))}</td>
                </tr>
                ${bodyRows}
                <tr class="opening">
                  <td colspan="2"></td>
                  <td class="carry-label">Balance C/F</td>
                  <td class="num">${escapeHtml(formatBlankable(convertStatementDisplayAmount(totalDebitUsd), 2))}</td>
                  <td class="num">${escapeHtml(formatBlankable(convertStatementDisplayAmount(totalCreditUsd), 2))}</td>
                  <td class="num">${escapeHtml(formatDrCr(convertStatementDisplayAmount(closingUsdBalance), 2))}</td>
                  <td class="num">${escapeHtml(formatBlankable(totalDebitPure, 3))}</td>
                  <td class="num">${escapeHtml(formatBlankable(totalCreditPure, 3))}</td>
                  <td class="num">${escapeHtml(formatDrCr(closingPureWeight, 3))}</td>
                </tr>
              </tbody>
            </table>
            <div class="footer">
              <span>Printed By: ${escapeHtml(user?.name || 'User')} On ${escapeHtml(new Date().toLocaleString())}</span>
              <span>Page 1 of 1</span>
            </div>
            ${signatoryMarkup}
            ${statementFooterNote ? `<div class="statement-footer-note">${escapeHtml(statementFooterNote)}</div>` : ''}
            ${showPrintNote ? '<div class="print-note">Generated from Account Summary</div>' : ''}
          </div>
        </body>
      </html>
    `
  return { html, accountCode: accountEnquiryData.account.accountCode }
}
