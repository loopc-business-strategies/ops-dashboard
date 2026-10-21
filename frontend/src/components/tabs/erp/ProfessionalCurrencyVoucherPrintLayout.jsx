import { PROFESSIONAL_SHEET_STYLE, ProfessionalGoldTitleBar, buildProfessionalCurrencyDocLabel } from '../voucher/professionalVoucherPrint'
import VoucherPrintNetAmounts from '../voucher/VoucherPrintNetAmounts'

const DEFAULT_CURRENCY_SIGNATORIES = [
  { title: "CUSTOMER'S SIGNATURE" },
  { title: 'CHECKED BY' },
  { title: 'AUTHORISED SIGNATORY' },
]

const cellBase = {
  border: '1px solid #111827',
  padding: '6px 5px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

function renderSignatories(signatories, border) {
  const visible = (Array.isArray(signatories) ? signatories : []).filter((item) => item.visible !== false)
  const items = visible.length ? visible : DEFAULT_CURRENCY_SIGNATORIES
  const columns = Math.max(items.length, 1)
  return (
    <div
      className="voucher-print-signatures"
      style={{
        marginTop: '24px',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: '20px',
        textAlign: 'center',
        fontSize: '9px',
        fontWeight: '700',
        lineHeight: 1.25,
      }}
    >
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`} style={{ minWidth: 0 }}>
          {item.name ? (
            <div style={{ fontSize: '10.5px', fontWeight: '600', marginBottom: '24px', overflowWrap: 'anywhere' }}>{item.name}</div>
          ) : (
            <div style={{ minHeight: '24px' }} />
          )}
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
  logoWidth = 160,
  logoHeight = 126,
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
  netAmountRows = [],
}) {
  const rows = lineItems.length ? lineItems : [primaryLine]
  const recordCount = lineItems.length || 1
  const border = '1px solid #111827'
  const dashedBorder = '1px dashed #111827'
  const gold = titleAccentColor || '#D99A12'
  const docNoLabel = buildProfessionalCurrencyDocLabel(voucherType)
  const accountText = typeof accountDescription === 'function' ? accountDescription() : accountDescription

  return (
    <div
      className="voucher-print-sheet"
      style={{
        ...PROFESSIONAL_SHEET_STYLE,
        padding: '14px 14px 12px',
        fontSize: '10.5px',
        fontWeight: '500',
        color: '#111111',
        lineHeight: 1.35,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '270mm',
        overflow: 'visible',
      }}
    >
      <div style={{ overflow: 'visible' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          columnGap: '16px',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div
            style={{
              fontSize: '16px',
              lineHeight: 1.2,
              fontWeight: '700',
              letterSpacing: 0,
              marginBottom: '5px',
              overflowWrap: 'anywhere',
            }}
          >
            {companyName}
          </div>
          {companyAddress ? (
            <div
              style={{
                fontSize: '11px',
                lineHeight: 1.4,
                fontWeight: '600',
                whiteSpace: 'pre-line',
                marginBottom: '5px',
                overflowWrap: 'anywhere',
              }}
            >
              {companyAddress}
            </div>
          ) : null}
          <div style={{ fontSize: '10.5px', lineHeight: 1.4, fontWeight: '600' }}>
            <div>Phone : {phoneValue || ''}</div>
            <div>Email : {documentEmail || ''}</div>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            width: `${logoWidth}px`,
            height: `${logoHeight}px`,
            flex: '0 0 auto',
            overflow: 'visible',
          }}
        >
          {logoImage ? (
            <img
              src={logoImage}
              alt={companyName || 'Company logo'}
              style={{
                width: `${logoWidth}px`,
                height: `${logoHeight}px`,
                objectFit: 'contain',
                objectPosition: 'right center',
                display: 'block',
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

      <div
        style={{
          textAlign: 'center',
          fontSize: '12px',
          lineHeight: 1.25,
          fontWeight: '700',
          color: '#4B5563',
          margin: '2px 0 10px',
          letterSpacing: '0.02em',
        }}
      >
        {copyLabel}
      </div>

      <div
        className="voucher-pro-party-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(200px, 1fr)',
          gap: '12px',
          marginBottom: '10px',
          alignItems: 'stretch',
        }}
      >
        <div style={{ border, borderRadius: '4px', overflow: 'visible', minHeight: '96px' }}>
          <div
            style={{
              minHeight: '26px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '700',
              fontSize: '11px',
              padding: '4px 8px',
              textAlign: 'center',
              overflowWrap: 'anywhere',
            }}
          >
            {accountText}
          </div>
          <div
            style={{
              borderTop: dashedBorder,
              minHeight: '22px',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '600',
              lineHeight: 1.25,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {partyAddress || ''}
          </div>
          <div
            style={{
              borderTop: dashedBorder,
              minHeight: '22px',
              padding: '3px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '600',
              lineHeight: 1.25,
              textAlign: 'center',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {partyPhone ? `Tel: ${partyPhone}` : ''}
          </div>
          <div
            style={{
              borderTop: dashedBorder,
              minHeight: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '600',
              padding: '2px 8px',
            }}
          >
            TRN {trnValue ? `- ${trnValue}` : '-'}
          </div>
        </div>

        <div style={{ border, borderRadius: '4px', overflow: 'visible', alignSelf: 'stretch' }}>
          {[
            [docNoLabel, docNoValue ? `${branch} - ${docNoValue}` : branch],
            ['Date', dateValue],
            ['Prepared By', preparedByValue || 'ADMIN'],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                display: 'grid',
                gridTemplateColumns: '88px minmax(0, 1fr)',
                borderBottom: label === 'Prepared By' ? 0 : dashedBorder,
                minHeight: '28px',
                alignItems: 'center',
                padding: '3px 8px',
                fontSize: '10.5px',
                lineHeight: 1.3,
              }}
            >
              <span style={{ fontWeight: '700' }}>{label}</span>
              <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>:&nbsp;&nbsp;{value || ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: '10px', fontStyle: 'italic', fontWeight: '500', marginBottom: '6px', color: '#374151' }}>
        Page 1 of 1
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10.5px', marginBottom: '8px' }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ ...cellBase, width: '5%', textAlign: 'center', fontWeight: '700' }}>No.</th>
            <th style={{ ...cellBase, width: '9%', fontWeight: '700' }}>Branch</th>
            <th style={{ ...cellBase, width: '38%', fontWeight: '700' }}>Account Description</th>
            <th style={{ ...cellBase, width: '10%', fontWeight: '700' }}>Type</th>
            <th style={{ ...cellBase, width: '19%', textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 8, fontWeight: '700' }}>Amount FC</th>
            <th style={{ ...cellBase, width: '19%', textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 8, fontWeight: '700' }}>{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const lineNarration = String(line?.narration || line?.remarks || line?.exp || '').trim()
            return (
              <tr key={`pro-currency-print-${idx}`}>
                <td style={{ ...cellBase, textAlign: 'center' }}>{idx + 1}</td>
                <td style={cellBase}>{line?.branch || branch}</td>
                <td style={{ ...cellBase, padding: '6px 7px' }}>
                  <div style={{ fontWeight: '600' }}>{accountText}</div>
                  {lineNarration ? (
                    <div style={{ fontSize: '9.5px', marginTop: '4px', fontWeight: '500', lineHeight: 1.3, whiteSpace: 'pre-wrap' }}>{lineNarration}</div>
                  ) : null}
                </td>
                <td style={cellBase}>{normalizeLineType(line?.type) || ''}</td>
                <td style={{ ...cellBase, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>
                  {fmt(line?.amountFC || 0)}
                </td>
                <td style={{ ...cellBase, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>
                  {fmt(line?.amountLC || line?.amountFC || 0)}
                </td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={3} style={{ ...cellBase, fontWeight: '600' }}>({recordCount} Record)</td>
            <td colSpan={2} style={{ ...cellBase, textAlign: 'right', fontWeight: '700' }}>{`Total (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...cellBase, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>
              {fmt(totals.grandTotal || 0)}
            </td>
          </tr>
          <tr>
            <td colSpan={5} style={{ ...cellBase, textAlign: 'right', fontWeight: '700' }}>{`Total Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...cellBase, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>
              {fmt(totals.grandTotal || 0)}
            </td>
          </tr>
          <tr>
            <td colSpan={5} style={{ ...cellBase, textAlign: 'right', fontWeight: '700' }}>{`Total Party Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...cellBase, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>
              {fmt(totals.grandTotal || 0)}
            </td>
          </tr>
        </tbody>
      </table>

      <VoucherPrintNetAmounts rows={netAmountRows} fmt={fmt} border={border} fontSize="10px" />
      <div style={{ margin: '0 0 6px 2px', fontSize: '10.5px', fontStyle: 'italic', fontWeight: '500' }}>
        Your account has been updated with :
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(150px, max-content) minmax(0, 1fr)',
          border,
          minHeight: '28px',
          alignItems: 'center',
          marginBottom: '12px',
          overflow: 'visible',
        }}
      >
        <div style={{ borderRight: border, padding: '6px 8px', fontWeight: '700', fontStyle: 'italic', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
          {currencyLabel || 'USD'} {fmt(totals.grandTotal || 0)} {postingDirection}
        </div>
        <div style={{ padding: '6px 8px', fontStyle: 'italic', fontSize: '10px', lineHeight: 1.3, fontWeight: '500', overflowWrap: 'anywhere' }}>
          {amountWords}
        </div>
      </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '8px', overflow: 'visible' }}>
        <div style={{ margin: '0 0 8px 2px', fontSize: '10.5px', fontStyle: 'italic', fontWeight: '500' }}>{confirmedForLabel}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: '20px',
            margin: '0 4px 8px',
            fontWeight: '700',
            fontSize: '11px',
            lineHeight: 1.3,
          }}
        >
          <div style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{partyName || accountText}</div>
          <div style={{ textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{companyName}</div>
        </div>
        {renderSignatories(signatories, border)}
      </div>
    </div>
  )
}
