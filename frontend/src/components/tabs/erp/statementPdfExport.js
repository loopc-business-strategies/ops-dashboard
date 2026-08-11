import { createLogoRenderAsset } from './ERPBrandingUtils'
import { loadPdfTools } from './lazyExportLibs'
import { ensurePdfUnicodeFonts, PDF_FALLBACK_FONT_FAMILY } from './pdfUnicodeFont'
import { buildStatementExportModel } from './statementExportModel'

const MARGIN = 24
const HEADER_BG = [232, 236, 241]
const INK = [17, 24, 39]
const MUTED = [55, 65, 81]

function drawWrappedText(doc, text, x, y, maxWidth, lineHeight = 11) {
  const lines = doc.splitTextToSize(String(text || ''), maxWidth)
  lines.forEach((line, index) => {
    doc.text(line, x, y + index * lineHeight)
  })
  return lines.length * lineHeight
}

/**
 * Download Statement of Account as a native landscape PDF (jsPDF + autoTable).
 * Avoids html2canvas, which mangles 2-row table headers and page-slices rows.
 */
export async function exportStatementPdf(ctx, fileName) {
  const model = buildStatementExportModel(ctx)
  if (!model) throw new Error('Statement data not ready for PDF export')

  const { jsPDF, autoTable } = await loadPdfTools()
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const fontFamily = await ensurePdfUnicodeFonts(doc) || PDF_FALLBACK_FONT_FAMILY
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN * 2

  let cursorY = MARGIN
  const logoPdfWidth = Math.min(model.logoWidth * 0.65, 110)
  const logoPdfHeight = Math.min(model.logoHeight * 0.65, 72)
  const logoAsset = await createLogoRenderAsset(
    model.logoUrl,
    model.logoWidth,
    model.logoHeight,
    model.logoFit,
    { renderScale: 2 },
  )

  if (model.useMasterStatementLayout) {
    doc.setFont(fontFamily, 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text(model.companyName, MARGIN, cursorY + 12)
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    let metaY = cursorY + 26
    if (model.companyAddress) {
      metaY += drawWrappedText(doc, model.companyAddress, MARGIN, metaY, 360, 10)
    }
    if (model.companyPhone || model.companyTrn) {
      const line = [
        model.companyPhone ? `Telephone: ${model.companyPhone}` : '',
        model.companyTrn ? `TRN: ${model.companyTrn}` : '',
      ].filter(Boolean).join(', ')
      doc.text(line, MARGIN, metaY + 2)
      metaY += 12
    }
    if (logoAsset && String(logoAsset).startsWith('data:image/')) {
      try {
        doc.addImage(
          logoAsset,
          'PNG',
          pageWidth - MARGIN - logoPdfWidth,
          cursorY,
          logoPdfWidth,
          logoPdfHeight,
          undefined,
          'FAST',
        )
      } catch {
        // continue without logo
      }
    }
    cursorY = Math.max(metaY, cursorY + logoPdfHeight) + 10
    doc.setFont(fontFamily, 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...INK)
    doc.text(model.title, pageWidth / 2, cursorY, { align: 'center' })
    cursorY += 14
    if (model.subtitle) {
      doc.setFont(fontFamily, 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...MUTED)
      doc.text(model.subtitle, pageWidth / 2, cursorY, { align: 'center' })
      cursorY += 12
    }
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text(`Doc Date From ${model.dateFromLabel} To ${model.dateToLabel}`, pageWidth / 2, cursorY, { align: 'center' })
    cursorY += 16
  } else {
    if (logoAsset && String(logoAsset).startsWith('data:image/')) {
      try {
        doc.addImage(logoAsset, 'PNG', MARGIN, cursorY, logoPdfWidth, logoPdfHeight, undefined, 'FAST')
      } catch {
        // continue without logo
      }
    }
    const textLeft = MARGIN + logoPdfWidth + 14
    doc.setFont(fontFamily, 'bold')
    doc.setFontSize(14)
    doc.setTextColor(...INK)
    doc.text(model.companyName, textLeft, cursorY + 14)
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    let metaY = cursorY + 28
    if (model.companyAddress) {
      metaY += drawWrappedText(doc, model.companyAddress, textLeft, metaY, 320, 10)
    }
    if (model.companyPhone || model.companyTrn) {
      const line = [
        model.companyPhone ? `Telephone: ${model.companyPhone}` : '',
        model.companyTrn ? `TRN: ${model.companyTrn}` : '',
      ].filter(Boolean).join(', ')
      doc.text(line, textLeft, metaY + 2)
      metaY += 12
    }
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text(model.title, pageWidth - MARGIN, cursorY + 18, { align: 'right' })
    doc.setFontSize(9)
    doc.text(
      `Doc Date From ${model.dateFromLabel} To ${model.dateToLabel}`,
      pageWidth - MARGIN,
      cursorY + 34,
      { align: 'right' },
    )
    cursorY = Math.max(metaY, cursorY + logoPdfHeight, cursorY + 44) + 10
  }

  doc.setDrawColor(55, 65, 81)
  doc.setLineWidth(1)
  doc.rect(MARGIN, cursorY, contentWidth, 48)
  doc.setFont(fontFamily, 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(String(model.accountCode || ''), MARGIN + 10, cursorY + 16)
  doc.setFont(fontFamily, 'bold')
  doc.setFontSize(10)
  doc.text(String(model.accountName || 'Account').toUpperCase(), MARGIN + 10, cursorY + 30)
  if (model.accountAddress) {
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(8)
    doc.text(model.accountAddress, MARGIN + 10, cursorY + 42)
  }
  cursorY += 58

  // Column widths sum to contentWidth (~794pt at 24pt margins on landscape A4).
  const colWidths = {
    0: 88, // Doc No
    1: 58, // Doc Date
    2: 200, // Narration
    3: 74, // Amt Debit
    4: 74, // Amt Credit
    5: 84, // Amt Balance
    6: 70, // Metal Debit
    7: 70, // Metal Credit
    8: 76, // Metal Balance
  }

  autoTable(doc, {
    head: model.head,
    body: model.body,
    startY: cursorY,
    tableWidth: contentWidth,
    showHead: 'everyPage',
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      overflow: 'linebreak',
      textColor: INK,
      lineColor: [55, 65, 81],
      lineWidth: 0.4,
      valign: 'middle',
      font: fontFamily,
    },
    headStyles: {
      fillColor: HEADER_BG,
      textColor: INK,
      fontStyle: 'bold',
      font: fontFamily,
      halign: 'center',
      valign: 'middle',
      fontSize: 7.5,
    },
    bodyStyles: { valign: 'top', font: fontFamily },
    columnStyles: {
      0: { cellWidth: colWidths[0], halign: 'left' },
      1: { cellWidth: colWidths[1], halign: 'center' },
      2: { cellWidth: colWidths[2], halign: 'left', overflow: 'linebreak' },
      3: { cellWidth: colWidths[3], halign: 'right' },
      4: { cellWidth: colWidths[4], halign: 'right' },
      5: { cellWidth: colWidths[5], halign: 'right' },
      6: { cellWidth: colWidths[6], halign: 'right' },
      7: { cellWidth: colWidths[7], halign: 'right' },
      8: { cellWidth: colWidths[8], halign: 'right' },
    },
    margin: { left: MARGIN, right: MARGIN, bottom: 36 },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      const label = String(data.row?.raw?.[2] || '')
      if (label === 'Balance B/F' || label === 'Balance C/F') {
        data.cell.styles.fontStyle = 'bold'
      }
    },
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages()
      const pageNo = data.pageNumber
      doc.setFont(fontFamily, 'italic')
      doc.setFontSize(8)
      doc.setTextColor(...INK)
      doc.text(
        `Printed By: ${model.printedByName} On ${new Date().toLocaleString()}`,
        MARGIN,
        pageHeight - 16,
      )
      doc.text(`Page ${pageNo} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 16, { align: 'right' })
    },
  })

  let afterTableY = (doc.lastAutoTable?.finalY || cursorY) + 16
  if (model.signatories?.length) {
    const colW = contentWidth / model.signatories.length
    model.signatories.forEach((item, index) => {
      const x = MARGIN + index * colW + colW / 2
      doc.setFont(fontFamily, 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...INK)
      if (item.name) doc.text(String(item.name), x, afterTableY, { align: 'center' })
      doc.setDrawColor(55, 65, 81)
      doc.line(x - 50, afterTableY + 28, x + 50, afterTableY + 28)
      doc.setFont(fontFamily, 'bold')
      doc.setFontSize(9)
      doc.text(String(item.title || ''), x, afterTableY + 40, { align: 'center' })
    })
    afterTableY += 52
  }
  if (model.footerNote) {
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(model.footerNote, MARGIN, afterTableY)
  }

  // Fix "Page X of Y" now that total page count is known.
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i)
    doc.setFont(fontFamily, 'italic')
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.setFillColor(255, 255, 255)
    doc.rect(pageWidth - MARGIN - 70, pageHeight - 28, 70, 16, 'F')
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - MARGIN, pageHeight - 16, { align: 'right' })
  }

  doc.save(fileName || `Statement-${model.accountCode || 'Account'}.pdf`)
  return model
}
