/**
 * Chart-of-accounts code generation and hierarchy validation for ERP accounting.
 */

const { withSession, writeOpts } = require('../../utils/mongoTransaction')

/**
 * Same-type parents are the default. Expense may still nest under Income for
 * legacy trees; COGS / Purchase Fixing under Sales Revenue are Income children.
 */
function isCompatibleAccountParentType(parentType, childType) {
  const parent = String(parentType || '').trim()
  const child = String(childType || '').trim()
  if (!parent || !child) return true
  if (parent === child) return true
  return parent === 'Income' && child === 'Expense'
}

function createAccountCodeService({
  ChartOfAccount,
  BASE_CURRENCY_CODE,
  maxAccountCodeGenerationAttempts = Number(process.env.MAX_ACCOUNT_CODE_GENERATION_ATTEMPTS || 1000),
  maxAccountHierarchyDepth = Number(process.env.MAX_ACCOUNT_HIERARCHY_DEPTH || 10),
}) {
  const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const ensureAccountByCode = async ({
    user,
    code,
    name,
    accountType,
    currency = BASE_CURRENCY_CODE,
    session = null,
    parentAccountId = undefined,
  }) => {
    let account = await withSession(ChartOfAccount.findOne({ accountCode: code }), session)
    if (!account) {
      try {
        account = await ChartOfAccount.create([{
          accountName: name,
          accountCode: code,
          accountType,
          currency,
          parentAccountId: parentAccountId || null,
          description: `Auto-created default account for ${name}`,
          createdBy: user._id,
        }], writeOpts(session)).then((rows) => rows[0])
      } catch (err) {
        if (err?.code !== 11000) throw err
        account = await withSession(ChartOfAccount.findOne({ accountCode: code }), session)
      }
    }

    if (!account) {
      throw new Error(`Unable to resolve account code ${code}`)
    }

    if (!account.isActive) {
      account.isActive = true
    }
    if (accountType && account.accountType !== accountType) {
      account.accountType = accountType
    }
    if (parentAccountId !== undefined
      && String(account.parentAccountId || '') !== String(parentAccountId || '')) {
      account.parentAccountId = parentAccountId || null
    }
    if (account.isModified()) {
      await account.save(writeOpts(session))
    }

    return account
  }

  const nextGeneratedAccountCode = async (prefix) => {
    const normalizedPrefix = String(prefix || '').trim()
    if (!normalizedPrefix) throw new Error('Account code prefix is required')

    const pattern = new RegExp(`^${escapeRegex(normalizedPrefix)}\\d{4}$`)
    const latest = await ChartOfAccount.findOne({ accountCode: pattern })
      .sort({ accountCode: -1 })
      .select('accountCode')
      .lean()

    let seq = latest ? Number(String(latest.accountCode).slice(normalizedPrefix.length) || 0) + 1 : 1
    let code = ''
    let attempts = 0
    while (!code || await ChartOfAccount.exists({ accountCode: code })) {
      attempts += 1
      if (attempts > maxAccountCodeGenerationAttempts) {
        throw new Error('Unable to generate account code. Please retry.')
      }
      code = `${normalizedPrefix}${String(seq).padStart(4, '0')}`
      seq += 1
    }
    return code
  }

  const validateAccountParentAssignment = async ({ accountId = null, parentAccountId = null, accountType = null }) => {
    if (!parentAccountId) return

    const accountKey = accountId ? String(accountId) : ''
    let cursorId = parentAccountId
    let depth = 0
    const seen = new Set(accountKey ? [accountKey] : [])
    let isDirectParent = true

    while (cursorId) {
      const key = String(cursorId)
      if (seen.has(key)) {
        throw new Error('Circular account hierarchy is not allowed')
      }
      seen.add(key)

      const cursor = await ChartOfAccount.findById(cursorId).select('parentAccountId accountType')
      if (!cursor) {
        throw new Error('Parent account not found')
      }

      if (
        isDirectParent
        && accountType
        && !isCompatibleAccountParentType(cursor.accountType, accountType)
      ) {
        throw new Error(
          `Parent account type must match selected account type (${accountType}), `
          + 'or be Income when nesting an Expense (e.g. Cost of Goods under Sales Revenue)',
        )
      }

      depth += 1
      if (depth > maxAccountHierarchyDepth) {
        throw new Error(`Account hierarchy depth cannot exceed ${maxAccountHierarchyDepth}`)
      }

      cursorId = cursor.parentAccountId || null
      isDirectParent = false
    }
  }

  const ensureChildAccountByName = async ({
    user,
    parentAccount,
    accountType,
    accountName,
    codePrefix,
    currency = BASE_CURRENCY_CODE,
  }) => {
    const nameRe = new RegExp(`^${escapeRegex(accountName)}$`, 'i')
    let existing = await ChartOfAccount.findOne({
      parentAccountId: parentAccount?._id || null,
      accountName: nameRe,
    })

    // After COA reorg / type change (Expense → Income under Sales Revenue), reuse
    // the same named account instead of minting a duplicate 91/92xxxx.
    if (!existing) {
      existing = await ChartOfAccount.findOne({ accountName: nameRe })
    }

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true
      }
      if (accountType && existing.accountType !== accountType) {
        existing.accountType = accountType
      }
      if (parentAccount?._id
        && String(existing.parentAccountId || '') !== String(parentAccount._id)) {
        existing.parentAccountId = parentAccount._id
      }
      if (existing.isModified()) {
        await existing.save()
      }
      return existing
    }

    const accountCode = await nextGeneratedAccountCode(codePrefix)
    return ChartOfAccount.create({
      accountName,
      accountCode,
      accountType,
      parentAccountId: parentAccount?._id || null,
      currency,
      description: `Auto-created fixing sub account: ${accountName}`,
      createdBy: user._id,
    })
  }

  const nextCustomerAccountCode = async () => {
    const base = 1300
    let code = base
    while (await ChartOfAccount.exists({ accountCode: String(code) })) {
      code += 1
    }
    return String(code)
  }

  const nextVendorAccountCode = async () => {
    const base = 2300
    let code = base
    while (await ChartOfAccount.exists({ accountCode: String(code) })) {
      code += 1
    }
    return String(code)
  }

  const nextInventoryAccountCode = async () => {
    const base = 12000
    let code = base
    while (await ChartOfAccount.exists({ accountCode: String(code) })) {
      code += 1
    }
    return String(code)
  }

  return {
    ensureAccountByCode,
    nextGeneratedAccountCode,
    validateAccountParentAssignment,
    ensureChildAccountByName,
    nextCustomerAccountCode,
    nextVendorAccountCode,
    nextInventoryAccountCode,
  }
}

module.exports = {
  createAccountCodeService,
  isCompatibleAccountParentType,
}
