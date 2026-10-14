const SECTION_DEFS = [
  {
    title: 'ASSETS',
    type: 'asset',
    groups: [
      ['CASH BALANCES', (row) => /cash/i.test(row.accountName || '') && !/bank/i.test(row.accountName || '')],
      ['BANK BALANCES', (row) => /bank/i.test(row.accountName || '')],
      ['TRADE DEBTOR', (row) => /\(debtor\)|\bdebtor\b/i.test(row.accountName || '')],
      ['OTHER ASSETS', () => true],
    ],
  },
  {
    title: 'LIABILITIES',
    type: 'liability',
    groups: [
      ['TRADE CREDITOR', (row) => /\(creditor\)|\bcreditor\b/i.test(row.accountName || '')],
      ['OTHER LIABILITIES', () => true],
    ],
  },
  {
    title: 'FUNDS EMPLOYED',
    type: 'equity',
    groups: [['EQUITY', () => true]],
  },
  {
    title: 'INCOME',
    type: 'income',
    groups: [['INCOME', () => true]],
  },
  {
    title: 'EXPENSES',
    type: 'expense',
    groups: [['EXPENSES', () => true]],
  },
]

function blankTotals() {
  return { balanceDebit: 0, balanceCredit: 0, amountDebit: 0, amountCredit: 0, net: 0 }
}

function addRow(total, row, convert) {
  const debit = Number(row?.debit || 0)
  const credit = Number(row?.credit || 0)
  const net = Number(row?.net || 0)
  total.balanceDebit += debit
  total.balanceCredit += credit
  total.amountDebit += Number(convert(debit) || 0)
  total.amountCredit += Number(convert(credit) || 0)
  total.net += Number(convert(net) || 0)
}

export function formatTrialMoneyCell(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return ''
  return Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function netCells(net) {
  const amount = Number(net || 0)
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.005) return ['', '']
  return amount >= 0
    ? [formatTrialMoneyCell(amount), '']
    : ['', formatTrialMoneyCell(amount)]
}

function accountCells(row, convert, division) {
  const net = Number(convert(row?.net || 0) || 0)
  return [
    row.accountName || '',
    row.accountCode || '',
    division,
    formatTrialMoneyCell(row.debit),
    formatTrialMoneyCell(row.credit),
    formatTrialMoneyCell(convert(row.debit || 0)),
    formatTrialMoneyCell(convert(row.credit || 0)),
    ...netCells(net),
  ]
}

function blankRow(label) {
  return [label, '', '', '', '', '', '', '', '']
}

function compareCode(left, right) {
  return String(left.accountCode || '').localeCompare(String(right.accountCode || ''), undefined, { numeric: true })
}

export function formatTrialRange(period = {}) {
  const format = (value) => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return String(value || '')
    return `${match[3]}/${match[2]}/${match[1]}`
  }
  if (!period.startDate) return ''
  return `From ${format(period.startDate)} To ${format(period.endDate || period.startDate)}`
}

