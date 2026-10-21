import { createLogoRenderAsset } from './ERPBrandingUtils'
import { sanitizeLogoUrl } from '../../../utils/safeHtml'
import { buildStatementExportModel } from './statementExportModel'

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
  const { screenPreview = false } = ctx
  const model = buildStatementExportModel(ctx)
  if (!model) return null

  const {
    accountCode,
    accountName,
    accountAddress,
    currency,
    metalCode,
    title,
    subtitle,
    footerNote,
    showPrintNote,
    companyName,
    companyAddress,
    companyPhone,
    companyTrn,
    dateFromLabel,
    dateToLabel,
    printedByName,
    logoUrl,
    logoFit,
    logoWidth,
    logoHeight,
    logoOffsetX,
    logoOffsetY,
    logoTransparent,
    companyNameFontSize,
    addressFontSize,
    useMasterStatementLayout,
    signatories,
    tableRows,
  } = model

  const logoSrc = screenPreview
    ? sanitizeLogoUrl(logoUrl)
    : await createLogoRenderAsset(
      logoUrl,
      logoWidth,
      logoHeight,
      logoFit,
      { renderScale: 2 },
    )
  const logoMarkup = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="Company Logo" style="width:${logoWidth}px;height:${logoHeight}px;object-fit:${escapeHtml(logoFit || 'contain')};display:block;background:${logoTransparent ? 'transparent' : '#FFFFFF'};position:relative;top:${logoOffsetY}px;right:${-logoOffsetX}px;" />`
    : ''
  const brandCopyClass = useMasterStatementLayout ? 'brand-copy-loopc' : 'brand-copy'
  const companyBlock = `
              <div class="${brandCopyClass}">
                ${companyName ? `<div class="company" style="font-size:${companyNameFontSize}px">${escapeHtml(companyName)}</div>` : ''}
                ${companyAddress ? `<div class="muted" style="font-size:${addressFontSize}px">${escapeHtml(companyAddress).replace(/\n/g, '<br />')}</div>` : ''}
                ${companyPhone ? `<div class="muted" style="font-size:${addressFontSize}px">Telephone: ${escapeHtml(companyPhone)}${companyTrn ? `, TRN: ${escapeHtml(companyTrn)}` : ''}</div>` : (companyTrn ? `<div class="muted" style="font-size:${addressFontSize}px">TRN: ${escapeHtml(companyTrn)}</div>` : '')}
              </div>`
  const statementHeadBlock = `
              <div class="statement-head${useMasterStatementLayout ? ' statement-head-loopc' : ''}">
                <div class="title">${escapeHtml(title)}</div>
                ${subtitle ? `<div class="subtitle">${escapeHtml(subtitle)}</div>` : ''}
                <div class="dates">Doc Date From ${escapeHtml(dateFromLabel)} To ${escapeHtml(dateToLabel)}</div>
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
  const signatoryMarkup = signatories.length
    ? `
            <div class="signatories">
              ${signatories.map((item) => `
                <div class="signatory">
                  ${item.name ? `<div class="signatory-name">${escapeHtml(item.name)}</div>` : '<div class="signatory-name">&nbsp;</div>'}
                  <div class="signatory-line">${escapeHtml(item.title || '')}</div>
                </div>
              `).join('')}
            </div>`
    : ''

  const bodyRows = tableRows.map((row) => {
    if (row.kind === 'opening' || row.kind === 'closing') {
      return `
                <tr class="opening">
                  <td colspan="2"></td>
                  <td class="carry-label">${escapeHtml(row.cells[2])}</td>
                  <td class="num">${escapeHtml(row.cells[3])}</td>
                  <td class="num">${escapeHtml(row.cells[4])}</td>
                  <td class="num">${escapeHtml(row.cells[5])}</td>
                  <td class="num">${escapeHtml(row.cells[6])}</td>
                  <td class="num">${escapeHtml(row.cells[7])}</td>
                  <td class="num">${escapeHtml(row.cells[8])}</td>
                </tr>`
    }
    return `
        <tr>
          <td class="col-doc">${escapeHtml(row.cells[0])}</td>
          <td class="col-date">${escapeHtml(row.cells[1])}</td>
          <td class="narration">${escapeHtml(row.cells[2])}</td>
          <td class="num">${escapeHtml(row.cells[3])}</td>
          <td class="num">${escapeHtml(row.cells[4])}</td>
          <td class="num">${escapeHtml(row.cells[5])}</td>
          <td class="num">${escapeHtml(row.cells[6])}</td>
          <td class="num">${escapeHtml(row.cells[7])}</td>
          <td class="num">${escapeHtml(row.cells[8])}</td>
        </tr>`
  }).join('')

  const html = `
      <html>
        <head>
          <title>Statement of Account ${escapeHtml(accountCode)}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            :root {
              --soa-header-bg: #E8ECF1;
              --soa-border: #374151;
              --soa-ink: #111827;
            }
            body { font-family: Arial, Helvetica, sans-serif; color: var(--soa-ink); margin: 0; padding: 12px 14px 16px; background: #FFFFFF; color-adjust: exact; -webkit-print-color-adjust: exact; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; box-sizing: border-box; font-weight: 500; }
            .sheet { width: 100%; max-width: 100%; box-sizing: border-box; overflow: visible; }
            .header { display: grid; grid-template-columns: ${Math.max(164, logoWidth + 4)}px minmax(0, 1fr) minmax(220px, 330px); align-items: center; gap: 16px; margin-bottom: 12px; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .header-loopc { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 8px; }
            .header-loopc .logo-wrap { min-width: ${Math.max(120, logoWidth)}px; display: flex; justify-content: flex-end; align-items: center; }
            .brand-copy-loopc { padding-top: 0; font-size: 10px; line-height: 1.45; max-width: 420px; word-break: normal; overflow-wrap: anywhere; }
            .brand-copy-loopc .company { font-size: 15px; font-weight: 700; margin-bottom: 4px; line-height: 1.25; overflow-wrap: anywhere; }
            .brand-copy-loopc .muted { font-size: 10px; line-height: 1.45; font-weight: 600; color: #374151; overflow-wrap: anywhere; }
            .statement-head-loopc { text-align: center; padding-top: 8px; margin-bottom: 12px; }
            .statement-head-loopc .subtitle { font-size: 12px; color: #4B5563; margin-bottom: 4px; font-weight: 600; }
            .signatories { margin-top: 18px; display: grid; grid-template-columns: repeat(${Math.max(signatories.length, 1)}, minmax(0, 1fr)); gap: 20px; text-align: center; }
            .signatory-name { min-height: 22px; font-size: 11px; font-weight: 600; margin-bottom: 28px; overflow-wrap: anywhere; }
            .signatory-line { border-top: 1px solid var(--soa-border); padding-top: 6px; font-weight: 700; font-size: 11px; }
            .statement-footer-note { margin-top: 10px; font-size: 11px; color: #4B5563; font-weight: 500; overflow-wrap: anywhere; }
            .brand-copy { font-size: 11px; line-height: 1.4; padding-top: 0; overflow-wrap: anywhere; }
            .brand-copy .company { font-size: 16px; font-weight: 700; letter-spacing: 0; margin-bottom: 6px; color: #111111; line-height: 1.2; overflow-wrap: anywhere; }
            .muted { color: #374151; font-weight: 600; }
            .statement-head { text-align: right; padding-top: 0; color: #111111; }
            .statement-head .title { font-size: 16px; font-weight: 700; margin-bottom: 3px; color: #111111; line-height: 1.25; }
            .statement-head .dates { font-size: 12px; color: #111111; font-weight: 500; }
            .party-box { border: 1px solid var(--soa-border); min-height: 70px; padding: 10px 14px; margin: 4px 0 0; color-adjust: exact; -webkit-print-color-adjust: exact; overflow: visible; }
            .party-code { font-size: 13px; margin-bottom: 6px; font-weight: 600; overflow-wrap: anywhere; }
            .party-name { font-size: 13px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; overflow-wrap: anywhere; }
            .party-address { font-size: 11px; line-height: 1.3; white-space: pre-line; font-weight: 500; overflow-wrap: anywhere; }
            table { width: 100%; border-collapse: collapse; font-size: 10.5px; margin-top: 0; table-layout: fixed; }
            th, td { border: 1px solid var(--soa-border); padding: 4px 5px; vertical-align: middle; overflow-wrap: anywhere; color-adjust: exact; -webkit-print-color-adjust: exact; }
            thead th { background: var(--soa-header-bg); color: #1F2937; font-weight: 700; text-align: center; border-color: var(--soa-border); color-adjust: exact; -webkit-print-color-adjust: exact; font-size: 10.5px; }
            .subhead th { background: var(--soa-header-bg); font-size: 10.5px; color: #1F2937; border-color: var(--soa-border); color-adjust: exact; -webkit-print-color-adjust: exact; font-weight: 700; }
            .subhead th.num-head { text-align: right; padding-right: 5px; }
            .col-doc { text-align: left; overflow-wrap: anywhere; word-break: break-word; }
            .col-date { text-align: center; white-space: nowrap; }
            .narration { text-align: left; overflow-wrap: anywhere; word-break: normal; line-height: 1.3; font-weight: 500; }
            .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-right: 5px; }
            .opening td { font-weight: 700; background: #FFFFFF; color-adjust: exact; -webkit-print-color-adjust: exact; }
            .carry-label { text-align: left; font-weight: 700; }
            .footer { margin-top: 12px; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; font-style: italic; font-weight: 500; color: #111111; }
            .print-note { margin-top: 8px; font-size: 10px; color: #6B7280; text-align: right; font-weight: 500; }
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
              <div class="party-code">${escapeHtml(accountCode || '')}</div>
              <div class="party-name">${escapeHtml(accountName)}</div>
              <div class="party-address">${escapeHtml(accountAddress)}</div>
            </div>
            <table>
              <colgroup>
                <col style="width:13%;" />
                <col style="width:8%;" />
                <col style="width:19%;" />
                <col style="width:10%;" />
                <col style="width:10%;" />
                <col style="width:11%;" />
                <col style="width:9.5%;" />
                <col style="width:9.5%;" />
                <col style="width:10%;" />
              </colgroup>
              <thead>
                <tr>
                  <th rowspan="2">Doc No</th>
                  <th rowspan="2">Doc Date</th>
                  <th rowspan="2">Narration</th>
                  <th colspan="3">Amount (${escapeHtml(currency)})</th>
                  <th colspan="3">${escapeHtml(metalCode)}(GMS)</th>
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
                ${bodyRows}
              </tbody>
            </table>
            <div class="footer">
              <span>Printed By: ${escapeHtml(printedByName)} On ${escapeHtml(new Date().toLocaleString())}</span>
              <span>Page 1 of 1</span>
            </div>
            ${signatoryMarkup}
            ${footerNote ? `<div class="statement-footer-note">${escapeHtml(footerNote)}</div>` : ''}
            ${showPrintNote ? '<div class="print-note">Generated from Account Summary</div>' : ''}
          </div>
        </body>
      </html>
    `
  return { html, accountCode, model }
}
