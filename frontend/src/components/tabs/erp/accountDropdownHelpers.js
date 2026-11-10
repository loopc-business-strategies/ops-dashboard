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

/**
 * Chart accounts eligible as voucher Party Details entries when no customer/vendor master exists.
 * Includes: debtors/creditors, party-like Asset/Liability, and Expense ledgers (e.g. Payroll Expense).
 * Still excludes cash/bank/stock/income/control accounts (those stay on voucher lines).
 */
export function isPartyEligibleChartAccount(account) {
  if (!isActiveChartAccount(account)) return false
  const code = String(account?.accountCode || account?.code || '').trim()
  if (!isValidPartyAccountCode(code)) return false

  const name = String(account?.accountName || account?.name || '').trim()
  const type = String(account?.accountType || '').trim().toLowerCase()
  const haystack = `${code} ${name}`.toLowerCase()

  // Explicit party naming always wins (customer ledgers created in COA before master link).
  if (/\(debtor\)|\(creditor\)|\bdebtor\b|\bcreditor\b|\bcustomer\b|\bvendor\b|\bsupplier\b|\bsundry\b/i.test(haystack)) {
    return true
  }

  // Expense ledgers are allowed as party (payment to expense / payroll posting).
  if (type === 'expense') return true

  // Never treat operational / income / inventory / tax / equity / fixing GL as a party.
  if (
    /\b(cash|bank|petty|inventory|stock|vat|tax|equity|retained|depreciation|revenue|sales|income|cogs|rent|utilities|fixing|payable|receivable|equipment|property)\b/i.test(
      haystack,
    )
  ) {
    return false
  }

  // Remaining Asset/Liability ledgers with a real code may be party sub-ledgers (e.g. 1304).
  return type === 'asset' || type === 'liability'
}

/** Active chart accounts suitable for voucher party dropdowns (party-eligible only). */
export function filterPartyAccounts(accounts = []) {
  return filterActiveAccounts(accounts).filter(isPartyEligibleChartAccount)
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
  // Party Details needs a real creditor ledger. Incomplete vendors (no ledger link)
  // must not appear as a second row beside the ledger-backed party.
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
