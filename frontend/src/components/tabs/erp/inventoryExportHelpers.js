/**
 * Inventory Items report export builders (XLSX / PDF).
 * Categories appear once as section headers; products list under each.
 */

function formatQty(value, digits = 3) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits })
}

function resolveCategoryLabel(group) {
  return group.metalLabel || String(group.metal || '').toLowerCase() || 'unmapped'
}

export function buildInventoryExportPayload(categoryGroups = []) {
  const groups = Array.isArray(categoryGroups) ? categoryGroups : []
  if (!groups.length) return null

  const stamp = new Date().toISOString().slice(0, 10)
  const rows = [
    ['Inventory Report'],
    ['Generated', new Date().toLocaleString()],
    ['Grouped by metal category'],
    [],
    ['Item', 'PCS', 'Gross Qty', 'Purity', 'Pure Qty'],
  ]

  let itemCount = 0
  const pdfBody = []

  groups.forEach((group) => {
    const category = resolveCategoryLabel(group)

    // Excel: category as a section header row
    rows.push([category, '', '', '', ''])
    // PDF: full-width category banner
    pdfBody.push([{
      content: category,
      colSpan: 5,
      styles: {
        fillColor: [255, 247, 237],
        textColor: [17, 24, 39],
        fontStyle: 'bold',
        fontSize: 9,
      },
    }])

    ;(group.products || []).forEach((product) => {
      itemCount += 1
      const pcs = product.pcs == null ? '' : product.pcs
      const purity = product.purity === '' || product.purity == null ? '' : String(product.purity)
      rows.push([
        `  ${product.name || '—'}`,
        pcs,
        Number(product.grossQty || 0),
        purity,
        Number(product.pureQty || 0),
      ])
      pdfBody.push([
        product.name || '—',
        product.pcs == null ? '—' : String(product.pcs),
        formatQty(product.grossQty),
        product.purity === '' || product.purity == null ? '—' : String(product.purity),
        formatQty(product.pureQty),
      ])
    })

    rows.push([
      '  TOTAL',
      Number(group.totalPcs || 0),
      Number(group.totalGross || 0),
      group.totalPurity == null ? '' : Number(group.totalPurity),
      Number(group.totalPure || 0),
    ])
    rows.push([])

    pdfBody.push([
      {
        content: 'TOTAL',
        styles: { fontStyle: 'bold', fillColor: [248, 250, 252] },
      },
      {
        content: String(Number(group.totalPcs || 0)),
        styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' },
      },
      {
        content: formatQty(group.totalGross),
        styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' },
      },
      {
        content: group.totalPurity == null ? '—' : formatQty(group.totalPurity, 6),
        styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' },
      },
      {
        content: formatQty(group.totalPure),
        styles: { fontStyle: 'bold', fillColor: [248, 250, 252], halign: 'right' },
      },
    ])
  })

  return {
    rows,
    fileBase: `inventory-report-${stamp}`,
    sheetName: 'Inventory',
    itemCount,
    pdfBody,
  }
}

export async function exportInventoryPdf(categoryGroups = []) {
  const payload = buildInventoryExportPayload(categoryGroups)
  if (!payload) return null
  const { loadPdfTools } = await import('./lazyExportLibs')
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Inventory Report', 36, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Generated: ${new Date().toLocaleString()}  ·  ${payload.itemCount} item${payload.itemCount === 1 ? '' : 's'}`, 36, 54)
  autoTable(doc, {
    head: [['Item', 'PCS', 'Gross Qty', 'Purity', 'Pure Qty']],
    body: payload.pdfBody,
    startY: 72,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [146, 64, 14] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
    margin: { left: 24, right: 24 },
  })
  doc.save(`${payload.fileBase}.pdf`)
  return payload
}

function formatMovementChange(value) {
  const n = Number(value || 0)
  const formatted = formatQty(n, 6)
  if (n > 0) return `+${formatted}`
  return formatted
}

function formatMovementDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString()
}

/**
 * Stock Movement History export — category + product section headers,
 * then Date / Change / Before / After / Reason / By rows.
 */
export function buildStockMovementExportPayload(categoryGroups = []) {
  const groups = Array.isArray(categoryGroups) ? categoryGroups : []
  if (!groups.length) return null

  const stamp = new Date().toISOString().slice(0, 10)
  const rows = [
    ['Stock Movement History'],
    ['Generated', new Date().toLocaleString()],
    ['Grouped by metal category'],
    [],
    ['Date', 'Change', 'Before', 'After', 'Reason (Voucher)', 'By'],
  ]

  let movementCount = 0
  const pdfBody = []

  groups.forEach((group) => {
    const category = resolveCategoryLabel(group)

    rows.push([category, '', '', '', '', ''])
    pdfBody.push([{
      content: category,
      colSpan: 6,
      styles: {
        fillColor: [255, 247, 237],
        textColor: [17, 24, 39],
        fontStyle: 'bold',
        fontSize: 9,
      },
    }])

    ;(group.products || []).forEach((product) => {
      const productName = product.name || '—'
      rows.push([`  ${productName}`, '', '', '', '', ''])
      pdfBody.push([{
        content: productName,
        colSpan: 6,
        styles: {
          fillColor: [248, 250, 252],
          textColor: [17, 24, 39],
          fontStyle: 'bold',
          fontSize: 8,
        },
      }])

      ;(product.movements || []).forEach((m) => {
        movementCount += 1
        const date = formatMovementDate(m.createdAt)
        const change = formatMovementChange(m.change)
        const before = formatQty(m.quantityBefore, 6)
        const after = formatQty(m.quantityAfter, 6)
        const reason = m.reason || '—'
        const by = m.actorName || '—'
        rows.push([`    ${date}`, change, Number(m.quantityBefore || 0), Number(m.quantityAfter || 0), reason, by])
        pdfBody.push([date, change, before, after, reason, by])
      })
    })

    rows.push([])
  })

  return {
    rows,
    fileBase: `stock-movement-history-${stamp}`,
    sheetName: 'Movements',
    movementCount,
    pdfBody,
  }
}

export async function exportStockMovementPdf(categoryGroups = []) {
  const payload = buildStockMovementExportPayload(categoryGroups)
  if (!payload) return null
  const { loadPdfTools } = await import('./lazyExportLibs')
  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Stock Movement History', 36, 36)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(
    `Generated: ${new Date().toLocaleString()}  ·  ${payload.movementCount} entr${payload.movementCount === 1 ? 'y' : 'ies'}`,
    36,
    54,
  )
  autoTable(doc, {
    head: [['Date', 'Change', 'Before', 'After', 'Reason (Voucher)', 'By']],
    body: payload.pdfBody,
    startY: 72,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [146, 64, 14] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    margin: { left: 24, right: 24 },
  })
  doc.save(`${payload.fileBase}.pdf`)
  return payload
}
