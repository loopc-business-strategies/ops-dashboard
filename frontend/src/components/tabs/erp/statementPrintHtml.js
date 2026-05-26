import { clampBrandingDimension, createLogoRenderAsset } from './ERPBrandingUtils'
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
          <td>${escapeHtml(resolveStatementReceiptNo(entry) || '-')}</td>
          <td>${escapeHtml(formatDateForHeader(entry.date) || formatStatementDate(entry.date) || '-')}</td>
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
  const brandingProfile = {
    ...branding,
    companyName: isModernGoldStatement && (!branding.companyName || branding.companyName === DEFAULT_BRANDING.companyName)
      ? 'MODERN GOLD JEWELRY MANUFACTURING'
      : branding.companyName,
  }
  const companyAddress = String(brandingProfile.address || '').trim()
  const companyPhone = String(brandingProfile.phone || '').trim()
  const companyTrn = String(brandingProfile.trn || '').trim()
  const accountAddress = String(accountEnquiryData?.account?.address || accountEnquiryData?.account?.description || '').trim()
  const headerStartDate = statementFilters.startDate || exportEntries[0]?.date || ''
  const headerEndDate = statementFilters.endDate || exportEntries[exportEntries.length - 1]?.date || ''
  const statementLogoWidth = isModernGoldStatement && brandingProfile.logoUrl
    ? Math.max(110, clampBrandingDimension(brandingProfile.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260))
    : clampBrandingDimension(brandingProfile.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
  const statementLogoHeight = isModernGoldStatement && brandingProfile.logoUrl
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
    ? `<img src="${processedLogo}" alt="Company Logo" style="width:${logoWidth}px;height:${logoHeight}px;object-fit:contain;display:block;" />`
    : ''
  const html = `
      <html>
        <head>
          <title>Statement of Account ${escapeHtml(accountEnquiryData.account.accountCode)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            :root {
              --soa-yellow: #FFD56A;
              --soa-yellow-border: #8B7A43;
              --soa-border: #4B5563;
              --soa-ink: #111827;
            }
            body { font-family: Arial, Helvetica, sans-serif; color: var(--soa-ink); margin: 0; padding: 16px 18px; background: #FFFFFF; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .sheet { width: 100%; }
            .header { display: grid; grid-template-columns: ${Math.max(164, logoWidth + 4)}px minmax(0, 1fr) 330px; align-items: start; gap: 18px; margin-bottom: 12px; color-adjust: exact; -webkit-print-color-adjust: exact; }
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
            th, td { border: 1.4px solid var(--soa-border); padding: 7px 6px; vertical-align: middle; color-adjust: exact; -webkit-print-color-adjust: exact; }
            thead th { background: var(--soa-yellow); color: #111111; font-weight: 800; text-align: center; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .subhead th { background: var(--soa-yellow); font-size: 13px; color: #111111; color-adjust: exact; -webkit-print-color-adjust: exact; }
            td { text-align: center; }
            .narration { text-align: left; }
            .num { text-align: right; white-space: nowrap; }
            .opening td { font-weight: 800; background: #FFFFFF; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .carry-label { text-align: center; font-weight: 800; }
            .footer { margin-top: 12px; display: flex; justify-content: space-between; font-size: 15px; font-style: italic; color: #111111; }
            .print-note { margin-top: 8px; font-size: 11px; color: #B45309; text-align: right; }
            @media print { 
              body { padding: 0; color-adjust: exact; -webkit-print-color-adjust: exact; } 
              .print-note { display: none; } 
              * { color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="header">
              <div>${logoMarkup}</div>
              <div class="brand-copy">
                <div class="company">${escapeHtml(brandingProfile.companyName || DEFAULT_BRANDING.companyName)}</div>
                ${companyAddress ? `<div class="muted">${escapeHtml(companyAddress).replace(/\n/g, '<br />')}</div>` : ''}
                ${companyPhone ? `<div class="muted">Telephone: ${escapeHtml(companyPhone)}${companyTrn ? `, TRN: ${escapeHtml(companyTrn)}` : ''}</div>` : (companyTrn ? `<div class="muted">TRN: ${escapeHtml(companyTrn)}</div>` : '')}
              </div>
              <div class="statement-head">
                <div class="title">Statement Of Account</div>
                <div class="dates">Doc Date From ${escapeHtml(formatDateForHeader(headerStartDate) || '-')} To ${escapeHtml(formatDateForHeader(headerEndDate) || '-')}</div>
              </div>
            </div>
            <div class="party-box">
              <div class="party-code">${escapeHtml(accountEnquiryData.account.accountCode || '')}</div>
              <div class="party-name">${escapeHtml(accountEnquiryData.account.accountName || 'Account')}</div>
              <div class="party-address">${escapeHtml(accountAddress)}</div>
            </div>
            <table>
              <colgroup>
                <col style="width:12%;" />
                <col style="width:7%;" />
                <col style="width:20%;" />
                <col style="width:10%;" />
                <col style="width:10%;" />
                <col style="width:10%;" />
                <col style="width:10.5%;" />
                <col style="width:10.5%;" />
                <col style="width:10%;" />
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
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Balance</th>
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
                  <td class="carry-label" colspan="3">Balance C/F</td>
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
          </div>
        </body>
      </html>
    `
  return { html, accountCode: accountEnquiryData.account.accountCode }
}
