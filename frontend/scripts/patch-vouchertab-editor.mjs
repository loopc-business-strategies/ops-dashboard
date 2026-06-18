import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const voucherTabPath = path.join(__dirname, '../src/components/tabs/VoucherTab.jsx')
const propsPath = path.join(__dirname, 'voucher-editor-props.json')

const propNames = JSON.parse(fs.readFileSync(propsPath, 'utf8'))
let lines = fs.readFileSync(voucherTabPath, 'utf8').split(/\r?\n/)

const start = lines.findIndex((l) => l.includes('CREATE / VIEW MODE'))
const end = lines.findIndex((l, i) => i > start && l.trim() === ')}' && lines[i + 1]?.trim() === '</div>' && lines[i + 2]?.trim() === '' && lines[i + 3]?.includes('VoucherPrintPanel'))
if (start < 0 || end < 0) {
  console.error('editor block not found', start, end)
  process.exit(1)
}

const replacement = [
  '      <VoucherEditorPanel',
  ...propNames.map((p) => `        ${p}={${p}}`),
  '      />',
]

lines.splice(start, end - start + 1, ...replacement)

let text = lines.join('\n')
if (!text.includes("import VoucherEditorPanel from './voucher/VoucherEditorPanel'")) {
  text = text.replace(
    "import VoucherPrintPanel from './voucher/VoucherPrintPanel'",
    "import VoucherPrintPanel from './voucher/VoucherPrintPanel'\nimport VoucherEditorPanel from './voucher/VoucherEditorPanel'",
  )
}

fs.writeFileSync(voucherTabPath, text)
console.log('Patched VoucherTab editor panel')
