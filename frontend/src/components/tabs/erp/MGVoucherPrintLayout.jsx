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
  normalizeLineType,
  fmt,
}) {
  const rows = lineItems.length ? lineItems : [primaryLine]
  const recordCount = lineItems.length || 1

  return (
    <div style={{ maxWidth: '735px', margin: '0 auto', fontSize: '11px', color: '#111111', pageBreakInside: 'avoid' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 170px', gap: '18px', alignItems: 'start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '18px', lineHeight: '1.1', fontWeight: '900', letterSpacing: 0, marginBottom: '8px' }}>
            {companyName}
          </div>
          <div style={{ fontSize: '12px', lineHeight: '1.55', fontWeight: '700', whiteSpace: 'pre-line' }}>
            {companyAddress}
          </div>
          <div style={{ marginTop: '7px', display: 'grid', gridTemplateColumns: '52px 1fr', gap: '6px', fontWeight: '700', lineHeight: '1.45' }}>
            <div>Phone</div><div>: {phoneValue || ''}</div>
            <div>Email</div><div>: {documentEmail || ''}</div>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          {logoImage ? (
            <img src={logoImage} alt="Modern Gold Jewelry" style={{ width: '136px', height: '136px', objectFit: 'contain' }} />
          ) : null}
        </div>
      </div>

      <div style={{ position: 'relative', height: '30px', margin: '2px 0 8px' }}>
        <div style={{ position: 'absolute', top: '11px', left: 0, right: 0, borderTop: '5px solid #F19900', borderBottom: '2px solid #F19900', height: '7px' }} />
        <div style={{ position: 'relative', zIndex: 1, marginLeft: '90px', width: '290px', height: '28px', border: '1px solid #F19900', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '900' }}>
          {printTitle}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: '800', color: '#6B7280', marginBottom: '8px' }}>PARTY COPY</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 278px', gap: '22px', marginBottom: '14px' }}>
        <div style={{ border: '1.5px solid #111827', borderRadius: '4px', overflow: 'hidden', minHeight: '104px' }}>
          <div style={{ minHeight: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '12px' }}>
            {accountDescription()}
          </div>
          <div style={{ borderTop: '1.5px dashed #111827', height: '24px' }} />
          <div style={{ borderTop: '1.5px dashed #111827', height: '24px' }} />
          <div style={{ borderTop: '1.5px dashed #111827', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            TRN {trnValue ? `- ${trnValue}` : '-'}
          </div>
        </div>

        <div style={{ border: '1.5px solid #111827', borderRadius: '4px', overflow: 'hidden', alignSelf: 'start' }}>
          {[
            ['REC NO', docNoValue ? `${branch} - ${docNoValue}` : branch],
            ['Date', dateValue],
            ['Prepared By', preparedByValue || 'ADMIN'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'grid', gridTemplateColumns: '86px 1fr', borderBottom: label === 'Prepared By' ? 0 : '1.5px dashed #111827', minHeight: '29px', alignItems: 'center', padding: '0 10px', fontSize: '12px' }}>
              <strong>{label}</strong>
              <span>:&nbsp;&nbsp;{value || ''}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'right', fontSize: '11px', fontStyle: 'italic', marginBottom: '6px' }}>Page 1 of 1</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '11px', marginBottom: '8px' }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ border: '1.5px solid #111827', padding: '6px 4px', width: '28px' }}>No.</th>
            <th style={{ border: '1.5px solid #111827', padding: '6px 4px', width: '64px' }}>Branch</th>
            <th style={{ border: '1.5px solid #111827', padding: '6px 4px' }}>Account Description</th>
            <th style={{ border: '1.5px solid #111827', padding: '6px 4px', width: '58px' }}>Type</th>
            <th style={{ border: '1.5px solid #111827', padding: '6px 4px', width: '118px' }}>Amount FC</th>
            <th style={{ border: '1.5px solid #111827', padding: '6px 4px', width: '126px' }}>{amountLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => (
            <tr key={`mg-print-line-${idx}`} style={{ height: lineItems.length <= 1 ? '150px' : '42px' }}>
              <td style={{ border: '1.5px solid #111827', padding: '7px 5px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
              <td style={{ border: '1.5px solid #111827', padding: '7px 5px', verticalAlign: 'top' }}>{line?.branch || branch}</td>
              <td style={{ border: '1.5px solid #111827', padding: '7px 10px', verticalAlign: 'top' }}>{accountDescription()}</td>
              <td style={{ border: '1.5px solid #111827', padding: '7px 7px', verticalAlign: 'top' }}>{normalizeLineType(line?.type) || ''}</td>
              <td style={{ border: '1.5px solid #111827', padding: '7px 7px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.amountFC || 0)}</td>
              <td style={{ border: '1.5px solid #111827', padding: '7px 7px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.amountLC || line?.amountFC || 0)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} style={{ border: '1.5px solid #111827', padding: '6px 6px' }}>({recordCount} Record)</td>
            <td colSpan={2} style={{ border: '1.5px solid #111827', padding: '6px 6px', textAlign: 'right', fontWeight: '800' }}>{`Total (${currencyLabel || 'USD'})`}</td>
            <td style={{ border: '1.5px solid #111827', padding: '6px 8px', textAlign: 'right', fontWeight: '800' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ border: '1.5px solid #111827', padding: '6px 6px', textAlign: 'right', fontWeight: '800' }}>{`Total Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ border: '1.5px solid #111827', padding: '6px 8px', textAlign: 'right', fontWeight: '800' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td colSpan={5} style={{ border: '1.5px solid #111827', padding: '6px 6px', textAlign: 'right', fontWeight: '800' }}>{`Total Party Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ border: '1.5px solid #111827', padding: '6px 8px', textAlign: 'right', fontWeight: '800' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ margin: '0 0 5px 6px', fontSize: '11px', fontStyle: 'italic' }}>Your account has been updated with :</div>
      <div style={{ display: 'grid', gridTemplateColumns: '235px 1fr', border: '1.5px solid #111827', minHeight: '30px', alignItems: 'center', marginBottom: '9px' }}>
        <div style={{ borderRight: '1.5px solid #111827', padding: '6px 8px', fontWeight: '900', fontStyle: 'italic' }}>
          {currencyLabel || 'USD'} {fmt(totals.grandTotal || 0)} CREDITED
        </div>
        <div style={{ padding: '6px 10px', fontStyle: 'italic' }}>{amountWords}</div>
      </div>

      <div style={{ margin: '0 0 10px 6px', fontSize: '11px', fontStyle: 'italic' }}>Confirmed for &amp; on behalf of</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', margin: '0 8px 42px', fontWeight: '900', fontSize: '11px' }}>
        <div>{partyName || accountDescription()}</div>
        <div style={{ textAlign: 'right' }}>{companyName}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '210px', textAlign: 'center', fontSize: '9px' }}>
        <div>
          <div style={{ borderTop: '1.5px solid #111827', paddingTop: '5px' }}>CUSTOMER'S SIGNATURE</div>
        </div>
        <div>
          <div style={{ borderTop: '1.5px solid #111827', paddingTop: '5px' }}>AUTHORISED SIGNATORY</div>
        </div>
      </div>
    </div>
  )
}
