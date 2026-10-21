import VoucherPrintNetAmounts from '../voucher/VoucherPrintNetAmounts'

const cellBase = {
  border: '1px solid #111827',
  padding: '5px 3px',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
}

export default function MGMetalInvoicePrintLayout({
  companyName,
  companyAddress,
  logoImage,
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
  netAmountRows = [],
}) {
  const rows = Array.isArray(lineItems) && lineItems.length ? lineItems : [{}]
  const border = '1px solid #111827'
  const gold = '#D99A12'
  const logoSize = 126
  const totalGross = rows.reduce((sum, line) => sum + Number(line?.grossWeight || 0), 0)
  const totalPure = rows.reduce((sum, line) => sum + Number(line?.pureWeight || 0), 0)
  const totalMetal = rows.reduce((sum, line) => sum + Number(line?.metalAmount || line?.amountLC || 0), 0)
  const totalVat = rows.reduce((sum, line) => sum + Number(line?.vatAmountLC || line?.vatAmountFC || 0), 0)
  const totalGrossAmount = rows.reduce((sum, line) => sum + Number(line?.amountWithVAT || line?.totalAmount || line?.amountLC || line?.metalAmount || 0), 0)
  const partyLine = `${partyName || ''}${partyCode ? ` ${partyCode}` : ''}`.trim()
  const numCell = {
    textAlign: 'right',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    paddingRight: 8,
  }

  const stockDescription = (line) => {
    const code = String(line?.stockCode || '').trim()
    const product = String(line?.productType || line?.stockDescription || line?.metalName || line?.metalSymbol || '').trim()
    return [code, product].filter(Boolean).join(' - ') || partyLine || '-'
  }

  return (
    <div
      className="voucher-print-sheet"
      style={{
        maxWidth: '735px',
        margin: '0 auto',
        padding: '14px 14px 12px',
        color: '#111111',
        fontFamily: 'Arial, sans-serif',
        fontSize: '9.5px',
        fontWeight: '500',
        lineHeight: 1.3,
        pageBreakInside: 'avoid',
        overflow: 'visible',
        colorAdjust: 'exact',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontSize: '16px', fontWeight: '700', lineHeight: 1.2, marginBottom: '4px', overflowWrap: 'anywhere' }}>{companyName}</div>
          <div style={{ fontSize: '11px', lineHeight: 1.4, fontWeight: '600', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{companyAddress}</div>
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

      <div style={{ position: 'relative', height: '30px', marginBottom: '7px' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '14px', borderTop: `7px solid ${gold}` }} />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: '14px',
            zIndex: 1,
            width: 'min(318px, 100%)',
            maxWidth: '92%',
            minHeight: '28px',
            borderTop: `2px solid ${gold}`,
            borderBottom: `2px solid ${gold}`,
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
          {invoiceTitle}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(200px, 0.95fr)', gap: '12px', alignItems: 'stretch', marginBottom: '8px' }}>
        <div style={{ border, borderRadius: '3px', minHeight: '82px', padding: '7px 8px 6px', overflow: 'visible' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '700', marginBottom: '4px', overflowWrap: 'anywhere' }}>{partyLine || '-'}</div>
          <div style={{ borderTop: border, height: '15px' }} />
          <div style={{ borderTop: border, height: '17px' }} />
          <div style={{ marginTop: '5px', fontSize: '10px', fontWeight: '600' }}>TRN {trnValue ? `- ${trnValue}` : '-'}</div>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ textAlign: 'right', color: '#4B5563', fontWeight: '700', fontSize: '11px', margin: '0 0 4px', letterSpacing: '0.02em' }}>{copyLabel}</div>
          <div style={{ border, overflow: 'visible' }}>
            {[
              [String(invoiceTitle || '').startsWith('PURCHASE') ? 'PUR NO' : 'SAL NO', docNoValue ? `${branch} - ${docNoValue}` : branch],
              ['Date', dateValue],
              ['Payment Terms', paymentTerms],
              ['Salesman', salesman],
              ['Metal Rate', metalRateLabel],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '92px minmax(0, 1fr)',
                  minHeight: '20px',
                  alignItems: 'center',
                  borderBottom: label === 'Metal Rate' ? 0 : border,
                  padding: '2px 6px',
                  fontSize: '10px',
                  lineHeight: 1.25,
                }}
              >
                <span style={{ fontWeight: '700' }}>{label}</span>
                <span style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>: {value || ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', fontStyle: 'italic', fontWeight: '500', fontSize: '10px', color: '#374151', margin: '0 0 5px' }}>Page 1 of 1</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '9.5px' }}>
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '11%' }} />
          <col style={{ width: '6%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '8%' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700', textAlign: 'center' }}>No.</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>Stock Description</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>Gross Wt.</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>Purity</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>Pure Wt.</th>
            <th colSpan={2} style={{ ...cellBase, fontWeight: '700', textAlign: 'center' }}>Making ({currencyLabel})</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>Metal<br />Amount</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>Net Amt (Excl VAT)<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>VAT<br />%</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>VAT Amt<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ ...cellBase, fontWeight: '700' }}>Gross Amt<br />(Incl VAT)<br />({currencyLabel})</th>
          </tr>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ ...cellBase, fontWeight: '700' }}>Rate</th>
            <th style={{ ...cellBase, fontWeight: '700' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const metalAmount = Number(line?.metalAmount || line?.amountLC || 0)
            const netAmount = Number(line?.totalAmount || line?.amountLC || metalAmount)
            const vatAmount = Number(line?.vatAmountLC || line?.vatAmountFC || 0)
            const grossAmount = Number(line?.amountWithVAT || netAmount + vatAmount)
            return (
              <tr key={`mg-metal-print-${idx}`}>
                <td style={{ ...cellBase, textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ ...cellBase, padding: '5px 4px', lineHeight: 1.25, fontWeight: '600' }}>{stockDescription(line)}</td>
                <td style={{ ...cellBase, ...numCell }}>{fmt(line?.grossWeight || 0)}</td>
                <td style={{ ...cellBase, ...numCell }}>{line?.purity || ''}</td>
                <td style={{ ...cellBase, ...numCell }}>{fmt(line?.pureWeight || 0)}</td>
                <td style={{ ...cellBase, ...numCell }}>{line?.makingRate ? fmt(line.makingRate) : ''}</td>
                <td style={{ ...cellBase, ...numCell }}>{line?.makingCharges ? fmt(line.makingCharges) : ''}</td>
                <td style={{ ...cellBase, ...numCell }}>{fmt(metalAmount)}</td>
                <td style={{ ...cellBase, ...numCell }}>{fmt(netAmount)}</td>
                <td style={{ ...cellBase, ...numCell }}>{fmt(line?.vatPer || 0)}</td>
                <td style={{ ...cellBase, ...numCell }}>{fmt(vatAmount)}</td>
                <td style={{ ...cellBase, ...numCell }}>{fmt(grossAmount)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={2} style={{ ...cellBase, fontWeight: '700' }}>({rows.length} Item{rows.length === 1 ? '' : 's'})</td>
            <td style={{ ...cellBase, fontWeight: '700', ...numCell }}>{fmt(totalGross)}</td>
            <td style={cellBase} />
            <td style={{ ...cellBase, fontWeight: '700', ...numCell }}>{fmt(totalPure)}</td>
            <td style={cellBase} />
            <td style={cellBase} />
            <td style={{ ...cellBase, fontWeight: '700', ...numCell }}>{fmt(totalMetal)}</td>
            <td style={{ ...cellBase, fontWeight: '700', ...numCell }}>{fmt(totalMetal)}</td>
            <td style={cellBase} />
            <td style={{ ...cellBase, fontWeight: '700', ...numCell }}>{fmt(totalVat)}</td>
            <td style={{ ...cellBase, fontWeight: '700', ...numCell }}>{fmt(totalGrossAmount)}</td>
          </tr>
          {[
            [`${fixingLabel} @ ${metalRateLabel || '-'}`, totalGrossAmount],
            [`Total Amount Before VAT(${currencyLabel})`, totalGrossAmount - totalVat],
            [`Total VAT Amount(${currencyLabel})`, totalVat],
            [`Total Amount Including VAT(${currencyLabel})`, totalGrossAmount],
            [`Total Party Amount (${currencyLabel})`, totalGrossAmount],
          ].map(([label, amount]) => (
            <tr key={label}>
              <td colSpan={11} style={{ ...cellBase, textAlign: 'right', fontWeight: '700', fontSize: '10px', lineHeight: 1.25, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{label}</td>
              <td style={{ ...cellBase, fontWeight: '700', fontSize: '10px', ...numCell }}>{fmt(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: '6px' }}>
        <VoucherPrintNetAmounts rows={netAmountRows} fmt={fmt} border={border} fontSize="10px" />
      </div>
      <div style={{ margin: '5px 0 3px 2px', fontStyle: 'italic', fontSize: '10px', fontWeight: '500' }}>Your account has been updated with :</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, max-content) minmax(0, 1fr)', border, minHeight: '24px', alignItems: 'center', overflow: 'visible' }}>
        <div style={{ borderRight: border, padding: '5px 6px', fontSize: '10px', fontWeight: '700', whiteSpace: 'nowrap' }}>
          {currencyLabel} {fmt(totals.grandTotal || totalGrossAmount)} {postingDirection}
        </div>
        <div style={{ padding: '5px 7px', fontSize: '10px', lineHeight: 1.25, fontWeight: '500', overflowWrap: 'anywhere' }}>{amountWords}</div>
      </div>
      <div style={{ borderLeft: border, borderRight: border, borderBottom: border, padding: '4px 6px', minHeight: '22px', fontSize: '10px', lineHeight: 1.25, fontWeight: '500', overflowWrap: 'anywhere' }}>
        Amount In Words ({currencyLabel}) : {String(amountWords || '').toUpperCase()}
      </div>

      <div style={{ marginTop: '8px', fontStyle: 'italic', fontSize: '10px', fontWeight: '500' }}>Confirmed for &amp; on behalf of</div>
      <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '700', overflowWrap: 'anywhere' }}>{partyName || partyLine || '-'}</div>

      <div className="voucher-print-signatures" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px', textAlign: 'center', fontSize: '9px', fontWeight: '700' }}>
        <div><div style={{ borderTop: border, paddingTop: '5px' }}>{"CUSTOMER'S SIGNATURE"}</div></div>
        <div><div style={{ borderTop: border, paddingTop: '5px' }}>CHECKED BY</div></div>
        <div><div style={{ borderTop: border, paddingTop: '5px' }}>AUTHORISED SIGNATORY</div></div>
      </div>
    </div>
  )
}
