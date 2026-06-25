import { describe, expect, test } from 'vitest'
import {
  buildJvDocNo,
  buildJvPrintHtml,
  allocateJvLedgerEntries,
  convertJvAmountBetweenCurrencies,
  createJvHeader,
  emptyJvLine,
  normalizeJvCurrencyCode,
  resolveJvModeMeta,
  groupJvLedgerEntries,
  isManualJvLedgerEntry,
  isSystemFxAdjustmentLedgerEntry,
  validateJvLines,
  reconstructJvEditLines,
  extractJvPostingLineDescription,
} from './journalVoucherHelpers'

describe('journal voucher helpers', () => {
  test('creates stable empty JV line state', () => {
    expect(emptyJvLine(7)).toEqual({
      id: 7,
      accountId: '',
      accountInput: '',
      description: '',
      debit: '',
      credit: '',
    })
  })

  test('resolves unknown JV modes to normal journal metadata', () => {
    expect(resolveJvModeMeta('unknown')).toMatchObject({
      prefix: 'Jv',
      referenceType: 'journal',
    })
  })

  test('builds the next document number from formatted and legacy ledger descriptions', () => {
    const ledger = [
      { referenceType: 'journal', description: 'Jv/2026/0002 — opening entry' },
      { referenceType: 'journal', description: 'Jv-3 — legacy entry' },
      { referenceType: 'bank_jv', description: 'BnkJV/2026/0009 — bank entry' },
      { referenceType: 'journal', description: 'Jv/2025/0099 — previous year' },
    ]

    expect(buildJvDocNo(ledger, 'journal', new Date('2026-05-18T00:00:00.000Z'))).toBe('Jv/2026/0004')
    expect(buildJvDocNo(ledger, 'bank_jv', new Date('2026-05-18T00:00:00.000Z'))).toBe('BnkJV/2026/0010')
  })

  test('excludes system FX adjustment rows from manual JV numbering and grouping', () => {
    const fxRow = {
      referenceType: 'journal',
      description: 'Exchange loss adjustment for transaction 507f1f77bcf86cd799439011',
      referenceId: '507f1f77bcf86cd799439011',
      amount: 12,
      exchangeRate: 1,
      debitAccountId: { accountCode: '5190' },
      creditAccountId: { accountCode: '1100' },
    }
    expect(isSystemFxAdjustmentLedgerEntry(fxRow)).toBe(true)
    expect(isManualJvLedgerEntry(fxRow)).toBe(false)

    const ledger = [
      { referenceType: 'journal', description: 'Jv/2026/0002 — opening entry' },
      fxRow,
    ]
    expect(buildJvDocNo(ledger, 'journal', new Date('2026-05-18T00:00:00.000Z'))).toBe('Jv/2026/0003')

    const grouped = groupJvLedgerEntries([fxRow], { baseCurrencyCode: 'USD' })
    expect(grouped).toHaveLength(1)
    expect(grouped[0].voucherNo).toBe('—')

    const manualOnly = [fxRow, {
      referenceType: 'journal',
      description: 'Jv/2026/0001 — real jv',
      amount: 50,
      exchangeRate: 1,
      debitAccountId: { accountCode: '1100' },
      creditAccountId: { accountCode: '2100' },
    }]
    expect(groupJvLedgerEntries(manualOnly.filter(isManualJvLedgerEntry), { baseCurrencyCode: 'USD' })).toHaveLength(1)
  })

  test('creates a header with document number, date, narration, and currency', () => {
    expect(createJvHeader([], 'AED', 'bank_jv', new Date('2026-05-18T10:20:00.000Z'))).toEqual({
      docNo: 'BnkJV/2026/0001',
      date: '2026-05-18',
      narration: '',
      currency: 'AED',
    })
  })

  test('normalizes SOMS aliases to UZS for JV currency conversion', () => {
    const currencies = [
      { code: 'USD', exchangeRate: 1 },
      { code: 'UZS', exchangeRate: 0.000078 },
    ]

    expect(normalizeJvCurrencyCode('SOMS')).toBe('UZS')
    expect(convertJvAmountBetweenCurrencies(100000, 'SOMS', 'USD', currencies, 'USD')).toBe(7.8)
    expect(convertJvAmountBetweenCurrencies(7.8, 'USD', 'SOMS', currencies, 'USD')).toBe(100000)
  })

  test('groups multi-line JV ledger postings into one voucher row', () => {
    const sharedRef = '507f1f77bcf86cd799439011'
    const entries = [
      {
        _id: 'a1',
        referenceType: 'bank_jv',
        referenceId: sharedRef,
        date: '2026-05-15',
        description: 'BnkJV/2026/0004 — fx transfer',
        amount: 91.74,
        exchangeRate: 1,
        currency: 'USD',
        debitAccountId: { accountCode: '5190' },
        creditAccountId: { accountCode: '101001' },
      },
      {
        _id: 'a2',
        referenceType: 'bank_jv',
        referenceId: sharedRef,
        date: '2026-05-15',
        description: 'BnkJV/2026/0004 — fx transfer',
        amount: 71488946,
        exchangeRate: 0.000078,
        currency: 'UZS',
        debitAccountId: { accountCode: '101002' },
        creditAccountId: { accountCode: '101001' },
      },
      {
        _id: 'b1',
        referenceType: 'bank_jv',
        referenceId: '507f1f77bcf86cd799439099',
        date: '2026-05-15',
        description: 'BnkJV/2026/0005 — other',
        amount: 10,
        exchangeRate: 1,
        currency: 'USD',
        debitAccountId: { accountCode: '1000' },
        creditAccountId: { accountCode: '101001' },
      },
    ]

    const grouped = groupJvLedgerEntries(entries, { baseCurrencyCode: 'USD' })
    expect(grouped).toHaveLength(2)
    expect(grouped[0].voucherNo).toBe('BnkJV/2026/0004')
    expect(grouped[0].lineCount).toBe(2)
    expect(grouped[0].debitAccounts).toBe('101002, 5190')
    expect(grouped[0].creditAccounts).toBe('101001')
    expect(grouped[0].entryIds).toEqual(['a1', 'a2'])
  })

  test('groups legacy JV rows without referenceId by doc number and date', () => {
    const entries = [
      {
        _id: 'x1',
        referenceType: 'journal',
        date: '2026-03-01',
        description: 'Jv/2026/0001 — opening',
        amount: 100,
        exchangeRate: 1,
        debitAccountId: { accountCode: '1100' },
        creditAccountId: { accountCode: '2100' },
      },
      {
        _id: 'x2',
        referenceType: 'journal',
        date: '2026-03-01',
        description: 'Jv/2026/0001 — opening',
        amount: 50,
        exchangeRate: 1,
        debitAccountId: { accountCode: '1200' },
        creditAccountId: { accountCode: '2100' },
      },
    ]

    const grouped = groupJvLedgerEntries(entries, { baseCurrencyCode: 'USD' })
    expect(grouped).toHaveLength(1)
    expect(grouped[0].lineCount).toBe(2)
    expect(grouped[0].voucherNo).toBe('Jv/2026/0001')
  })

  test('groupJvLedgerEntries exposes documentFaceAmount when all lines share a non-base currency', () => {
    const entries = [
      {
        _id: 'j1',
        referenceType: 'journal',
        date: '2026-06-04',
        description: 'Jv/2026/0002 — rent',
        amount: 100,
        exchangeRate: 0.012,
        currency: 'INR',
        debitAccountId: { accountCode: '6200' },
        creditAccountId: { accountCode: '110011' },
      },
      {
        _id: 'j2',
        referenceType: 'journal',
        date: '2026-06-04',
        description: 'Jv/2026/0002 — rent',
        amount: 50,
        exchangeRate: 0.012,
        currency: 'INR',
        debitAccountId: { accountCode: '6201' },
        creditAccountId: { accountCode: '110011' },
      },
    ]
    const grouped = groupJvLedgerEntries(entries, { baseCurrencyCode: 'USD' })
    expect(grouped).toHaveLength(1)
    expect(grouped[0].documentCurrencyCode).toBe('INR')
    expect(grouped[0].documentFaceAmount).toBe(150)
  })

  test('reconstructJvEditLines emits two UI rows per posting when Dr/Cr accounts repeat (5 → 10 lines)', () => {
    const ctx = {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amount) => Number(amount),
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    }
    const drAcc = { _id: '6200id', accountCode: '6200', accountName: 'Payroll' }
    const crAcc = { _id: '1100id', accountCode: '110011', accountName: 'Bank' }
    const mk = (id, amount, createdAt) => ({
      _id: id,
      referenceType: 'journal',
      date: '2026-06-04',
      createdAt,
      description: 'Jv/2026/0001 — office',
      notes: 'Header narr',
      amount,
      currency: 'USD',
      exchangeRate: 1,
      debitAccountId: drAcc,
      creditAccountId: crAcc,
    })
    const entries = [
      mk('p1', 10, '2026-06-04T10:00:01.000Z'),
      mk('p2', 20, '2026-06-04T10:00:02.000Z'),
      mk('p3', 30, '2026-06-04T10:00:03.000Z'),
      mk('p4', 40, '2026-06-04T10:00:04.000Z'),
      mk('p5', 50, '2026-06-04T10:00:05.000Z'),
    ]
    const rep = entries[2]
    const out = reconstructJvEditLines(entries, rep, ctx)
    expect(out.lines).toHaveLength(10)
    expect(out.jvEditEntryIds).toEqual(['p1', 'p2', 'p3', 'p4', 'p5'])
    const drTotal = out.lines.filter((l) => l.debit !== '' && l.debit != null).reduce((s, l) => s + Number(l.debit), 0)
    const crTotal = out.lines.filter((l) => l.credit !== '' && l.credit != null).reduce((s, l) => s + Number(l.credit), 0)
    expect(drTotal).toBe(150)
    expect(crTotal).toBe(150)
    expect(out.headerDocNo).toBe('Jv/2026/0001')
    expect(out.narration).toBe('Header narr')
    const validation = validateJvLines({
      lines: out.lines,
      baseCurrencyCode: 'USD',
      inferJvAccountCurrency: () => 'USD',
      convertJvAmount: (amount) => Number(amount),
    })
    expect(validation.isBalanced).toBe(true)
    const alloc = allocateJvLedgerEntries(validation.activeLines)
    expect(alloc.error).toBe('')
    expect(alloc.entries).toHaveLength(5)
  })

  test('reconstructJvEditLines emits four lines for two postings with different debit accounts', () => {
    const ctx = {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amount) => Number(amount),
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    }
    const bank = { _id: 'b1', accountCode: '110011', accountName: 'Bank' }
    const d6200 = { _id: 'd62', accountCode: '6200', accountName: 'A' }
    const d6300 = { _id: 'd63', accountCode: '6300', accountName: 'B' }
    const entries = [
      {
        _id: 'a',
        referenceType: 'journal',
        date: '2026-06-05',
        createdAt: '2026-06-05T08:00:00.000Z',
        description: 'Jv/2026/0002 — mixed',
        amount: 100,
        currency: 'USD',
        debitAccountId: d6200,
        creditAccountId: bank,
      },
      {
        _id: 'b',
        referenceType: 'journal',
        date: '2026-06-05',
        createdAt: '2026-06-05T08:00:01.000Z',
        description: 'Jv/2026/0002 — mixed',
        amount: 200,
        currency: 'USD',
        debitAccountId: d6300,
        creditAccountId: bank,
      },
    ]
    const out = reconstructJvEditLines(entries, entries[0], ctx)
    expect(out.lines).toHaveLength(4)
    expect(out.lines[0].accountId).toBe('d62')
    expect(out.lines[1].accountId).toBe('b1')
    expect(out.lines[2].accountId).toBe('d63')
    expect(out.lines[3].accountId).toBe('b1')
  })

  test('reconstructJvEditLines parses line-level description from third em-dash segment', () => {
    const ctx = {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amount) => Number(amount),
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    }
    const drAcc = { _id: 'd1', accountCode: '4000', accountName: 'Rev' }
    const crAcc = { _id: 'c1', accountCode: '1000', accountName: 'Cash' }
    const entries = [{
      _id: 'x1',
      referenceType: 'journal',
      date: '2026-01-01',
      createdAt: '2026-01-01T12:00:00.000Z',
      description: 'Jv/2026/0009 — header note — line detail here',
      amount: 5,
      currency: 'USD',
      debitAccountId: drAcc,
      creditAccountId: crAcc,
    }]
    const out = reconstructJvEditLines(entries, entries[0], ctx)
    expect(out.narration).toBe('header note')
    expect(out.lines[0].description).toBe('line detail here')
    expect(out.lines[1].description).toBe('line detail here')
  })

  test('reconstructJvEditLines restores two-segment text in header when notes empty (legacy)', () => {
    const ctx = {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amount) => Number(amount),
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    }
    const drAcc = { _id: 'd1', accountCode: '6200', accountName: 'Payroll' }
    const crAcc = { _id: 'c1', accountCode: '110011', accountName: 'Bank' }
    const entries = [{
      _id: 'x1',
      referenceType: 'journal',
      date: '2026-06-04',
      createdAt: '2026-06-04T12:00:00.000Z',
      description: 'Jv/2026/0001 — row line text',
      notes: '',
      amount: 100,
      currency: 'USD',
      debitAccountId: drAcc,
      creditAccountId: crAcc,
    }]
    const out = reconstructJvEditLines(entries, entries[0], ctx)
    expect(out.narration).toBe('row line text')
    expect(out.lines[0].description).toBe('')
    expect(out.lines[1].description).toBe('')
  })

  test('reconstructJvEditLines restores legacy narration from description when notes missing', () => {
    const ctx = {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amount) => Number(amount),
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    }
    const drAcc = { _id: 'd1', accountCode: '6200', accountName: 'Payroll' }
    const crAcc = { _id: 'c1', accountCode: '110011', accountName: 'Bank' }
    const entries = [{
      _id: 'x1',
      referenceType: 'journal',
      date: '2026-06-04',
      createdAt: '2026-06-04T12:00:00.000Z',
      description: 'Jv/2026/0001 — OFFICE RENT',
      notes: '',
      amount: 100,
      currency: 'USD',
      debitAccountId: drAcc,
      creditAccountId: crAcc,
    }]
    const out = reconstructJvEditLines(entries, entries[0], ctx)
    expect(out.narration).toBe('OFFICE RENT')
    expect(out.lines[0].description).toBe('')
    expect(out.lines[1].description).toBe('')
  })

  test('reconstructJvEditLines restores bank_jv narration from notes or description', () => {
    const ctx = {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amount) => Number(amount),
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    }
    const drAcc = { _id: 'd1', accountCode: '101001', accountName: 'Bank USD' }
    const crAcc = { _id: 'c1', accountCode: '5190', accountName: 'FX' }
    const entries = [{
      _id: 'b1',
      referenceType: 'bank_jv',
      date: '2026-06-04',
      createdAt: '2026-06-04T12:00:00.000Z',
      description: 'BnkJV/2026/0004 — fx transfer',
      notes: '',
      amount: 100,
      currency: 'USD',
      debitAccountId: drAcc,
      creditAccountId: crAcc,
    }]
    const out = reconstructJvEditLines(entries, entries[0], ctx)
    expect(out.entryMode).toBe('bank_jv')
    expect(out.narration).toBe('fx transfer')
    expect(out.headerDocNo).toBe('BnkJV/2026/0004')
    expect(out.lines[0].description).toBe('')
    expect(out.lines[1].description).toBe('')
  })

  test('reconstructJvEditLines leaves row description empty when second segment is header notes only', () => {
    const ctx = {
      baseCurrencyCode: 'USD',
      convertJvAmount: (amount) => Number(amount),
      inferJvAccountCurrency: () => 'USD',
      inferLegacyJvBatchDisplayFc: () => null,
    }
    const drAcc = { _id: 'd1', accountCode: '6200', accountName: 'Payroll' }
    const crAcc = { _id: 'c1', accountCode: '110011', accountName: 'Bank' }
    const entries = [{
      _id: 'x1',
      referenceType: 'journal',
      date: '2026-06-04',
      createdAt: '2026-06-04T12:00:00.000Z',
      description: 'Jv/2026/0001 — OFFICE RENT',
      notes: 'OFFICE RENT',
      amount: 100,
      currency: 'USD',
      debitAccountId: drAcc,
      creditAccountId: crAcc,
    }]
    const out = reconstructJvEditLines(entries, entries[0], ctx)
    expect(out.narration).toBe('OFFICE RENT')
    expect(out.lines[0].description).toBe('')
    expect(out.lines[1].description).toBe('')
  })

  test('extractJvPostingLineDescription handles two vs three segments with notes', () => {
    expect(extractJvPostingLineDescription('Jv/2026/0001 — per-line only', '')).toBe('per-line only')
    expect(extractJvPostingLineDescription('Jv/2026/0001 — OFFICE RENT', 'OFFICE RENT')).toBe('')
    expect(extractJvPostingLineDescription('Jv/2026/0001 — OFFICE RENT — dr | cr', 'OFFICE RENT')).toBe('dr | cr')
  })

  test('validates balanced JV rows and returns normalized active lines', () => {
    const result = validateJvLines({
      lines: [
        { id: 1, accountId: 'cash', description: 'Cash leg', debit: '100', credit: '' },
        { id: 2, accountId: 'sales', description: 'Sales leg', debit: '', credit: '100' },
      ],
      baseCurrencyCode: 'USD',
      inferJvAccountCurrency: () => 'USD',
      convertJvAmount: (amount) => Number(amount),
    })

    expect(result.isBalanced).toBe(true)
    expect(result.canSave).toBe(true)
    expect(result.hasLineIssues).toBe(false)
    expect(result.activeLines).toEqual([
      { id: 1, accountId: 'cash', description: 'Cash leg', debit: 100, credit: 0 },
      { id: 2, accountId: 'sales', description: 'Sales leg', debit: 0, credit: 100 },
    ])
  })

  test('validates JV line entry errors', () => {
    const result = validateJvLines({
      lines: [
        { id: 'both', accountId: 'cash', debit: '10', credit: '5' },
        { id: 'blank', accountId: 'sales', description: 'typed only', debit: '', credit: '' },
        { id: 'missing-account', accountId: '', debit: '10', credit: '' },
      ],
      inferJvAccountCurrency: () => 'USD',
      convertJvAmount: (amount) => Number(amount),
    })

    expect(result.hasLineIssues).toBe(true)
    expect(result.lineIssuesById).toEqual({
      both: 'Row 1: Only one side allowed per row',
      blank: 'Row 2: Enter debit or credit amount',
      'missing-account': 'Row 3: Account is required',
    })
    expect(result.canSave).toBe(false)
  })

  test('allows blank bank JV exchange rows', () => {
    const result = validateJvLines({
      jvMode: 'bank_jv',
      lines: [
        { id: 'exchange', accountId: '5190', debit: '', credit: '' },
      ],
      isExchangeLine: (line) => line.accountId === '5190',
    })

    expect(result.lineIssuesById).toEqual({})
  })

  test('reports missing currency conversion rate', () => {
    const result = validateJvLines({
      lines: [
        { id: 1, accountId: 'uzs-bank', debit: '1000', credit: '' },
      ],
      baseCurrencyCode: 'USD',
      inferJvAccountCurrency: () => 'UZS',
      convertJvAmount: () => null,
    })

    expect(result.lineIssuesById[1]).toBe('Row 1: Missing or invalid currency rate for UZS')
    expect(result.hasLineIssues).toBe(true)
  })

  test('allocates one debit and one credit line into one ledger entry', () => {
    const result = allocateJvLedgerEntries([
      { id: 1, accountId: 'cash', description: 'cash in', debit: 100, credit: 0 },
      { id: 2, accountId: 'sales', description: 'sale', debit: 0, credit: 100 },
    ])

    expect(result.error).toBe('')
    expect(result.entries).toEqual([
      {
        debitAccountId: 'cash',
        creditAccountId: 'sales',
        amount: 100,
        lineDesc: 'cash in | sale',
      },
    ])
  })

  test('allocates split debit and credit rows into balanced pairs', () => {
    const result = allocateJvLedgerEntries([
      { id: 1, accountId: 'bank-a', description: 'bank a', debit: 70, credit: 0 },
      { id: 2, accountId: 'bank-b', description: 'bank b', debit: 30, credit: 0 },
      { id: 3, accountId: 'income', description: 'income', debit: 0, credit: 100 },
    ])

    expect(result.error).toBe('')
    expect(result.entries).toEqual([
      { debitAccountId: 'bank-a', creditAccountId: 'income', amount: 70, lineDesc: 'bank a | income' },
      { debitAccountId: 'bank-b', creditAccountId: 'income', amount: 30, lineDesc: 'bank b | income' },
    ])
  })

  test('reports an error when allocation has a material remainder', () => {
    const result = allocateJvLedgerEntries([
      { id: 1, accountId: 'cash', debit: 100, credit: 0 },
      { id: 2, accountId: 'sales', debit: 0, credit: 99.98 },
    ])

    expect(result.error).toBe('Failed to allocate JV lines into balanced ledger entries')
    expect(result.entries).toEqual([
      { debitAccountId: 'cash', creditAccountId: 'sales', amount: 99.98, lineDesc: '' },
    ])
  })

  test('reports an error when only one side is present', () => {
    const result = allocateJvLedgerEntries([
      { id: 1, accountId: 'cash', debit: 100, credit: 0 },
    ])

    expect(result).toEqual({
      entries: [],
      error: 'JV requires at least one debit row and one credit row',
    })
  })

  test('builds escaped JV print HTML with header, rows, and totals', () => {
    const html = buildJvPrintHtml({
      validation: {
        activeLines: [
          { id: 1, accountId: 'cash', description: 'Cash <leg>', debit: 100, credit: 0 },
          { id: 2, accountId: 'sales', description: 'Sales & revenue', debit: 0, credit: 100 },
        ],
        totalDebit: 100,
        totalCredit: 100,
      },
      jvHeader: {
        docNo: 'Jv/2026/0001',
        date: '2026-05-26',
        currency: 'USD',
        narration: 'Month-end <close>',
      },
      modeMeta: { badge: 'JOURNAL VOUCHER' },
      branding: {
        companyName: 'Modern <Gold>',
        address: 'Line 1\nLine 2',
        phone: '+998',
        trn: 'TRN-1',
      },
      defaultCompanyName: 'Default Co',
      preparedBy: 'Admin & User',
      logoMarkup: '<img alt="logo" />',
      getJvAccountById: (id) => ({
        cash: { accountCode: '1000', accountName: 'Cash & Bank' },
        sales: { accountCode: '4000', accountName: 'Sales' },
      })[id] || null,
    })

    expect(html).toContain('Modern &lt;Gold&gt;')
    expect(html).toContain('Line 1<br />Line 2')
    expect(html).toContain('JOURNAL VOUCHER')
    expect(html).toContain('Jv/2026/0001')
    expect(html).toContain('Admin &amp; User')
    expect(html).toContain('1000 - Cash &amp; Bank')
    expect(html).toContain('Cash &lt;leg&gt;')
    expect(html).toContain('Sales &amp; revenue')
    expect(html).toContain('100.00')
    expect(html).toContain('<img alt="logo" />')
  })
})
