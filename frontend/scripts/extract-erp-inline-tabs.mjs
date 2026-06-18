import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const erpTabPath = path.join(__dirname, '../src/components/tabs/ERPTab.jsx')
const outDir = path.join(__dirname, '../src/components/tabs/erp/tabs')
const lines = fs.readFileSync(erpTabPath, 'utf8').split(/\r?\n/)

function sliceInner(startLine, endLine) {
  return lines.slice(startLine - 1, endLine).join('\n')
}

const tabs = [
  {
    file: 'ERPCustomersTab.jsx',
    start: 5251,
    end: 5335,
    imports: '',
    wrapper: null,
  },
  {
    file: 'ERPCustomerMarginTab.jsx',
    start: 5339,
    end: 5473,
    imports: `import {
  formatCustomerMarginAmount,
  formatCustomerMarginEquity,
  formatCustomerMarginExcessShort,
  formatCustomerMarginPercent,
  formatCustomerMarginPosition,
} from '../marginFormatters'\n`,
    wrapper: null,
  },
  {
    file: 'ERPSupplierMarginTab.jsx',
    start: 5477,
    end: 5611,
    imports: `import {
  formatCustomerMarginAmount,
  formatCustomerMarginEquity,
  formatCustomerMarginExcessShort,
  formatCustomerMarginPercent,
  formatCustomerMarginPosition,
} from '../marginFormatters'\n`,
    wrapper: null,
  },
  {
    file: 'ERPMappingsTab.jsx',
    start: 5705,
    end: 5877,
    imports: '',
    wrapper: null,
  },
  {
    file: 'ERPEnquiryTab.jsx',
    start: 5881,
    end: 6007,
    imports: `import { ERPEnquiryTabContainer } from '../ERPTabContainers'\n`,
    wrapper: { open: '<ERPEnquiryTabContainer activeTab={activeTab}>', close: '</ERPEnquiryTabContainer>' },
  },
  {
    file: 'ERPSettingsTab.jsx',
    start: 6236,
    end: 6559,
    imports: '',
    wrapper: null,
  },
  {
    file: 'ERPCurrenciesTab.jsx',
    start: 6563,
    end: 6765,
    imports: '',
    wrapper: null,
  },
]

for (const tab of tabs) {
  let body = sliceInner(tab.start, tab.end)
  if (tab.wrapper) {
    body = `${tab.wrapper.open}\n${body}\n${tab.wrapper.close}`
  }
  const content = `${tab.imports}export default function ${tab.file.replace('.jsx', '')}(props) {
  const p = props
  return (
${body.split('\n').map((line) => (line ? `    ${line}` : '')).join('\n')}
  )
}
`
  fs.writeFileSync(path.join(outDir, tab.file), content, 'utf8')
  console.log('Wrote', tab.file)
}
