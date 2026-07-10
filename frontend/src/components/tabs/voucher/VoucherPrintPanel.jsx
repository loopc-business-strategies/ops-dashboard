import DocumentPrintHeader from '../erp/DocumentPrintHeader'
import MGMetalInvoicePrintLayout from '../erp/MGMetalInvoicePrintLayout'
import MGVoucherPrintLayout from '../erp/MGVoucherPrintLayout'
import { useDocumentPrintLogo } from './useDocumentPrintLogo'
import {
  VOUCHER_BORDER,
  VOUCHER_CELL_PADDING,
  VOUCHER_COL_AMOUNT,
  VOUCHER_COL_NO,
  VOUCHER_COL_TYPE,
  VOUCHER_HEADER_ROW_STYLE,
  VOUCHER_NUMERIC_CELL_STYLE,
  VOUCHER_TABLE_BASE_STYLE,
  VOUCHER_TH_TD_BASE,
  getVoucherSheetStyle,
} from './voucherPrintStyles'

const thStyle = (extra = {}) => ({ ...VOUCHER_TH_TD_BASE, ...extra })
const tdStyle = (extra = {}) => ({ ...VOUCHER_TH_TD_BASE, ...extra })
const numTdStyle = { ...tdStyle(), ...VOUCHER_NUMERIC_CELL_STYLE }

