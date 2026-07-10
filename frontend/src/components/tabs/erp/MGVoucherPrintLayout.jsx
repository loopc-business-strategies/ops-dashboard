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
}) {
  const rows = lineItems.length ? lineItems : [primaryLine]
  const recordCount = lineItems.length || 1
  const border = '1px solid #111827'
  const dashedBorder = '1px dashed #111827'
  const gold = '#F19900'
  const logoSize = '136px'

  return (
    <div style={{ maxWidth: '735px', margin: '0 auto', padding: '14px 6px 10px', fontSize: '11px', color: '#111111', pageBreakInside: 'avoid', colorAdjust: 'exact', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
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
              alt="Modern Gold Jewelry"
              style={{
                width: logoSize,
                height: logoSize,
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

      <div style={{ position: 'relative', height: '31px', margin: '4px 0 13px' }}>
        <div style={{ position: 'absolute', top: '12px', left: 0, right: 0, borderTop: `7px solid ${gold}`, height: 0 }} />
        <div style={{ position: 'relative', zIndex: 1, marginLeft: '96px', width: '286px', height: '29px', border: `1.2px solid ${gold}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '900', letterSpacing: 0 }}>
          {printTitle}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: '16px', lineHeight: 1, fontWeight: '900', color: '#6B7280', marginBottom: '12px' }}>PARTY COPY</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 264px', gap: '20px', marginBottom: '13px' }}>
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
            ['REC NO', docNoValue ? `${branch} - ${docNoValue}` : branch],
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
            <th style={{ border, padding: '8px 6px', width: '34px' }}>No.</th>
            <th style={{ border, padding: '8px 6px', width: '64px' }}>Branch</th>
            <th style={{ border, padding: '8px 6px' }}>Account Description</th>
            <th style={{ border, padding: '8px 6px', width: '58px' }}>Type</th>
            <th style={{ border, padding: '8px 6px', width: '116px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>Amount FC</th>
            <th style={{ border, padding: '8px 6px', width: '124px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', paddingRight: 10 }}>{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const lineNarration = String(line?.narration || line?.remarks || line?.exp || '').trim()
            return (
              <tr key={`mg-print-line-${idx}`} style={{ height: lineItems.length <= 1 ? '148px' : '42px' }}>
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
          {currencyLabel || 'USD'} {fmt(totals.grandTotal || 0)} CREDITED
        </div>
        <div style={{ padding: '7px 10px', fontStyle: 'italic' }}>{amountWords}</div>
      </div>

      <div style={{ margin: '0 0 16px 6px', fontSize: '11px', fontStyle: 'italic' }}>Confirmed for &amp; on behalf of</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '112px', margin: '0 8px 72px', fontWeight: '900', fontSize: '12px' }}>
        <div>{partyName || accountDescription()}</div>
        <div style={{ textAlign: 'right' }}>{companyName}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '230px', textAlign: 'center', fontSize: '9px' }}>
        <div>
          <div style={{ borderTop: border, paddingTop: '6px' }}>CUSTOMER'S SIGNATURE</div>
        </div>
        <div>
          <div style={{ borderTop: border, paddingTop: '6px' }}>AUTHORISED SIGNATORY</div>
        </div>
      </div>
    </div>
  )
}
