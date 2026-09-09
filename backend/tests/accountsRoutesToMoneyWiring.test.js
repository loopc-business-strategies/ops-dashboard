const fs = require('fs')
const path = require('path')

describe('accountsRoutes toMoney dependency wiring', () => {
  test('accountsRoutes destructures toMoney (not _toMoney) for enquiry/summary formatting', () => {
    const filePath = path.join(__dirname, '../routes/erp-accounting/accountsRoutes.js')
    const source = fs.readFileSync(filePath, 'utf8')
    expect(source).toMatch(/\btoMoney\b/)
    expect(source).not.toMatch(/\b_toMoney\b/)
  })

  test('erp-accountingContext injects toMoney into registerAccountsRoutes', () => {
    const filePath = path.join(__dirname, '../routes/erp-accountingContext.js')
    const source = fs.readFileSync(filePath, 'utf8')
    const registerBlock = source.slice(
      source.indexOf('registerAccountsRoutes({'),
      source.indexOf('registerLedgerRoutes({'),
    )
    expect(registerBlock).toMatch(/\btoMoney\b/)
    expect(registerBlock).not.toMatch(/\b_toMoney\b/)
  })
})