export default function VoucherPrintPanel({ printModel, renderMode = 'print' }) {
  const {
    isMgCurrencyVoucher,
    isMgMetalVoucher,
    mgCompanyName,
    mgCompanyAddress,
    documentBranding,
    phoneValue,
    mgLogoImage,
    mgPrintTitle,
    mgAccountDescription,
    trnValue,
    payNoValue,
    mgBranch,
    payDateValue,
    preparedByValue,
    printAmountLabel,
    currencyLabel,
    mgLineItems,
    mgPrimaryLine,
    totals,
    mgAmountWords,
    voucher,
    mgPartyPrintAddress,
    mgPartyPrintPhone,
    normalizeLineType,
    fmt,
    mgMetalInvoiceTitle,
    mgMetalCopyLabel,
    mgPartyAccountName,
    mgPartyAccountCode,
    mgFixingDisplay,
    mgMetalRateLabel,
    mgMetalPostingDirection,
    printTitle,
    printMeta,
    isMetalVoucher,
    effectiveLineItems,
    accountNameByCode,
    voucherType,
    printPostingDirection,
    numberToWords,
    lineItems,
    voucherPrint,
    voucherPrintSettings,
  } = printModel

  const useCustomVoucherLayout = voucherPrintSettings?.enabled === true
  const tableHeaders = voucherPrint?.tableHeaders || {}
  const visibleSignatories = (voucherPrint?.signatories || []).filter((item) => item.visible !== false)
  const confirmedForLabel = voucherPrint?.confirmedForLabel || 'Confirmed for & on behalf of'
  const footerNote = voucherPrint?.footerNote || ''
  const headerNoLabel = tableHeaders.no || 'No.'
  const headerDescriptionLabel = tableHeaders.description || (isMetalVoucher ? 'Stock / Account Description' : 'Account Description')
  const headerTypeLabel = tableHeaders.type || (isMetalVoucher ? 'Metal' : 'Type')
  const headerAmountFcLabel = tableHeaders.amountFc || (isMetalVoucher ? 'Pure Wt.' : 'Amount FC')
  const headerAmountLcLabel = tableHeaders.amountLc || (isMetalVoucher ? 'Total' : printAmountLabel)

  const isPreview = renderMode === 'preview'
  const isMgLayout = isMgCurrencyVoucher || isMgMetalVoucher
  const rootClassName = isPreview ? 'voucher-preview-panel' : 'voucher-print-only'
  const sheetStyle = getVoucherSheetStyle(isPreview)
  const rootStyle = {
    ...sheetStyle,
    ...(isMgLayout ? { minWidth: undefined, padding: '0 10px' } : {}),
  }

  const mgLogoWidth = Number(documentBranding?.logoWidth || 136)
  const mgLogoHeight = Number(documentBranding?.logoHeight || 136)
  const mgLogoSrc = useDocumentPrintLogo(
    mgLogoImage,
    mgLogoWidth,
    mgLogoHeight,
    documentBranding?.logoFit || 'contain',
    isPreview,
  )

  const lineTableStyle = { ...VOUCHER_TABLE_BASE_STYLE, marginBottom: '8px' }

  return (
    <div className={rootClassName} style={rootStyle}>
      {isMgCurrencyVoucher ? (
        <MGVoucherPrintLayout
          companyName={mgCompanyName}
          companyAddress={mgCompanyAddress}
          documentEmail={documentBranding?.email}
          phoneValue={phoneValue}
          logoImage={mgLogoSrc}
          printTitle={mgPrintTitle}
          accountDescription={mgAccountDescription}
          trnValue={trnValue}
          docNoValue={payNoValue}
          branch={mgBranch}
          dateValue={payDateValue}
          preparedByValue={preparedByValue}
          amountLabel={printAmountLabel}
          currencyLabel={currencyLabel}
          lineItems={mgLineItems}
          primaryLine={mgPrimaryLine}
          totals={totals}
          amountWords={mgAmountWords}
          partyName={voucher?.partyName}
          partyAddress={mgPartyPrintAddress}
          partyPhone={mgPartyPrintPhone}
          normalizeLineType={normalizeLineType}
          fmt={fmt}
        />
      ) : isMgMetalVoucher ? (
        <MGMetalInvoicePrintLayout
          companyName={mgCompanyName}
          companyAddress={mgCompanyAddress}
          logoImage={mgLogoSrc}
          invoiceTitle={mgMetalInvoiceTitle}
          copyLabel={mgMetalCopyLabel}
          partyName={mgPartyAccountName}
          partyCode={mgPartyAccountCode}
          trnValue={trnValue}
          docNoValue={payNoValue}
          branch={mgBranch}
          dateValue={payDateValue}
          paymentTerms={printModel.header?.paymentTerms || ''}
          salesman={preparedByValue}
          fixingLabel={mgFixingDisplay}
          metalRateLabel={mgMetalRateLabel}
          currencyLabel={currencyLabel || 'USD'}
          lineItems={mgLineItems}
          totals={totals}
          amountWords={mgAmountWords}
          postingDirection={mgMetalPostingDirection}
          fmt={fmt}
        />
      ) : (
      <>
      <DocumentPrintHeader
        branding={documentBranding}
        title={printTitle}
        meta={printMeta}
        layoutSettings={useCustomVoucherLayout ? voucherPrint : null}
        screenPreview={isPreview}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '12px', marginBottom: '10px' }}>
        <div style={{ border: '1px dashed #6B7280', padding: '8px' }}>
          <div>{voucher?.partyAccount || ''}</div>
          <div style={{ marginTop: '6px' }} />
          <div style={{ textAlign: 'center' }}>{trnValue ? `TRN - ${trnValue}` : ''}</div>
        </div>
        <div style={{ border: '1px dashed #6B7280', padding: '8px' }}>
          <div><strong>PAY NO</strong> : {payNoValue || ''}</div>
          <div><strong>Date</strong> : {payDateValue || ''}</div>
          <div><strong>Prepared By</strong> : {preparedByValue || ''}</div>
        </div>
      </div>

      {voucherType === 'payment' ? (
        <table style={lineTableStyle}>
          <thead>
            <tr style={VOUCHER_HEADER_ROW_STYLE}>
              <th style={thStyle({ width: VOUCHER_COL_NO })}>{headerNoLabel}</th>
              <th style={thStyle()}>{headerDescriptionLabel}</th>
              <th style={thStyle({ width: VOUCHER_COL_TYPE })}>{headerTypeLabel}</th>
              <th style={thStyle({ width: VOUCHER_COL_AMOUNT, ...VOUCHER_NUMERIC_CELL_STYLE })}>{headerAmountFcLabel}</th>
              <th style={thStyle({ width: VOUCHER_COL_AMOUNT, ...VOUCHER_NUMERIC_CELL_STYLE })}>{headerAmountLcLabel}</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).map((line, idx) => {
              const accountCode = line?.acCode || ''
              const paymentType = normalizeLineType(line?.type) || ''
              return (
                <tr key={`print-line-${idx}`}>
                  <td style={tdStyle({ textAlign: 'center' })}>{idx + 1}</td>
                  <td style={tdStyle()}>
                    <div>{accountCode || ''}</div>
                    <div style={{ fontSize: '11px', color: '#555' }}>
                      {paymentType || ''}
                    </div>
                  </td>
                  <td style={tdStyle()}>{paymentType || ''}</td>
                  <td style={numTdStyle}>{fmt(line?.amountFC || 0)}</td>
                  <td style={numTdStyle}>{fmt(line?.amountLC || 0)}</td>
                </tr>
              )
            })}
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).length === 0 && (
              <tr>
                <td colSpan={5} style={tdStyle({ textAlign: 'center' })}>No line items</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <table style={lineTableStyle}>
          <thead>
            <tr style={VOUCHER_HEADER_ROW_STYLE}>
              <th style={thStyle({ width: VOUCHER_COL_NO })}>{headerNoLabel}</th>
              <th style={thStyle()}>{headerDescriptionLabel}</th>
              <th style={thStyle({ width: VOUCHER_COL_TYPE })}>{headerTypeLabel}</th>
              <th style={thStyle({ width: VOUCHER_COL_AMOUNT, ...VOUCHER_NUMERIC_CELL_STYLE })}>{headerAmountFcLabel}</th>
              <th style={thStyle({ width: VOUCHER_COL_AMOUNT, ...VOUCHER_NUMERIC_CELL_STYLE })}>{useCustomVoucherLayout ? headerAmountLcLabel : `Amount (${currencyLabel || 'USD'})`}</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).map((line, idx) => {
              const accountCode = line?.acCode || ''
              const accountName = accountNameByCode(accountCode)
              const paymentType = normalizeLineType(line?.type) || ''
              const customerAccountNo = line?.partyAccount || voucher?.partyAccount || ''
              const metalLabel = line?.metalSymbol || line?.metalName || line?.productType || ''
              const lineTotal = Number(line?.totalAmount || line?.amountWithVAT || line?.amountLC || line?.amountFC || 0)
              return (
                <tr key={`print-line-${idx}`}>
                  <td style={tdStyle({ textAlign: 'center' })}>{idx + 1}</td>
                  <td style={tdStyle()}>
                    {isMetalVoucher ? (
                      <>
                        <div>{`${line?.stockCode || accountCode || ''}${line?.productType ? ` - ${line.productType}` : accountName ? ` - ${accountName}` : ''}`}</div>
                        <div style={{ fontSize: '11px', color: '#555' }}>{line?.remarks || line?.narration || customerAccountNo || ''}</div>
                      </>
                    ) : (
                      <>
                        <div>{`${accountCode || ''}${accountName ? ` - ${accountName}` : ''}`}</div>
                        <div>{customerAccountNo || ''}</div>
                        <div>{paymentType || ''}</div>
                      </>
                    )}
                  </td>
                  <td style={tdStyle()}>{isMetalVoucher ? metalLabel : paymentType}</td>
                  <td style={numTdStyle}>{isMetalVoucher ? fmt(line?.pureWeight || 0) : fmt(line?.amountFC || 0)}</td>
                  <td style={numTdStyle}>{fmt(isMetalVoucher ? lineTotal : line?.amountLC || 0)}</td>
                </tr>
              )
            })}
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).length === 0 && (
              <tr>
                <td colSpan={5} style={tdStyle({ textAlign: 'center' })}>No line items</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <table style={{ ...VOUCHER_TABLE_BASE_STYLE, marginBottom: '8px' }}>
        <tbody>
          <tr>
            <td style={tdStyle({ textAlign: 'right', fontWeight: '700' })}>{`Total (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...numTdStyle, width: VOUCHER_COL_AMOUNT, fontWeight: '700' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td style={tdStyle({ textAlign: 'right', fontWeight: '700' })}>{`Total Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...numTdStyle, fontWeight: '700' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td style={tdStyle({ textAlign: 'right', fontWeight: '700' })}>{`Total Party Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ ...numTdStyle, fontWeight: '700' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{
        border: VOUCHER_BORDER,
        padding: VOUCHER_CELL_PADDING,
        fontSize: '12px',
        lineHeight: '1.75',
        marginTop: '4px',
      }}
      >
        <div style={{ marginBottom: '3px', color: '#555', fontSize: '11px' }}>
          Your account has been updated with :
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap',
        }}
        >
          <div style={{ fontWeight: '700', fontSize: '12px', color: '#111827', flexShrink: 0 }}>
            {currencyLabel || 'USD'} {fmt(totals.grandTotal || 0)} {printPostingDirection}
          </div>
          <div style={{
            fontStyle: 'italic',
            fontSize: '11px',
            color: '#333333',
            flex: 1,
            textAlign: 'right',
          }}
          >
            {totals.grandTotal > 0
              ? `${numberToWords(totals.grandTotal)} ${currencyLabel || 'USD'} Only`
              : ''}
          </div>
        </div>
      </div>

      <div style={{
        border: VOUCHER_BORDER,
        padding: VOUCHER_CELL_PADDING,
        fontSize: '11px',
        color: '#151111',
        minHeight: '22px',
      }}
      >
        {lineItems?.[0]?.narration || ''}
      </div>

      <div style={{ marginTop: '10px', fontSize: '12px' }}>{confirmedForLabel}</div>
      {voucherType === 'payment' ? (
        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '20px' }}>
          <div style={{ fontWeight: '600', fontSize: '12px', color: '#111' }}>
            {voucher?.partyName || ''}
          </div>
          <div style={{ fontWeight: '600', fontSize: '12px', color: '#111' }}>
            {voucher?.partyAccount || ''}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', gap: '12px', minHeight: '20px' }}>
          <div>{voucher?.partyName || ''}</div>
          <div>{voucher?.partyAccount || ''}</div>
        </div>
      )}

      <div style={{ marginTop: '88px', display: 'grid', gridTemplateColumns: `repeat(${Math.max(visibleSignatories.length, 1)}, 1fr)`, gap: '36px', textAlign: 'center', fontWeight: '700' }}>
        {(visibleSignatories.length ? visibleSignatories : [{ title: "RECEIVER'S SIGNATURE" }, { title: 'CHECKED BY' }, { title: 'AUTHORISED SIGNATORY' }]).map((item, index) => (
          <div key={`${item.title}-${index}`}>
            {item.name ? <div style={{ fontSize: '11px', marginBottom: '28px' }}>{item.name}</div> : <div style={{ minHeight: '28px' }} />}
            <div style={{ borderTop: VOUCHER_BORDER, paddingTop: '4px' }}>{item.title}</div>
          </div>
        ))}
      </div>

      {footerNote ? (
        <div style={{ marginTop: '12px', fontSize: '11px', color: '#555555' }}>{footerNote}</div>
      ) : null}
      </>
      )}
    </div>
  )
}