export function buildCurrencyTrialBalanceModel({
  rows = [],
  convert = (value) => Number(value || 0),
  baseCurrency = 'USD',
  displayCurrency = 'USD',
} = {}) {
  const division = String(baseCurrency || 'USD').toUpperCase()
  const currency = String(displayCurrency || division).toUpperCase()
  const remaining = (rows || []).filter((row) => !row?.unposted).map((row) => ({ ...row }))
  const unposted = (rows || []).filter((row) => row?.unposted)
  const body = []
  const kinds = []
  const grand = blankTotals()

  const push = (cells, kind) => {
    body.push(cells)
    kinds.push(kind)
  }

  const takeGroup = (list, match) => {
    const picked = []
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (!match(list[index])) continue
      picked.push(list[index])
      list.splice(index, 1)
    }
    return picked.sort(compareCode)
  }

  const writeGroup = (title, accounts, showHeading) => {
    if (!accounts.length) return blankTotals()
    if (showHeading) push(blankRow(title), 'group')
    const subtotal = blankTotals()
    accounts.forEach((row) => {
      addRow(subtotal, row, convert)
      addRow(grand, row, convert)
      push(accountCells(row, convert, division), 'account')
    })
    push([
      `Sub Total - ${title}`,
      '',
      '',
      '',
      '',
      '',
      '',
      ...netCells(subtotal.net),
    ], 'subtotal')
    return subtotal
  }

  SECTION_DEFS.forEach((section) => {
    const pool = remaining.filter((row) => String(row.accountType || '').toLowerCase() === section.type)
    pool.forEach((row) => {
      const index = remaining.indexOf(row)
      if (index >= 0) remaining.splice(index, 1)
    })
    if (section.type === 'asset' && unposted.length) pool.push(...unposted)
    if (!pool.length) return
    push(blankRow(section.title), 'section')
    const singleNamedGroup = section.groups.length === 1 && section.groups[0][0] === section.title
    section.groups.forEach(([title, match]) => {
      writeGroup(title, takeGroup(pool, match), !singleNamedGroup)
    })
    if (pool.length) writeGroup(section.title, pool.sort(compareCode), false)
  })

  if (remaining.length) {
    push(blankRow('OTHER'), 'section')
    writeGroup('OTHER', remaining.sort(compareCode), false)
  }

  push([
    'Gross Total',
    '',
    '',
    '',
    '',
    formatTrialMoneyCell(grand.amountDebit),
    formatTrialMoneyCell(grand.amountCredit),
    formatTrialMoneyCell(grand.amountDebit),
    formatTrialMoneyCell(grand.amountCredit),
  ], 'total')

  return {
    title: 'CURRENCY TRIAL BALANCE (TILL DATE)',
    displayCurrency: currency,
    division,
    head: [[
      'Account Head',
      'Code',
      'Division',
      'Balance Debit',
      'Balance Credit',
      `Amount (${currency}) Debit`,
      `Amount (${currency}) Credit`,
      `Net (${currency}) Debit`,
      `Net (${currency}) Credit`,
    ]],
    pdfHead: [
      [
        { content: 'Account Head', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Code', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Division', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Balance', colSpan: 2, styles: { halign: 'center' } },
        { content: `Amount (${currency})`, colSpan: 2, styles: { halign: 'center' } },
        { content: `Net (${currency})`, colSpan: 2, styles: { halign: 'center' } },
      ],
      ['Debit', 'Credit', 'Debit', 'Credit', 'Debit', 'Credit'],
    ],
    body,
    kinds,
  }
}

const EXPENSE_GROUPS = [
  ['RENT', (row) => /rent/i.test(row.accountName || '')],
  ['FINANCIAL EXPENSES', (row) => /bank charge|exchange|interest|financ/i.test(row.accountName || '')],
  ['SELLING EXPENSES', (row) => /commission|selling/i.test(row.accountName || '')],
  ['ADMINISTRATIVE EXPENSES', () => true],
]

function creditLine(label, code, division, bookAmount, shownAmount) {
  const book = formatTrialMoneyCell(bookAmount)
  const shown = formatTrialMoneyCell(shownAmount)
  return [label, code, division, '', book, '', shown, '', shown]
}

function debitLine(label, code, division, bookAmount, shownAmount) {
  const book = formatTrialMoneyCell(bookAmount)
  const shown = formatTrialMoneyCell(shownAmount)
  return [label, code, division, book, '', shown, '', shown, '']
}

