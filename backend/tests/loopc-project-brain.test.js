const {
  searchProject,
  resolveEndpointOwner,
  resolveProjectFixes,
  formatProjectFixReply,
  buildProjectStructureReply,
  buildCodeSearchReply,
} = require('../services/loopcProjectBrain')

describe('loopcProjectBrain', () => {
  test('searchProject finds transaction routes', () => {
    const hits = searchProject('transaction voucher', 5)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => /transaction/i.test(h.file || h.endpoint || ''))).toBe(true)
  })

  test('resolveEndpointOwner maps metal-rates URL', () => {
    const owner = resolveEndpointOwner('/api/erp-accounting/metal-rates/live')
    expect(owner?.file).toMatch(/currencyRoutes/)
  })

  test('resolveProjectFixes matches MT4 prompt', () => {
    const fixes = resolveProjectFixes({ message: 'MT4 prices not showing on top bar' })
    expect(fixes.length).toBeGreaterThan(0)
    expect(fixes[0].id).toBe('mt4-live-prices')
  })

  test('formatProjectFixReply includes code files', () => {
    const reply = formatProjectFixReply({
      message: 'fix voucher 403 forbidden',
      lastError: { status: 403, url: '/api/erp-accounting/transactions', message: 'Forbidden' },
      userName: 'Nan',
    })
    expect(reply).toMatch(/Project Fix/i)
    expect(reply).toMatch(/transactionRoutes/)
  })

  test('buildProjectStructureReply includes stats', () => {
    const reply = buildProjectStructureReply()
    expect(reply).toMatch(/Project Code Map/i)
    expect(reply).toMatch(/Route files/)
  })

  test('buildCodeSearchReply finds mt4-related code', () => {
    const reply = buildCodeSearchReply('metal-rates bridge')
    expect(reply).toMatch(/Code search/i)
  })
})
