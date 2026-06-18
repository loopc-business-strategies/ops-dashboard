import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const voucherTabPath = path.join(__dirname, '../src/components/tabs/VoucherTab.jsx')
const outPath = path.join(__dirname, '../src/components/tabs/voucher/VoucherEditorPanel.jsx')

const lines = fs.readFileSync(voucherTabPath, 'utf8').split(/\r?\n/)
const start = lines.findIndex((l) => l.includes('CREATE / VIEW MODE'))
const end = lines.findIndex((l, i) => i > start && l.trim() === ')}' && lines[i + 1]?.trim() === '</div>' && lines[i + 2]?.trim() === '' && lines[i + 3]?.includes('VoucherPrintPanel'))
if (start < 0 || end < 0) {
  console.error('editor block not found', start, end)
  process.exit(1)
}

const body = lines.slice(start, end + 1).join('\n')
const parentText = fs.readFileSync(voucherTabPath, 'utf8')

const parentBindings = new Set()
const bindingPatterns = [
  /\bconst\s+([A-Za-z_$][\w$]*)\s*=/g,
  /\blet\s+([A-Za-z_$][\w$]*)\s*=/g,
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g,
  /\bconst\s*\{\s*([^}]+)\}\s*=/g,
  /\bconst\s*\[([^\]]+)\]\s*=/g,
]
for (const pattern of bindingPatterns) {
  let m
  while ((m = pattern.exec(parentText)) !== null) {
    if (pattern.source.includes('{')) {
      m[1].split(',').forEach((part) => {
        const name = part.trim().split(':')[0].trim().split('=')[0].trim()
        if (/^[A-Za-z_$][\w$]*$/.test(name)) parentBindings.add(name)
      })
    } else if (pattern.source.includes('[')) {
      m[1].split(',').forEach((part) => {
        const name = part.trim().split(':')[0].trim()
        if (/^[A-Za-z_$][\w$]*$/.test(name)) parentBindings.add(name)
      })
    } else {
      parentBindings.add(m[1])
    }
  }
}

const idPattern = /\{([A-Za-z_$][\w$]*)\}/g
const used = new Set()
let match
while ((match = idPattern.exec(body)) !== null) {
  if (parentBindings.has(match[1])) used.add(match[1])
}
;['mode', 'setMode', 'header', 'setHdr', 'lineItems', 'lineForm', 'setLineForm', 'showLineForm', 'setShowLineForm',
  'editingLineIdx', 'setEditingLineIdx', 'saveLine', 'editLine', 'deleteLine', 'cancelLineForm', 'applyLineAutoCalc',
  'inventoryStockOptions', 'inventoryProducts', 'currencyOptions', 'baseCurrencyCode', 'getCurrencyRateByCode',
  'latestMetalRates', 'lineTableHeaders', 'isSimpleMetalVoucher', 'voucherType', 'voucherLabel', 'voucherCode',
  'totals', 'effectiveLineItems', 'receiptPaymentNetAmtLabelCurrency', 'isReceiptOrPaymentVoucher',
  'customers', 'vendors', 'accounts', 'partyOptions', 'metalPartyComboGroups', 'findPartyOptionByCode',
  'resolveVoucherParty', 'recentPartyVouchers', 'loadingRecentPartyVouchers', 'attachmentInputKey',
  'handleUploadVoucherAttachment', 'handleDeleteVoucherAttachment', 'handlePreviewVoucherAttachment',
  'workflowNote', 'setWorkflowNote', 'saving', 'editingId', 'modalDrag', 't', 'showAccountDetailsTab',
  'canManageWorkflow', 'isSuperAdmin', 'isFinance',
  'canCreate', 'canDeleteCurrentVoucher', 'canApproveWorkflow', 'canSubmitWorkflow', 'canReturnWorkflow',
  'canRejectWorkflow', 'canPostWorkflow', 'canRevalueCurrentVoucher', 'currentVoucher', 'currentVoucherStatus',
  'handleModalHeaderMouseDown', 'handleVoucherModalBackdropClick', 'openCreate', 'runToolbarAction', 'vouchers',
  'modalOffset', 'isMetalVoucher', 'menuTab', 'setMenuTab', 'applyProductTypeAutoFill', 'setLF', 'openAddLine',
  'voucherConfig', 'loadingInventoryProducts', 'handleAmountFC', 'handleAmountLC', 'handleCurrRateChange',
  'handleDeleteLineClick', 'handleEditLineClick', 'handleHeaderCurrRateChange', 'handleHeaderCurrencyChange',
  'handleLineCurrencyChange', 'handleLineTypeChange', 'handleStockSelection', 'handleRevalueFxJournal',
  'handleWorkflowAction', 'handlePartySelect', 'handleBarcodeAction', 'handleCancelChanges', 'handleDeleteVoucher',
  'handleEditUnlock', 'handleExitVoucherForm', 'handleSearchFind', 'handleAddLineClick', 'handleLineAmountEnter',
  'handlePartyCodeEnter', 'handleUploadVoucherAttachments', 'lineAccountComboGroups', 'partyComboGroups',
  'partyAddress', 'partyCardTitle', 'partyDisplayName', 'partyEmail', 'partyPhone', 'searchPartyByCode',
  'currentAttachments', 'formReadOnly', 'isReadOnly', 'voucherLabelT', 'refreshParties', 'navFirst', 'navLast',
  'navNext', 'navPrev', 'saveVoucher',
].forEach((name) => {
  if (body.includes(name)) used.add(name)
})

const propNames = [...used].sort()
const header = `import AccountCombobox from '../../AccountCombobox'
import VoucherAttachmentsPanel from '../erp/VoucherAttachmentsPanel'
import {
  S, btn, fmt, inputStyle, labelStyle, tabBtn, sectionBox, sectionHeader, sectionBody,
  classicHeaderShell, classicHeaderGrid, classicPanel, classicPanelTitle, classicPartyGrid,
  classicPartyCard, classicPartyCardHeader, classicPartyCardTitle, classicPartyCardCodeWrap,
  classicPartyCardCode, classicPartyCardCodeInput, classicPartyCardSearch, classicPartyCardName,
  classicPartyCardBody, classicPartyCardField, classicPartyCardFieldLabel, classicPartyCardFieldValue,
  classicRightGrid, classicLabel, classicInput, classicReadInput, metalWin, metalTopInlineRow,
  metalTopField, emptyLine, normalizeLineType, normalizeVoucherFixingType, normalizeRateType,
  backendRateToDisplayRate, displayRateToBackendRate, FIXED_AED_RATE, formatPartyAddress,
  isMetalStockVoucherType, isMetalTransferVoucherType, hasMetalTransferLineQuantity,
} from './voucherTabShared'

export default function VoucherEditorPanel({
${propNames.map((p) => `  ${p},`).join('\n')}
}) {
  return (
${body}
  )
}
`

fs.writeFileSync(outPath, header)
fs.writeFileSync(path.join(__dirname, 'voucher-editor-props.json'), JSON.stringify(propNames, null, 2))
console.log(`Wrote VoucherEditorPanel lines ${start + 1}-${end + 1} with ${propNames.length} props`)