export function buildCurrencyProfitLossModel({
  income = [],
  expenses = [],
  convert = (value) => Number(value || 0),
  baseCurrency = 'USD',
  displayCurrency = 'USD',
} = {}) {
  const division = String(baseCurrency || 'USD').toUpperCase()
  const currency = String(displayCurrency || division).toUpperCase()
  const body = []
  const kinds = []
  const push = (cells, kind) => {
    body.push(cells)
    kinds.push(kind)
  }
  const take = (list, match) => {
    const picked = []
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (!match(list[index])) continue
      picked.push(list[index])
      list.splice(index, 1)
    }
    return picked.sort(compareCode)
  }
  const shown = (amount) => Number(convert(amount || 0) || 0)

  push(blankRow('INCOME'), 'section')
  let incomeBook = 0
  let incomeShown = 0
  ;(income || []).slice().sort(compareCode).forEach((row) => {
    const amount = Number(row.amount || 0)
    incomeBook += amount
    incomeShown += shown(amount)
    push(creditLine(row.accountName || '', row.accountCode || '', division, amount, shown(amount)), 'account')
  })
  push(['Sub Total - INCOME', '', '', '', '', '', '', '', formatTrialMoneyCell(incomeShown)], 'subtotal')

  push(blankRow('EXPENSES'), 'section')
  const pool = (expenses || []).map((row) => ({ ...row }))
  let expenseBook = 0
  let expenseShown = 0
  EXPENSE_GROUPS.forEach(([title, match]) => {
    const accounts = take(pool, match)
    if (!accounts.length) return
    push(blankRow(title), 'group')
    let groupShown = 0
    accounts.forEach((row) => {
      const amount = Number(row.amount || 0)
      expenseBook += amount
      const converted = shown(amount)
      expenseShown += converted
      groupShown += converted
      push(debitLine(row.accountName || '', row.accountCode || '', division, amount, converted), 'account')
    })
    push([`Sub Total - ${title}`, '', '', '', '', '', '', formatTrialMoneyCell(groupShown), ''], 'subtotal')
  })
  push(['Sub Total - EXPENSES', '', '', '', '', '', '', formatTrialMoneyCell(expenseShown), ''], 'subtotal')

  const profit = incomeShown - expenseShown
  if (profit >= 0) {
    push(['Net Profit', '', '', '', '', '', formatTrialMoneyCell(profit), '', formatTrialMoneyCell(profit)], 'result')
  } else {
    push(['Net Loss', '', '', '', '', formatTrialMoneyCell(profit), '', formatTrialMoneyCell(profit), ''], 'result')
  }
  const gross = Math.max(incomeShown, expenseShown)
  push([
    'Gross Total',
    '',
    '',
    '',
    '',
    formatTrialMoneyCell(gross),
    formatTrialMoneyCell(gross),
    formatTrialMoneyCell(gross),
    formatTrialMoneyCell(gross),
  ], 'total')

  return {
    title: 'CURRENCY PROFIT & LOSS',
    displayCurrency: currency,
    division,
    head: [[
      'Account Head',
      'Code',
      'Division',
      'Balance Debit',
      'Balance Credit',
      `Amount (${currency}) Debit`,
      `Amount (${currency}) Credit`,
      `Net (${currency}) Debit`,
      `Net (${currency}) Credit`,
    ]],
    pdfHead: [
      [
        { content: 'Account Head', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Code', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Division', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Balance', colSpan: 2, styles: { halign: 'center' } },
        { content: `Amount (${currency})`, colSpan: 2, styles: { halign: 'center' } },
        { content: `Net (${currency})`, colSpan: 2, styles: { halign: 'center' } },
      ],
      ['Debit', 'Credit', 'Debit', 'Credit', 'Debit', 'Credit'],
    ],
    body,
    kinds,
    incomeBook,
    expenseBook,
  }
}

function currencyStatementHead(currency) {
  return {
    head: [[
      'Account Head',
      'Code',
      'Division',
      'Balance Debit',
      'Balance Credit',
      `Amount (${currency}) Debit`,
      `Amount (${currency}) Credit`,
      `Net (${currency}) Debit`,
      `Net (${currency}) Credit`,
    ]],
    pdfHead: [
      [
        { content: 'Account Head', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Code', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Division', rowSpan: 2, styles: { valign: 'middle' } },
        { content: 'Balance', colSpan: 2, styles: { halign: 'center' } },
        { content: `Amount (${currency})`, colSpan: 2, styles: { halign: 'center' } },
        { content: `Net (${currency})`, colSpan: 2, styles: { halign: 'center' } },
      ],
      ['Debit', 'Credit', 'Debit', 'Credit', 'Debit', 'Credit'],
    ],
  }
}

