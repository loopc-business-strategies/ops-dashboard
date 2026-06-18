import fs from 'node:fs'

const path = 'frontend/src/components/tabs/VoucherTab.jsx'
let text = fs.readFileSync(path, 'utf8')

const startMarker = '  const branding = user?.branding || {}'
const endMarker = '  // ────────────────────────────────────────────────────────────────────────────\n  // RENDER'

const start = text.indexOf(startMarker)
const end = text.indexOf(endMarker)
if (start < 0 || end < 0 || end <= start) {
  console.error('print block markers not found', start, end)
  process.exit(1)
}

const inventoryBlock = `  const inventoryStockOptions = inventoryProducts
    .filter((item) => String(item.sku || '').trim())
    // Keep mapped inventory records only, so legacy records do not show duplicate-like stock choices.
    .filter((item) => String(item.category || '').includes('mainStock='))
    .map((item) => {
      const meta = decodeInventoryCategoryMeta(item.category)
      const mainStock = toTitle(meta.mainStock || meta.metalType || 'Metal')
      return {
        code: String(item.sku || '').trim().toUpperCase(),
        metal: String(meta.mainStock || meta.metalType || 'zzzz').toLowerCase(),
        label: mainStock,
      }
    })
    .sort((a, b) => {
      const byMetal = a.metal.localeCompare(b.metal)
      if (byMetal !== 0) return byMetal
      return a.code.localeCompare(b.code)
    })

`

text = text.slice(0, start) + inventoryBlock + text.slice(end)

const printStart = text.indexOf('    <div className="voucher-print-only"')
const printEndMarker = '    </div>\n    </>\n  )'
const printEnd = text.indexOf(printEndMarker, printStart)
if (printStart < 0 || printEnd < 0) {
  console.error('print jsx markers not found', printStart, printEnd)
  process.exit(1)
}

text = `${text.slice(0, printStart)}    <VoucherPrintPanel printModel={printModel} />\n${text.slice(printEnd)}`

fs.writeFileSync(path, text)
console.log('Patched VoucherTab print extraction')
