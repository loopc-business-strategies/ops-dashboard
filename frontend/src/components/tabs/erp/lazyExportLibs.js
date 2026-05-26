export const loadExcel = async () => {
  const mod = await import('exceljs')
  return mod.default || mod
}

export const loadPdfTools = async () => {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  return { jsPDF, autoTable: autoTableMod.default || autoTableMod }
}

export const loadHtmlToPdf = async () => {
  const mod = await import('html2pdf.js')
  return mod.default || mod
}