function sheetIsCurrent(row) {
  if (typeof row?.isCurrent === 'boolean') return row.isCurrent
  return /(cash|bank|receivable|debtor|customer|inventory|stock|payable|creditor|tax|accrual|short)/i.test(`${row?.accountCode || ''} ${row?.accountName || ''}`)
}

function emptySheetTotals() {
  return { signed: 0, amountDebit: 0, amountCredit: 0 }
}

function addSheetTotals(left, right) {
  return {
    signed: left.signed + right.signed,
    amountDebit: left.amountDebit + right.amountDebit,
    amountCredit: left.amountCredit + right.amountCredit,
  }
}

export function buildCurrencyBalanceSheetModel({
  assets = [],
  liabilities = [],
  equity = [],
  convert = (value) => Number(value || 0),
  baseCurrency = 'USD',
  displayCurrency = 'USD',
} = {}) {
  const division = String(baseCurrency || 'USD').toUpperCase()
  const currency = String(displayCurrency || division).toUpperCase()
  const body = []
  const kinds = []
  const push = (cells, kind) => {
    body.push(cells)
    kinds.push(kind)
  }
  const take = (list, match) => {
    const picked = []
    for (let index = list.length - 1; index >= 0; index -= 1) {
      if (!match(list[index])) continue
      picked.push(list[index])
      list.splice(index, 1)
    }
    return picked.sort(compareCode)
  }
  const shownOf = (amount) => Math.abs(Number(convert(Math.abs(Number(amount || 0))) || 0))
  const grand = emptySheetTotals()

  const writeAccounts = (rows) => {
    const totals = emptySheetTotals()
    rows.forEach((row) => {
      const book = Math.abs(Number(row.balance || 0))
      const shown = shownOf(book)
      const credit = String(row.direction || 'Dr').toLowerCase().startsWith('c')
      totals.signed += credit ? -shown : shown
      if (credit) totals.amountCredit += shown
      else totals.amountDebit += shown
      push(credit
        ? creditLine(row.accountName || '', row.accountCode || '', division, book, shown)
        : debitLine(row.accountName || '', row.accountCode || '', division, book, shown), 'account')
    })
    grand.amountDebit += totals.amountDebit
    grand.amountCredit += totals.amountCredit
    return totals
  }

  const writeGroup = (title, rows) => {
    if (!rows.length) return emptySheetTotals()
    push(blankRow(title), 'group')
    const totals = writeAccounts(rows)
    push([`Sub Total - ${title}`, '', '', '', '', '', '', ...netCells(totals.signed)], 'subtotal')
    return totals
  }

  const assetPool = (assets || []).map((row) => ({ ...row }))
  const liabilityPool = (liabilities || []).map((row) => ({ ...row }))
  const equityPool = (equity || []).map((row) => ({ ...row })).sort(compareCode)

  const cash = take(assetPool, (row) => /cash/i.test(row.accountName || '') && !/bank/i.test(row.accountName || ''))
  const bank = take(assetPool, (row) => /bank/i.test(row.accountName || ''))
  const debtors = take(assetPool, (row) => /\(debtor\)|\bdebtor\b/i.test(row.accountName || ''))
  const otherCurrentAssets = take(assetPool, (row) => sheetIsCurrent(row))
  const fixedAssets = assetPool.sort(compareCode)

  const vat = take(liabilityPool, (row) => /\bvat\b|\btax\b/i.test(row.accountName || ''))
  const creditors = take(liabilityPool, (row) => /\(creditor\)|\bcreditor\b/i.test(row.accountName || ''))
  const otherCurrentLiabilities = take(liabilityPool, (row) => sheetIsCurrent(row))
  const longTermLiabilities = liabilityPool.sort(compareCode)

  const hasCurrentAssets = cash.length || bank.length || debtors.length || otherCurrentAssets.length
  const hasCurrentLiabilities = vat.length || creditors.length || otherCurrentLiabilities.length

  push(blankRow('ASSETS'), 'section')
  if (hasCurrentAssets || hasCurrentLiabilities) push(blankRow('NET CURRENT ASSETS'), 'group')
  if (hasCurrentAssets) push(blankRow('CURRENT ASSETS'), 'group')

  let currentAssets = emptySheetTotals()
  if (cash.length || bank.length) {
    push(blankRow('CASH & BANK BALANCES'), 'group')
    currentAssets = addSheetTotals(currentAssets, writeGroup('CASH BALANCES', cash))
    if (bank.length) {
      push(blankRow('BANK BALANCES'), 'group')
      push(blankRow('CURRENT ACCOUNTS'), 'group')
      const bankTotals = writeAccounts(bank)
      currentAssets = addSheetTotals(currentAssets, bankTotals)
      push(['Sub Total - BANK BALANCES', '', '', '', '', '', '', ...netCells(bankTotals.signed)], 'subtotal')
    }
    push(['Sub Total - CASH & BANK BALANCES', '', '', '', '', '', '', ...netCells(currentAssets.signed)], 'subtotal')
  }
  currentAssets = addSheetTotals(currentAssets, writeGroup('TRADE DEBTOR', debtors))
  currentAssets = addSheetTotals(currentAssets, writeGroup('OTHER CURRENT ASSETS', otherCurrentAssets))
  if (hasCurrentAssets) {
    push(['Sub Total - CURRENT ASSETS', '', '', '', '', '', '', ...netCells(currentAssets.signed)], 'subtotal')
  }

  if (hasCurrentLiabilities) push(blankRow('CURRENT LIABILITIES'), 'section')
  let currentLiabilities = emptySheetTotals()
  currentLiabilities = addSheetTotals(currentLiabilities, writeGroup('VAT ACCOUNTS', vat))
  currentLiabilities = addSheetTotals(currentLiabilities, writeGroup('TRADE CREDITOR', creditors))
  currentLiabilities = addSheetTotals(currentLiabilities, writeGroup('OTHER CURRENT LIABILITIES', otherCurrentLiabilities))
  if (hasCurrentLiabilities) {
    push(['Sub Total - CURRENT LIABILITIES', '', '', '', '', '', '', ...netCells(currentLiabilities.signed)], 'subtotal')
  }

  const netCurrent = addSheetTotals(currentAssets, currentLiabilities)
  if (hasCurrentAssets || hasCurrentLiabilities) {
    push(['NET CURRENT ASSETS', '', '', '', '', '', '', ...netCells(netCurrent.signed)], 'result')
  }

  const fixed = writeGroup('FIXED ASSETS', fixedAssets)
  const totalNetAssets = addSheetTotals(netCurrent, fixed)
  push(['TOTAL NET ASSETS', '', '', '', '', '', '', ...netCells(totalNetAssets.signed)], 'result')

  const longTerm = writeGroup('LONG TERM LIABILITIES', longTermLiabilities)
  push(blankRow('EQUITY'), 'section')
  const equityTotals = equityPool.length ? writeAccounts(equityPool) : emptySheetTotals()
  if (equityPool.length) {
    push(['Sub Total - EQUITY', '', '', '', '', '', '', ...netCells(equityTotals.signed)], 'subtotal')
  }
  const funds = addSheetTotals(longTerm, equityTotals)
  push(['Sub Total - FUNDS EMPLOYED', '', '', '', '', '', '', ...netCells(funds.signed)], 'subtotal')

  push([
    'Gross Total',
    '',
    '',
    '',
    '',
    formatTrialMoneyCell(grand.amountDebit),
    formatTrialMoneyCell(grand.amountCredit),
    formatTrialMoneyCell(grand.amountDebit),
    formatTrialMoneyCell(grand.amountCredit),
  ], 'total')

  return {
    title: 'CURRENCY BALANCE SHEET',
    displayCurrency: currency,
    division,
    ...currencyStatementHead(currency),
    body,
    kinds,
  }
}
