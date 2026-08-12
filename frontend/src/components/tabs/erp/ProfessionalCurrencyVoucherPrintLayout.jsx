import { PROFESSIONAL_SHEET_STYLE, ProfessionalGoldTitleBar, buildProfessionalCurrencyDocLabel } from '../voucher/professionalVoucherPrint'

const DEFAULT_CURRENCY_SIGNATORIES = [
  { title: "CUSTOMER'S SIGNATURE" },
  { title: 'CHECKED BY' },
  { title: 'AUTHORISED SIGNATORY' },
]

function renderSignatories(signatories, border) {
  const visible = (Array.isArray(signatories) ? signatories : []).filter((item) => item.visible !== false)
  const items = visible.length ? visible : DEFAULT_CURRENCY_SIGNATORIES
  const columns = Math.max(items.length, 1)
  return (
    <div
      className="voucher-print-signatures"
      style={{
        marginTop: '28px',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '24px',
        textAlign: 'center',
        fontSize: '9px',
        fontWeight: '900',
      }}
    >
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`}>
          {item.name ? <div style={{ fontSize: '11px', marginBottom: '28px' }}>{item.name}</div> : <div style={{ minHeight: '28px' }} />}
          <div style={{ borderTop: border, paddingTop: '6px' }}>{item.title}</div>
        </div>
      ))}
    </div>
  )
}

export default function ProfessionalCurrencyVoucherPrintLayout({
  companyName,
  companyAddress,
  documentEmail,
  phoneValue,
  logoImage,
  logoWidth = 136,
  logoHeight = 136,
  titleAccentColor = '#D99A12',
  printTitle,
  copyLabel,
  voucherType,
  accountDescription,
  trnValue,
  docNoValue,
  branch,
  dateValue,
  preparedByValue,
  amountLabel,
  currencyLabel,
  lineItems,
  primaryLine,
  totals,
  amountWords,
  partyName,
  partyAddress,
  partyPhone,
  postingDirection = 'CREDITED',
  confirmedForLabel = 'Confirmed for & on behalf of',
  signatories,
  normalizeLineType,
  fmt,
}) {
  const rows = lineItems.length ? lineItems : [primaryLine]
  const recordCount = lineItems.length || 1
  const border = '1px solid #111827'
  const dashedBorder = '1px dashed #111827'
  const gold = titleAccentColor || '#D99A12'
  const docNoLabel = buildProfessionalCurrencyDocLabel(voucherType)

  return (
    <div
      className="voucher-print-sheet"
      style={{
        ...PROFESSIONAL_SHEET_STYLE,
        padding: '14px 6px 10px',
        fontSize: '11px',
        color: '#111111',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 154px', gap: '24px', alignItems: 'start', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '18px', lineHeight: '1.06', fontWeight: '900', letterSpacing: 0, marginBottom: '14px' }}>
            {companyName}
          </div>
          <div style={{ fontSize: '12px', lineHeight: '1.65', fontWeight: '800', whiteSpace: 'pre-line' }}>
            {companyAddress}
          </div>
          <div style={{ marginTop: '13px', display: 'grid', gridTemplateColumns: '54px 1fr', columnGap: '14px', rowGap: '7px', fontWeight: '800', lineHeight: '1.25' }}>
            <div>Phone</div><div>: {phoneValue || ''}</div>
            <div>Email</div><div>: {documentEmail || ''}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', paddingRight: '2px', marginTop: '-8px' }}>
          {logoImage ? (
            <img
              src={logoImage}
              alt={companyName || 'Company logo'}
              style={{
                width: `${logoWidth}px`,
                height: `${logoHeight}px`,
                objectFit: 'contain',
                filter: 'none',
                mixBlendMode: 'normal',
                colorAdjust: 'exact',
                printColorAdjust: 'exact',
                WebkitPrintColorAdjust: 'exact',
              }}
            />
          ) : null}
        </div>
      </div>

      <ProfessionalGoldTitleBar variant="currency" title={printTitle} goldColor={gold} />

      <div style={{ textAlign: 'right', fontSize: '16px', lineHeight: 1, fontWeight: '900', color: '#6B7280', marginBottom: '12px' }}>{copyLabel}</div>

      <div className="voucher-pro-party-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(200px, 1fr)', gap: '20px', marginBottom: '13px' }}>
        <div style={{ border, borderRadius: '4px', overflow: 'hidden', minHeight: '104px' }}>
          <div style={{ minHeight: '29px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px' }}>
            {accountDescription()}
          </div>
          <div style={{ borderTop: dashedBorder, minHeight: '24px', padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', lineHeight: 1.25, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
            {partyAddress || ''}
          </div>
          <div style={{ borderTop: dashedBorder, minHeight: '24px', padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', lineHeight: 1.25, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
            {partyPhone ? `Tel: ${partyPhone}` : ''}
          </div>
          <div style={{ borderTop: dashedBorder, height: '27px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
            TRN {trnValue ? `- ${trnValue}` : '-'}
          </div>
        </div>

        <div style={{ border, borderRadius: '4px', overflow: 'hidden', alignSelf: 'start' }}>
          {[
            [docNoLabel, docNoValue ? `${branch} - ${docNoValue}` : branch],
            ['Date', dateValue],
            ['Prepared By', preparedByValue || 'ADMIN'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '76px 1fr', borderBottom: label === 'Prepared By' ? 0 : dashedBorder, minHeight: '31px', alignItems: 'center', padding: '0 8px', fontSize: '12px' }}>
              <strong>{label}</strong>
              <span>:&nbsp;&nbsp;{value || ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: '11px', fontStyle: 'italic', marginBottom: '8px' }}>Page 1 of 1</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '14px', marginBottom: '9px' }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ border, padding: '8px 6px', width: '4%' }}>No.</th>
            <th style={{ border, padding: '8px 6px', width: '10%' }}>Branch</th>
            <th style={{ border, padding: '8px 6px', width: '38%' }}>Account Description</th>
            <th style={{ border, padding: '8px 6px', width: '10%' }}>Type</th>
            <th style={{ border, padding: '8px 6px', width: '19%', textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>Amount FC</th>
            <th style={{ border, padding: '8px 6px', width: '19%', textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const lineNarration = String(line?.narration || line?.remarks || line?.exp || '').trim()
            return (
              <tr key={`pro-currency-print-${idx}`} style={{ minHeight: '42px' }}>
                <td style={{ border, padding: '8px 6px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ border, padding: '8px 6px', verticalAlign: 'top' }}>{line?.branch || branch}</td>
                <td style={{ border, padding: '8px 10px', verticalAlign: 'top' }}>
                  <div>{accountDescription()}</div>
                  {lineNarration ? (
                    <div style={{ fontSize: '11px', marginTop: '6px', fontWeight: '700', lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>{lineNarration}</div>
                  ) : null}
                </td>
                <td style={{ border, padding: '8px 6px', verticalAlign: 'top' }}>{normalizeLineType(line?.type) || ''}</td>
                <td style={{ border, padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>{fmt(line?.amountFC || 0)}</td>
                <td style={{ border, padding: '8px 6px', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>{fmt(line?.amountLC || line?.amountFC || 0)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={3} style={{ border, padding: '8px 6px' }}>({recordCount} Record)</td>
            <td colSpan={2} style={{ border, padding: '8px 6px', textAlign: 'right', fontWeight: '900' }}>{`Total (${currencyLabel || 'USD'})`}</td>
            <td style={{ border, padding: '8px 8px', textAlign: 'right', fontWeight: '900', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ border, padding: '8px 6px', textAlign: 'right', fontWeight: '900' }}>{`Total Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ border, padding: '8px 8px', textAlign: 'right', fontWeight: '900', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ border, padding: '8px 6px', textAlign: 'right', fontWeight: '900' }}>{`Total Party Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ border, padding: '8px 8px', textAlign: 'right', fontWeight: '900', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ margin: '0 0 7px 6px', fontSize: '11px', fontStyle: 'italic' }}>Your account has been updated with :</div>
      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', border, minHeight: '31px', alignItems: 'center', marginBottom: '13px' }}>
        <div style={{ borderRight: border, padding: '7px 9px', fontWeight: '900', fontStyle: 'italic' }}>
          {currencyLabel || 'USD'} {fmt(totals.grandTotal || 0)} {postingDirection}
        </div>
        <div style={{ padding: '7px 10px', fontStyle: 'italic' }}>{amountWords}</div>
      </div>

      <div style={{ margin: '0 0 16px 6px', fontSize: '11px', fontStyle: 'italic' }}>{confirmedForLabel}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', margin: '0 8px 16px', fontWeight: '900', fontSize: '12px' }}>
        <div>{partyName || accountDescription()}</div>
        <div style={{ textAlign: 'right' }}>{companyName}</div>
      </div>
      {renderSignatories(signatories, border)}
    </div>
  )
}
