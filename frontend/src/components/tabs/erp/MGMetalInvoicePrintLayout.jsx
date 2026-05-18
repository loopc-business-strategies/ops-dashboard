export default function MGMetalInvoicePrintLayout({
  companyName,
  companyAddress,
  invoiceTitle,
  copyLabel,
  partyName,
  partyCode,
  trnValue,
  docNoValue,
  branch,
  dateValue,
  paymentTerms,
  salesman,
  fixingLabel,
  metalRateLabel,
  currencyLabel,
  lineItems,
  totals,
  amountWords,
  postingDirection,
  fmt,
}) {
  const rows = Array.isArray(lineItems) && lineItems.length ? lineItems : [{}]
  const border = '1.25px solid #111827'
  const gold = '#D99A12'
  const totalGross = rows.reduce((sum, line) => sum + Number(line?.grossWeight || 0), 0)
  const totalPure = rows.reduce((sum, line) => sum + Number(line?.pureWeight || 0), 0)
  const totalMetal = rows.reduce((sum, line) => sum + Number(line?.metalAmount || line?.amountLC || 0), 0)
  const totalVat = rows.reduce((sum, line) => sum + Number(line?.vatAmountLC || line?.vatAmountFC || 0), 0)
  const totalGrossAmount = rows.reduce((sum, line) => sum + Number(line?.amountWithVAT || line?.totalAmount || line?.amountLC || line?.metalAmount || 0), 0)
  const partyLine = `${partyName || ''}${partyCode ? ` ${partyCode}` : ''}`.trim()

  const stockDescription = (line) => {
    const code = String(line?.stockCode || '').trim()
    const product = String(line?.productType || line?.stockDescription || line?.metalName || line?.metalSymbol || '').trim()
    return [code, product].filter(Boolean).join(' - ') || partyLine || '-'
  }

  return (
    <div style={{ maxWidth: '735px', margin: '0 auto', padding: '10px 8px 6px', color: '#111111', fontFamily: 'Arial, sans-serif', fontSize: '9.5px', pageBreakInside: 'avoid', colorAdjust: 'exact', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '18px', fontWeight: '900', lineHeight: 1.05, marginBottom: '3px' }}>{companyName}</div>
        <div style={{ fontSize: '12px', lineHeight: 1.25, whiteSpace: 'pre-line' }}>{companyAddress}</div>
      </div>

      <div style={{ position: 'relative', height: '28px', marginBottom: '7px' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '13px', borderTop: `7px solid ${gold}` }} />
        <div style={{ position: 'relative', zIndex: 1, marginLeft: '70px', width: '318px', height: '27px', borderTop: `2px solid ${gold}`, borderBottom: `2px solid ${gold}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '900' }}>
          {invoiceTitle}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 258px', gap: '44px', alignItems: 'start', marginBottom: '6px' }}>
        <div style={{ border, borderRadius: '3px', minHeight: '86px', padding: '8px 8px 5px' }}>
          <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '10px' }}>{partyLine || '-'}</div>
          <div style={{ borderTop: border, height: '15px' }} />
          <div style={{ borderTop: border, height: '17px' }} />
          <div style={{ marginTop: '5px' }}>TRN {trnValue ? `- ${trnValue}` : '-'}</div>
        </div>

        <div>
          <div style={{ textAlign: 'right', color: '#7A7A7A', fontWeight: '900', fontSize: '13px', margin: '-14px 0 5px' }}>{copyLabel}</div>
          <div style={{ border, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {[
              [invoiceTitle.startsWith('PURCHASE') ? 'PUR NO' : 'SAL NO', docNoValue ? `${branch} - ${docNoValue}` : branch],
              ['Date', dateValue],
              ['Payment Terms', paymentTerms],
              ['Salesman', salesman],
              ['Metal Rate', metalRateLabel],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', minHeight: '18px', alignItems: 'center', borderBottom: label === 'Metal Rate' ? 0 : border, padding: '0 7px' }}>
                <strong>{label}</strong>
                <span>: {value || ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', fontStyle: 'italic', margin: '0 0 5px' }}>Page 1 of 1</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '8.7px' }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            <th rowSpan={2} style={{ border, padding: '3px 2px', width: '24px' }}>No.</th>
            <th rowSpan={2} style={{ border, padding: '3px 3px', width: '116px' }}>Stock Description</th>
            <th rowSpan={2} style={{ border, padding: '3px 3px', width: '61px' }}>Gross Wt.</th>
            <th rowSpan={2} style={{ border, padding: '3px 3px', width: '48px' }}>Purity</th>
            <th rowSpan={2} style={{ border, padding: '3px 3px', width: '58px' }}>Pure Wt.</th>
            <th colSpan={2} style={{ border, padding: '3px 2px', width: '110px' }}>Making ({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '3px 2px', width: '63px' }}>Metal<br />Amount</th>
            <th rowSpan={2} style={{ border, padding: '3px 2px', width: '72px' }}>Net Amt (Excl VAT)<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '3px 2px', width: '35px' }}>VAT<br />%</th>
            <th rowSpan={2} style={{ border, padding: '3px 2px', width: '56px' }}>VAT Amt<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '3px 2px', width: '70px' }}>Gross Amt<br />(Incl VAT)<br />({currencyLabel})</th>
          </tr>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ border, padding: '3px 2px' }}>Rate</th>
            <th style={{ border, padding: '3px 2px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const metalAmount = Number(line?.metalAmount || line?.amountLC || 0)
            const netAmount = Number(line?.totalAmount || line?.amountLC || metalAmount)
            const vatAmount = Number(line?.vatAmountLC || line?.vatAmountFC || 0)
            const grossAmount = Number(line?.amountWithVAT || netAmount + vatAmount)
            return (
              <tr key={`mg-metal-print-${idx}`} style={{ height: rows.length === 1 ? '250px' : '38px' }}>
                <td style={{ border, padding: '5px 3px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ border, padding: '5px 4px', verticalAlign: 'top' }}>{stockDescription(line)}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.grossWeight || 0)}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{line?.purity || ''}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.pureWeight || 0)}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{line?.makingRate ? fmt(line.makingRate) : ''}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{line?.makingCharges ? fmt(line.makingCharges) : ''}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(metalAmount)}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(netAmount)}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.vatPer || 0)}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(vatAmount)}</td>
                <td style={{ border, padding: '5px 3px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(grossAmount)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={2} style={{ border, padding: '4px 3px', fontWeight: '900' }}>({rows.length} Item{rows.length === 1 ? '' : 's'})</td>
            <td style={{ border, padding: '4px 3px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalGross)}</td>
            <td style={{ border, padding: '4px 3px' }} />
            <td style={{ border, padding: '4px 3px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalPure)}</td>
            <td style={{ border, padding: '4px 3px' }} />
            <td style={{ border, padding: '4px 3px' }} />
            <td style={{ border, padding: '4px 3px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '4px 3px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '4px 3px' }} />
            <td style={{ border, padding: '4px 3px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalVat)}</td>
            <td style={{ border, padding: '4px 3px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalGrossAmount)}</td>
          </tr>
          {[
            [`${fixingLabel} @ ${metalRateLabel || '-'}`, totalGrossAmount],
            [`Total Amount Before VAT(${currencyLabel})`, totalGrossAmount - totalVat],
            [`Total VAT Amount(${currencyLabel})`, totalVat],
            [`Total Amount Including VAT(${currencyLabel})`, totalGrossAmount],
            [`Total Party Amount (${currencyLabel})`, totalGrossAmount],
          ].map(([label, amount]) => (
            <tr key={label}>
              <td colSpan={11} style={{ border, padding: '5px 5px', textAlign: 'right', fontWeight: '900', fontSize: '10px' }}>{label}</td>
              <td style={{ border, padding: '5px 5px', textAlign: 'right', fontWeight: '900' }}>{fmt(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ margin: '5px 0 3px 2px', fontStyle: 'italic' }}>Your account has been updated with :</div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', border, minHeight: '25px', alignItems: 'center' }}>
        <div style={{ borderRight: border, padding: '5px 5px', fontSize: '11px', fontWeight: '900' }}>{currencyLabel} {fmt(totals.grandTotal || totalGrossAmount)} {postingDirection}</div>
        <div style={{ padding: '5px 7px' }}>{amountWords}</div>
      </div>
      <div style={{ borderLeft: border, borderRight: border, borderBottom: border, padding: '4px 6px', minHeight: '22px' }}>
        Amount In Words ({currencyLabel}) : {String(amountWords || '').toUpperCase()}
      </div>

      <div style={{ marginTop: '6px', fontStyle: 'italic' }}>Confirmed for &amp; on behalf of</div>
      <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: '900' }}>{partyName || partyLine || '-'}</div>

      <div style={{ marginTop: '28px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '98px', textAlign: 'center', fontSize: '10px', fontWeight: '900' }}>
        <div><div style={{ borderTop: border, paddingTop: '5px' }}>CUSTOMER'S SIGNATURE</div></div>
        <div><div style={{ borderTop: border, paddingTop: '5px' }}>CHECKED BY</div></div>
        <div><div style={{ borderTop: border, paddingTop: '5px' }}>AUTHORISED SIGNATORY</div></div>
      </div>
    </div>
  )
}
