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
    <div style={{ maxWidth: '735px', margin: '0 auto', padding: '18px 8px 12px', color: '#111111', fontFamily: 'Arial, sans-serif', fontSize: '10.5px', pageBreakInside: 'avoid', colorAdjust: 'exact', printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      <div style={{ marginBottom: '26px' }}>
        <div style={{ fontSize: '20px', fontWeight: '900', lineHeight: 1.1, marginBottom: '5px' }}>{companyName}</div>
        <div style={{ fontSize: '14px', lineHeight: 1.35, whiteSpace: 'pre-line' }}>{companyAddress}</div>
      </div>

      <div style={{ position: 'relative', height: '34px', marginBottom: '10px' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '15px', borderTop: `8px solid ${gold}` }} />
        <div style={{ position: 'relative', zIndex: 1, marginLeft: '70px', width: '318px', height: '32px', borderTop: `2px solid ${gold}`, borderBottom: `2px solid ${gold}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '900' }}>
          {invoiceTitle}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 258px', gap: '46px', alignItems: 'start', marginBottom: '10px' }}>
        <div style={{ border, borderRadius: '3px', minHeight: '122px', padding: '12px 8px 8px' }}>
          <div style={{ fontSize: '15px', fontWeight: '900', marginBottom: '18px' }}>{partyLine || '-'}</div>
          <div style={{ borderTop: border, height: '20px' }} />
          <div style={{ borderTop: border, height: '24px' }} />
          <div style={{ marginTop: '8px' }}>TRN {trnValue ? `- ${trnValue}` : '-'}</div>
        </div>

        <div>
          <div style={{ textAlign: 'right', color: '#7A7A7A', fontWeight: '900', fontSize: '15px', margin: '-18px 0 8px' }}>{copyLabel}</div>
          <div style={{ border, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {[
              [invoiceTitle.startsWith('PURCHASE') ? 'PUR NO' : 'SAL NO', docNoValue ? `${branch} - ${docNoValue}` : branch],
              ['Date', dateValue],
              ['Payment Terms', paymentTerms],
              ['Salesman', salesman],
              ['Metal Rate', metalRateLabel],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '92px 1fr', minHeight: '22px', alignItems: 'center', borderBottom: label === 'Metal Rate' ? 0 : border, padding: '0 8px' }}>
                <strong>{label}</strong>
                <span>: {value || ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', fontStyle: 'italic', margin: '0 0 8px' }}>Page 1 of 1</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '9.5px' }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            <th rowSpan={2} style={{ border, padding: '5px 3px', width: '25px' }}>No.</th>
            <th rowSpan={2} style={{ border, padding: '5px 4px', width: '116px' }}>Stock Description</th>
            <th rowSpan={2} style={{ border, padding: '5px 4px', width: '61px' }}>Gross Wt.</th>
            <th rowSpan={2} style={{ border, padding: '5px 4px', width: '48px' }}>Purity</th>
            <th rowSpan={2} style={{ border, padding: '5px 4px', width: '58px' }}>Pure Wt.</th>
            <th colSpan={2} style={{ border, padding: '4px 3px', width: '110px' }}>Making ({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '5px 3px', width: '63px' }}>Metal<br />Amount</th>
            <th rowSpan={2} style={{ border, padding: '5px 3px', width: '72px' }}>Net Amt (Excl VAT)<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '5px 3px', width: '35px' }}>VAT<br />%</th>
            <th rowSpan={2} style={{ border, padding: '5px 3px', width: '56px' }}>VAT Amt<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '5px 3px', width: '70px' }}>Gross Amt<br />(Incl VAT)<br />({currencyLabel})</th>
          </tr>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ border, padding: '4px 3px' }}>Rate</th>
            <th style={{ border, padding: '4px 3px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const metalAmount = Number(line?.metalAmount || line?.amountLC || 0)
            const netAmount = Number(line?.totalAmount || line?.amountLC || metalAmount)
            const vatAmount = Number(line?.vatAmountLC || line?.vatAmountFC || 0)
            const grossAmount = Number(line?.amountWithVAT || netAmount + vatAmount)
            return (
              <tr key={`mg-metal-print-${idx}`} style={{ height: rows.length === 1 ? '360px' : '56px' }}>
                <td style={{ border, padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ border, padding: '6px 5px', verticalAlign: 'top' }}>{stockDescription(line)}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.grossWeight || 0)}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{line?.purity || ''}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.pureWeight || 0)}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{line?.makingRate ? fmt(line.makingRate) : ''}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{line?.makingCharges ? fmt(line.makingCharges) : ''}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(metalAmount)}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(netAmount)}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.vatPer || 0)}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(vatAmount)}</td>
                <td style={{ border, padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(grossAmount)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={2} style={{ border, padding: '5px 4px', fontWeight: '900' }}>({rows.length} Item{rows.length === 1 ? '' : 's'})</td>
            <td style={{ border, padding: '5px 4px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalGross)}</td>
            <td style={{ border, padding: '5px 4px' }} />
            <td style={{ border, padding: '5px 4px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalPure)}</td>
            <td style={{ border, padding: '5px 4px' }} />
            <td style={{ border, padding: '5px 4px' }} />
            <td style={{ border, padding: '5px 4px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '5px 4px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '5px 4px' }} />
            <td style={{ border, padding: '5px 4px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalVat)}</td>
            <td style={{ border, padding: '5px 4px', textAlign: 'right', fontWeight: '900' }}>{fmt(totalGrossAmount)}</td>
          </tr>
          {[
            [`${fixingLabel} @ ${metalRateLabel || '-'}`, totalGrossAmount],
            [`Total Amount Before VAT(${currencyLabel})`, totalGrossAmount - totalVat],
            [`Total VAT Amount(${currencyLabel})`, totalVat],
            [`Total Amount Including VAT(${currencyLabel})`, totalGrossAmount],
            [`Total Party Amount (${currencyLabel})`, totalGrossAmount],
          ].map(([label, amount]) => (
            <tr key={label}>
              <td colSpan={11} style={{ border, padding: '7px 6px', textAlign: 'right', fontWeight: '900', fontSize: '11px' }}>{label}</td>
              <td style={{ border, padding: '7px 6px', textAlign: 'right', fontWeight: '900' }}>{fmt(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ margin: '7px 0 4px 2px', fontStyle: 'italic' }}>Your account has been updated with :</div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', border, minHeight: '31px', alignItems: 'center' }}>
        <div style={{ borderRight: border, padding: '7px 5px', fontSize: '12px', fontWeight: '900' }}>{currencyLabel} {fmt(totals.grandTotal || totalGrossAmount)} {postingDirection}</div>
        <div style={{ padding: '7px 8px' }}>{amountWords}</div>
      </div>
      <div style={{ borderLeft: border, borderRight: border, borderBottom: border, padding: '6px 6px', minHeight: '29px' }}>
        Amount In Words ({currencyLabel}) : {String(amountWords || '').toUpperCase()}
      </div>

      <div style={{ marginTop: '8px', fontStyle: 'italic' }}>Confirmed for &amp; on behalf of</div>
      <div style={{ marginTop: '6px', fontSize: '14px', fontWeight: '900' }}>{partyName || partyLine || '-'}</div>

      <div style={{ marginTop: '42px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '98px', textAlign: 'center', fontSize: '11px', fontWeight: '900' }}>
        <div><div style={{ borderTop: border, paddingTop: '6px' }}>CUSTOMER'S SIGNATURE</div></div>
        <div><div style={{ borderTop: border, paddingTop: '6px' }}>CHECKED BY</div></div>
        <div><div style={{ borderTop: border, paddingTop: '6px' }}>AUTHORISED SIGNATORY</div></div>
      </div>
    </div>
  )
}
