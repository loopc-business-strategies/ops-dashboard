import VoucherPrintNetAmounts from '../voucher/VoucherPrintNetAmounts'

const cellBase = {
  border: '1px solid #111827',
  padding: '6px 5px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

export default function MGVoucherPrintLayout({
  companyName,
  companyAddress,
  documentEmail,
  phoneValue,
  logoImage,
  printTitle,
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
  normalizeLineType,
  fmt,
  netAmountRows = [],
}) {
  const rows = lineItems.length ? lineItems : [primaryLine]
  const recordCount = lineItems.length || 1
  const border = '1px solid #111827'
  const dashedBorder = '1px dashed #111827'
  const gold = '#F19900'
  const logoSize = 126
  const accountText = typeof accountDescription === 'function' ? accountDescription() : accountDescription

  return (
    <div
      className="voucher-print-sheet"
      style={{
        maxWidth: '735px',
        margin: '0 auto',
        padding: '14px 14px 12px',
        fontSize: '10.5px',
        fontWeight: '500',
        lineHeight: 1.35,
        color: '#111111',
        pageBreakInside: 'avoid',
        overflow: 'visible',
        colorAdjust: 'exact',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: '16px', lineHeight: 1.2, fontWeight: '700', marginBottom: '5px', overflowWrap: 'anywhere' }}>
            {companyName}
          </div>
          <div style={{ fontSize: '11px', lineHeight: 1.4, fontWeight: '600', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>
            {companyAddress}
          </div>
          <div style={{ marginTop: '6px', fontSize: '10.5px', fontWeight: '600', lineHeight: 1.4 }}>
            <div>Phone : {phoneValue || ''}</div>
            <div>Email : {documentEmail || ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', width: `${logoSize}px`, height: `${logoSize}px`, flex: '0 0 auto' }}>
          {logoImage ? (
            <img
              src={logoImage}
              alt="Modern Gold Jewelry"
              style={{
                width: `${logoSize}px`,
                height: `${logoSize}px`,
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

      <div style={{ position: 'relative', height: '34px', margin: '2px 0 10px' }}>
        <div style={{ position: 'absolute', top: '13px', left: 0, right: 0, borderTop: `7px solid ${gold}`, height: 0 }} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: '13px',
            zIndex: 1,
            width: 'min(300px, 84%)',
            maxWidth: '92%',
            minHeight: '28px',
            border: `1.2px solid ${gold}`,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '15px',
            fontWeight: '800',
            letterSpacing: '0.01em',
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            padding: '3px 12px',
            boxSizing: 'border-box',
          }}
        >
          {printTitle}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontSize: '12px', lineHeight: 1.25, fontWeight: '700', color: '#4B5563', margin: '2px 0 10px', letterSpacing: '0.02em' }}>
        PARTY COPY
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(200px, 1fr)', gap: '12px', marginBottom: '10px', alignItems: 'stretch' }}>
        <div style={{ border, borderRadius: '4px', overflow: 'visible', minHeight: '96px' }}>
          <div style={{ minHeight: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', padding: '4px 8px', textAlign: 'center', overflowWrap: 'anywhere' }}>
            {accountText}
          </div>
          <div style={{ borderTop: dashedBorder, minHeight: '22px', padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', lineHeight: 1.25, textAlign: 'center', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {partyAddress || ''}
          </div>
          <div style={{ borderTop: dashedBorder, minHeight: '22px', padding: '3px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', lineHeight: 1.25, textAlign: 'center', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {partyPhone ? `Tel: ${partyPhone}` : ''}
          </div>
          <div style={{ borderTop: dashedBorder, minHeight: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '600', padding: '2px 8px' }}>
            TRN {trnValue ? `- ${trnValue}` : '-'}
          </div>
        </div>

        <div style={{ border, borderRadius: '4px', overflow: 'visible' }}>
          {[
            ['REC NO', docNoValue ? `${branch} - ${docNoValue}` : branch],
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

      <div style={{ textAlign: 'right', fontSize: '10px', fontStyle: 'italic', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>Page 1 of 1</div>

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
              <tr key={`mg-print-line-${idx}`}>
                <td style={{ ...cellBase, textAlign: 'center' }}>{idx + 1}</td>
                <td style={cellBase}>{line?.branch || branch}</td>
                <td style={{ ...cellBase, padding: '6px 7px' }}>
                  <div style={{ fontWeight: '600' }}>{accountText}</div>
                  {lineNarration ? (
                    <div style={{ fontSize: '9.5px', marginTop: '4px', fontWeight: '500', lineHeight: 1.3, whiteSpace: 'pre-wrap' }}>{lineNarration}</div>
                  ) : null}
                </td>
                <td style={cellBase}>{normalizeLineType(line?.type) || ''}</td>
                <td style={{ ...cellBase, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>{fmt(line?.amountFC || 0)}</td>
                <td style={{ ...cellBase, textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>{fmt(line?.amountLC || line?.amountFC || 0)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={3} style={{ ...cellBase, fontWeight: '600' }}>({recordCount} Record)</td>
            <td colSpan={2} style={{ ...cellBase, textAlign: 'right', fontWeight: '700' }}>{`Total (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...cellBase, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ ...cellBase, textAlign: 'right', fontWeight: '700' }}>{`Total Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...cellBase, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ ...cellBase, textAlign: 'right', fontWeight: '700' }}>{`Total Party Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...cellBase, textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingRight: 8 }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
        </tbody>
      </table>

      <VoucherPrintNetAmounts rows={netAmountRows} fmt={fmt} border={border} fontSize="10px" />
      <div style={{ margin: '0 0 6px 2px', fontSize: '10.5px', fontStyle: 'italic', fontWeight: '500' }}>Your account has been updated with :</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, max-content) minmax(0, 1fr)', border, minHeight: '28px', alignItems: 'center', marginBottom: '12px', overflow: 'visible' }}>
        <div style={{ borderRight: border, padding: '6px 8px', fontWeight: '700', fontStyle: 'italic', fontSize: '10.5px', whiteSpace: 'nowrap' }}>
          {currencyLabel || 'USD'} {fmt(totals.grandTotal || 0)} CREDITED
        </div>
        <div style={{ padding: '6px 8px', fontStyle: 'italic', fontSize: '10px', lineHeight: 1.3, fontWeight: '500', overflowWrap: 'anywhere' }}>{amountWords}</div>
      </div>

      <div style={{ margin: '0 0 8px 2px', fontSize: '10.5px', fontStyle: 'italic', fontWeight: '500' }}>Confirmed for &amp; on behalf of</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', margin: '0 4px 8px', fontWeight: '700', fontSize: '11px', lineHeight: 1.3 }}>
        <div style={{ overflowWrap: 'anywhere', minWidth: 0 }}>{partyName || accountText}</div>
        <div style={{ textAlign: 'right', overflowWrap: 'anywhere', minWidth: 0 }}>{companyName}</div>
      </div>
      <div className="voucher-print-signatures" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '24px', textAlign: 'center', fontSize: '9px', fontWeight: '700' }}>
        <div>
          <div style={{ borderTop: border, paddingTop: '6px' }}>{"CUSTOMER'S SIGNATURE"}</div>
        </div>
        <div>
          <div style={{ borderTop: border, paddingTop: '6px' }}>AUTHORISED SIGNATORY</div>
        </div>
      </div>
    </div>
  )
}
