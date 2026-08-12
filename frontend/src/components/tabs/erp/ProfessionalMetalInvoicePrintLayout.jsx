import { PROFESSIONAL_SHEET_STYLE } from '../voucher/professionalVoucherPrint'

const DEFAULT_METAL_SIGNATORIES = [
  { title: "CUSTOMER'S SIGNATURE" },
  { title: 'CHECKED BY' },
  { title: 'AUTHORISED SIGNATORY' },
]

function renderSignatories(signatories, border, columns = 3) {
  const visible = (Array.isArray(signatories) ? signatories : []).filter((item) => item.visible !== false)
  const items = visible.length ? visible : DEFAULT_METAL_SIGNATORIES
  return (
    <div
      className="voucher-print-signatures"
      style={{
        marginTop: '28px',
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: columns === 3 ? '98px' : '230px',
        textAlign: 'center',
        fontSize: '10px',
        fontWeight: '900',
      }}
    >
      {items.map((item, index) => (
        <div key={`${item.title}-${index}`}>
          {item.name ? <div style={{ fontSize: '11px', marginBottom: '28px' }}>{item.name}</div> : <div style={{ minHeight: '28px' }} />}
          <div style={{ borderTop: border, paddingTop: '5px' }}>{item.title}</div>
        </div>
      ))}
    </div>
  )
}

