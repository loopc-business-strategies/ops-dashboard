export function isActiveChartAccount(account) {
  return Boolean(account) && account.isActive !== false
}

/** Reject empty codes and 24-char hex strings (Mongo ObjectIds used as fallback party codes). */
export function isValidPartyAccountCode(code) {
  const normalized = String(code || '').trim()
  if (!normalized) return false
  if (/^[a-f0-9]{24}$/i.test(normalized)) return false
  return true
}

export function filterActiveAccounts(accounts = []) {
  const seen = new Set()
  return (Array.isArray(accounts) ? accounts : [])
    .filter(isActiveChartAccount)
    .filter((account) => {
      const key = String(account?._id || account?.accountCode || '').trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

/** Active chart accounts suitable for voucher party dropdowns (valid account codes only). */
export function filterPartyAccounts(accounts = []) {
  return filterActiveAccounts(accounts).filter((account) => {
    const code = String(account?.accountCode || account?.code || '').trim()
    return isValidPartyAccountCode(code)
  })
}

export function isActiveCustomer(customer) {
  if (!customer || customer.isActive === false) return false
  const ledger = customer.ledgerAccountId
  if (!ledger || typeof ledger !== 'object' || !ledger._id) return false
  if (ledger.isActive === false) return false
  if (!isValidPartyAccountCode(ledger.accountCode)) return false
  return true
}

export function isActiveVendor(vendor) {
  if (!vendor || vendor.isActive === false) return false
  if (vendor.deletedAt) return false
  const ledger = vendor.ledgerAccountId
  if (!ledger || typeof ledger !== 'object' || !ledger._id) return false
  if (ledger.isActive === false) return false
  if (!isValidPartyAccountCode(ledger.accountCode) && !isValidPartyAccountCode(vendor.vendorCode)) return false
  return true
}

export function filterActiveCustomers(customers = []) {
  return (Array.isArray(customers) ? customers : []).filter(isActiveCustomer)
}

export function filterActiveVendors(vendors = []) {
  return (Array.isArray(vendors) ? vendors : []).filter(isActiveVendor)
}

export function buildEntryAccountOptions({ accounts = [], customers = [], vendors = [] } = {}) {
  const activeAccounts = filterActiveAccounts(accounts)
  const partyLedgers = [...filterActiveCustomers(customers), ...filterActiveVendors(vendors)]
    .map((party) => party?.ledgerAccountId)
    .filter((ledger) => ledger && (ledger._id || ledger.accountCode))
    .filter(isActiveChartAccount)
  const seen = new Set()
  return [...activeAccounts, ...partyLedgers].filter((account) => {
    const key = String(account?._id || account?.accountCode || '').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function excludeLedgerAccountsRepresentedByParties(accounts = [], customers = [], vendors = []) {
  const representedLedgerIds = new Set(
    [...filterActiveCustomers(customers), ...filterActiveVendors(vendors)]
      .map((party) => party?.ledgerAccountId?._id || party?.ledgerAccountId)
      .filter(Boolean)
      .map(String),
  )
  const representedLedgerCodes = new Set(
    [...filterActiveCustomers(customers), ...filterActiveVendors(vendors)]
      .map((party) => String(party?.ledgerAccountId?.accountCode || '').trim().toLowerCase())
      .filter(Boolean),
  )
  return filterActiveAccounts(accounts).filter((account) => {
    const id = String(account?._id || '').trim()
    const code = String(account?.accountCode || '').trim().toLowerCase()
    if (id && representedLedgerIds.has(id)) return false
    if (code && representedLedgerCodes.has(code)) return false
    return true
  })
}
