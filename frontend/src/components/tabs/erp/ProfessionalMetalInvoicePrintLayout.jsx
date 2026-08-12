import { PROFESSIONAL_SHEET_STYLE, ProfessionalGoldTitleBar } from '../voucher/professionalVoucherPrint'

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
        gap: '24px',
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
        padding: '8px 6px 6px',
        color: '#111111',
        fontFamily: 'Arial, sans-serif',
        fontSize: '9px',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '270mm',
      }}
    >
      <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 148px', gap: '16px', alignItems: 'start', marginBottom: '6px' }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '900', lineHeight: 1.05, marginBottom: '3px' }}>{companyName}</div>
          <div style={{ fontSize: '12px', lineHeight: 1.25, whiteSpace: 'pre-line' }}>{companyAddress}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', minHeight: '96px' }}>
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

      <ProfessionalGoldTitleBar variant="metal" title={invoiceTitle} goldColor={gold} />

      <div className="voucher-pro-party-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(185px, 0.9fr)', gap: '14px', alignItems: 'start', marginBottom: '6px' }}>
        <div style={{ border, borderRadius: '3px', minHeight: '82px', padding: '7px 7px 5px' }}>
          <div style={{ fontSize: '12px', fontWeight: '900', marginBottom: '5px' }}>{partyLine || '-'}</div>
          {partyAddress ? (
            <div style={{ fontSize: '10px', lineHeight: 1.2, whiteSpace: 'pre-wrap', marginBottom: '3px' }}>{partyAddress}</div>
          ) : null}
          {partyPhone ? (
            <div style={{ fontSize: '10px', marginBottom: '3px' }}>{`Tel: ${partyPhone}`}</div>
          ) : null}
          <div style={{ marginTop: '4px', fontSize: '10px' }}>TRN {trnValue ? `- ${trnValue}` : '-'}</div>
        </div>

        <div>
          <div style={{ textAlign: 'right', color: '#7A7A7A', fontWeight: '900', fontSize: '12px', margin: '-10px 0 4px' }}>{copyLabel}</div>
          <div style={{ border, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            {[
              [docNoLabel, docNoValue ? `${branch} - ${docNoValue}` : branch],
              ['Date', dateValue],
              ['Payment Terms', paymentTerms],
              ['Salesman', salesman],
              ['Metal Rate', metalRateLabel],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '84px 1fr', minHeight: '17px', alignItems: 'center', borderBottom: label === 'Metal Rate' ? 0 : border, padding: '0 6px', fontSize: '10px' }}>
                <strong>{label}</strong>
                <span>: {value || ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ textAlign: 'right', fontStyle: 'italic', margin: '0 0 5px' }}>Page 1 of 1</div>

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '12px' }}>
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
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>No.</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>Stock Description</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>Gross Wt.</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>Purity</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>Pure Wt.</th>
            <th colSpan={2} style={{ border, padding: '6px 3px' }}>Making ({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>Metal<br />Amount</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>Net Amt<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>VAT<br />%</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>VAT Amt<br />({currencyLabel})</th>
            <th rowSpan={2} style={{ border, padding: '6px 3px' }}>Gross Amt<br />({currencyLabel})</th>
          </tr>
          <tr style={{ background: '#F3F4F6' }}>
            <th style={{ border, padding: '6px 3px' }}>Rate</th>
            <th style={{ border, padding: '6px 3px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((line, idx) => {
            const metalAmount = Number(line?.metalAmount || line?.amountLC || 0)
            const netAmount = Number(line?.totalAmount || line?.amountLC || metalAmount)
            const vatAmount = Number(line?.vatAmountLC || line?.vatAmountFC || 0)
            const grossAmount = Number(line?.amountWithVAT || netAmount + vatAmount)
            return (
              <tr key={`pro-metal-print-${idx}`} style={{ minHeight: '42px' }}>
                <td style={{ border, padding: '6px 3px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ border, padding: '6px 4px', verticalAlign: 'top', lineHeight: 1.2 }}>{stockDescription(line)}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{fmt(line?.grossWeight || 0)}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{line?.purity || ''}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{fmt(line?.pureWeight || 0)}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{line?.makingRate ? fmt(line.makingRate) : ''}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{line?.makingCharges ? fmt(line.makingCharges) : ''}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{fmt(metalAmount)}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{fmt(netAmount)}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{fmt(line?.vatPer || 0)}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{fmt(vatAmount)}</td>
                <td style={{ border, padding: '6px 3px', verticalAlign: 'top', ...numCell }}>{fmt(grossAmount)}</td>
              </tr>
            )
          })}
          <tr>
            <td colSpan={2} style={{ border, padding: '6px 4px', fontWeight: '900' }}>({rows.length} Item{rows.length === 1 ? '' : 's'})</td>
            <td style={{ border, padding: '6px 3px', fontWeight: '900', ...numCell }}>{fmt(totalGross)}</td>
            <td style={{ border, padding: '6px 3px' }} />
            <td style={{ border, padding: '6px 3px', fontWeight: '900', ...numCell }}>{fmt(totalPure)}</td>
            <td style={{ border, padding: '6px 3px' }} />
            <td style={{ border, padding: '6px 3px' }} />
            <td style={{ border, padding: '6px 3px', fontWeight: '900', ...numCell }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '6px 3px', fontWeight: '900', ...numCell }}>{fmt(totalMetal)}</td>
            <td style={{ border, padding: '6px 3px' }} />
            <td style={{ border, padding: '6px 3px', fontWeight: '900', ...numCell }}>{fmt(totalVat)}</td>
            <td style={{ border, padding: '6px 3px', fontWeight: '900', ...numCell }}>{fmt(totalGrossAmount)}</td>
          </tr>
          {[
            [`${fixingLabel} @ ${metalRateLabel || '-'}`, totalGrossAmount],
            [`Total Amount Before VAT(${currencyLabel})`, totalGrossAmount - totalVat],
            [`Total VAT Amount(${currencyLabel})`, totalVat],
            [`Total Amount Including VAT(${currencyLabel})`, totalGrossAmount],
            [`Total Party Amount (${currencyLabel})`, totalGrossAmount],
          ].map(([label, amount]) => (
            <tr key={label}>
              <td colSpan={11} style={{ border, padding: '6px 5px', textAlign: 'right', fontWeight: '900', fontSize: '11px', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{label}</td>
              <td style={{ border, padding: '6px 4px', fontWeight: '900', fontSize: '11px', ...numCell }}>{fmt(amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ margin: '5px 0 3px 2px', fontStyle: 'italic', fontSize: '10px' }}>Your account has been updated with :</div>
      <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', border, minHeight: '24px', alignItems: 'center' }}>
        <div style={{ borderRight: border, padding: '5px 5px', fontSize: '10px', fontWeight: '900' }}>{currencyLabel} {fmt(totals.grandTotal || totalGrossAmount)} {postingDirection}</div>
        <div style={{ padding: '5px 7px', fontSize: '10px', lineHeight: 1.2 }}>{amountWords}</div>
      </div>
      <div style={{ borderLeft: border, borderRight: border, borderBottom: border, padding: '4px 6px', minHeight: '22px', fontSize: '10px', lineHeight: 1.2 }}>
        Amount In Words ({currencyLabel}) : {String(amountWords || '').toUpperCase()}
      </div>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
        <div style={{ fontStyle: 'italic', fontSize: '10px' }}>{confirmedForLabel}</div>
        <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: '900' }}>{partyName || partyLine || '-'}</div>
        {renderSignatories(signatories, border, 3)}
      </div>
    </div>
  )
}