export default function ProfessionalMetalInvoicePrintLayout({
  companyName,
  companyAddress,
  logoImage,
  logoWidth = 136,
  logoHeight = 136,
  titleAccentColor = '#D99A12',
  invoiceTitle,
  copyLabel,
  partyName,
  partyCode,
  partyAddress,
  partyPhone,
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
  confirmedForLabel = 'Confirmed for & on behalf of',
  signatories,
  fmt,
}) {
  const rows = Array.isArray(lineItems) && lineItems.length ? lineItems : [{}]
  const border = '1px solid #111827'
  const gold = titleAccentColor || '#D99A12'
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
    paddingRight: 10,
  }
  const isPurchaseDoc = String(invoiceTitle || '').toUpperCase().startsWith('PURCHASE')
    || String(invoiceTitle || '').toUpperCase().includes('METAL RECEIPT')
  const docNoLabel = isPurchaseDoc ? 'PUR NO' : 'SAL NO'

  const stockDescription = (line) => {
    const code = String(line?.stockCode || '').trim()
    const product = String(line?.productType || line?.stockDescription || line?.metalName || line?.metalSymbol || '').trim()
    return [code, product].filter(Boolean).join(' - ') || partyLine || '-'
  }

  return (
    <div
      className="voucher-print-sheet"
      style={{
        ...PROFESSIONAL_SHEET_STYLE,
        padding: '10px 8px 6px',
        color: '#111111',
        fontFamily: 'Arial, sans-serif',
        fontSize: '9.5px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 154px', gap: '18px', alignItems: 'start', marginBottom: '8px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '900', lineHeight: 1.05, marginBottom: '3px' }}>{companyName}</div>
          <div style={{ fontSize: '12px', lineHeight: 1.25, whiteSpace: 'pre-line' }}>{companyAddress}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', minHeight: '104px', marginTop: '-4px' }}>
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

      <div style={{ position: 'relative', height: '28px', marginBottom: '7px' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: '13px', borderTop: `7px solid ${gold}` }} />
        <div style={{ position: 'relative', zIndex: 1, marginLeft: '70px', width: 'min(318px, calc(100% - 70px))', minHeight: '27px', borderTop: `2px solid ${gold}`, borderBottom: `2px solid ${gold}`, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: '900', whiteSpace: 'nowrap', padding: '0 8px' }}>
          {invoiceTitle}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(200px, 258px)', gap: '20px', alignItems: 'start', marginBottom: '6px' }}>
        <div style={{ border, borderRadius: '3px', minHeight: '86px', padding: '8px 8px 5px' }}>
          <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>{partyLine || '-'}</div>
          {partyAddress ? (
            <div style={{ fontSize: '11px', lineHeight: 1.25, whiteSpace: 'pre-wrap', marginBottom: '4px' }}>{partyAddress}</div>
          ) : null}
          {partyPhone ? (
            <div style={{ fontSize: '11px', marginBottom: '4px' }}>{`Tel: ${partyPhone}`}</div>
          ) : null}
          <div style={{ marginTop: '5px' }}>TRN {trnValue ? `- ${trnValue}` : '-'}</div>
        </div>

        <div>
          <div style={{ textAlign: 'right', color: '#7A7A7A', fontWeight: '900', fontSize: '13px', margin: '-14px 0 5px' }}>{copyLabel}</div>
          <div style={{ border, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {[
              [docNoLabel, docNoValue ? `${branch} - ${docNoValue}` : branch],
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

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '14px' }}>
        <colgroup>
          <col style={{ width: '28px' }} />
          <col style={{ width: '118px' }} />
          <col style={{ width: '64px' }} />
          <col style={{ width: '50px' }} />
          <col style={{ width: '60px' }} />
          <col style={{ width: '52px' }} />
          <col style={{ width: '52px' }} />
          <col style={{ width: '68px' }} />
          <col style={{ width: '76px' }} />
          <col style={{ width: '38px' }} />
          <col style={{ width: '60px' }} />
          <col style={{ width: '74px' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>No.</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>Stock Description</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>Gross Wt.</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>Purity</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>Pure Wt.</th>
            <th colSpan={2} style={{ border, padding: '8px 4px' }}>Making ({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>Metal<br />Amount</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>Net Amt (Excl VAT)<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>VAT<br />%</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>VAT Amt<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '8px 4px' }}>Gross Amt<br />(Incl VAT)<br />({currencyLabel})</th>
          </tr>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ border, padding: '8px 4px' }}>Rate</th>
            <th style={{ border, padding: '8px 4px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const metalAmount = Number(line?.metalAmount || line?.amountLC || 0)
            const netAmount = Number(line?.totalAmount || line?.amountLC || metalAmount)
            const vatAmount = Number(line?.vatAmountLC || line?.vatAmountFC || 0)
            const grossAmount = Number(line?.amountWithVAT || netAmount + vatAmount)
            return (
              <tr key={`pro-metal-print-${idx}`} style={{ minHeight: '48px' }}>
                <td style={{ border, padding: '8px 4px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top' }}>{stockDescription(line)}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{fmt(line?.grossWeight || 0)}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{line?.purity || ''}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{fmt(line?.pureWeight || 0)}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{line?.makingRate ? fmt(line.makingRate) : ''}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{line?.makingCharges ? fmt(line.makingCharges) : ''}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{fmt(metalAmount)}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{fmt(netAmount)}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{fmt(line?.vatPer || 0)}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{fmt(vatAmount)}</td>
                <td style={{ border, padding: '8px 4px', verticalAlign: 'top', ...numCell }}>{fmt(grossAmount)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={2} style={{ border, padding: '8px 4px', fontWeight: '900' }}>({rows.length} Item{rows.length === 1 ? '' : 's'})</td>
            <td style={{ border, padding: '8px 4px', fontWeight: '900', ...numCell }}>{fmt(totalGross)}</td>
            <td style={{ border, padding: '8px 4px' }} />
            <td style={{ border, padding: '8px 4px', fontWeight: '900', ...numCell }}>{fmt(totalPure)}</td>
            <td style={{ border, padding: '8px 4px' }} />
            <td style={{ border, padding: '8px 4px' }} />
            <td style={{ border, padding: '8px 4px', fontWeight: '900', ...numCell }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '8px 4px', fontWeight: '900', ...numCell }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '8px 4px' }} />
            <td style={{ border, padding: '8px 4px', fontWeight: '900', ...numCell }}>{fmt(totalVat)}</td>
            <td style={{ border, padding: '8px 4px', fontWeight: '900', ...numCell }}>{fmt(totalGrossAmount)}</td>
          </tr>
          {[
            [`${fixingLabel} @ ${metalRateLabel || '-'}`, totalGrossAmount],
            [`Total Amount Before VAT(${currencyLabel})`, totalGrossAmount - totalVat],
            [`Total VAT Amount(${currencyLabel})`, totalVat],
            [`Total Amount Including VAT(${currencyLabel})`, totalGrossAmount],
            [`Total Party Amount (${currencyLabel})`, totalGrossAmount],
          ].map(([label, amount]) => (
            <tr key={label}>
              <td colSpan={11} style={{ border, padding: '8px 6px', textAlign: 'right', fontWeight: '900', fontSize: '12px' }}>{label}</td>
              <td style={{ border, padding: '8px 6px', fontWeight: '900', ...numCell }}>{fmt(amount)}</td>
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

      <div style={{ marginTop: '6px', fontStyle: 'italic' }}>{confirmedForLabel}</div>
      <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: '900' }}>{partyName || partyLine || '-'}</div>

      {renderSignatories(signatories, border, 3)}
    </div>
  )
}
