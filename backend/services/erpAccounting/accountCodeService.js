/**
 * Chart-of-accounts code generation and hierarchy validation for ERP accounting.
 */

function createAccountCodeService({
  ChartOfAccount,
  BASE_CURRENCY_CODE,
  maxAccountCodeGenerationAttempts = Number(process.env.MAX_ACCOUNT_CODE_GENERATION_ATTEMPTS || 1000),
  maxAccountHierarchyDepth = Number(process.env.MAX_ACCOUNT_HIERARCHY_DEPTH || 10),
}) {
  const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const ensureAccountByCode = async ({ user, code, name, accountType, currency = BASE_CURRENCY_CODE }) => {
    let account = await ChartOfAccount.findOne({ accountCode: code })
    if (!account) {
      try {
        account = await ChartOfAccount.create({
          accountName: name,
          accountCode: code,
          accountType,
          currency,
          description: `Auto-created default account for ${name}`,
          createdBy: user._id,
        })
      } catch (err) {
        if (err?.code !== 11000) throw err
        account = await ChartOfAccount.findOne({ accountCode: code })
      }
    }

    if (!account) {
      throw new Error(`Unable to resolve account code ${code}`)
    }

    if (!account.isActive) {
      account.isActive = true
      await account.save()
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

      if (isDirectParent && accountType && String(cursor.accountType || '') !== String(accountType)) {
        throw new Error(`Parent account type must match selected account type (${accountType})`)
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
    const existing = await ChartOfAccount.findOne({
      parentAccountId: parentAccount?._id || null,
      accountType,
      accountName: new RegExp(`^${escapeRegex(accountName)}$`, 'i'),
    })

    if (existing) {
      if (!existing.isActive) {
        existing.isActive = true
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
}
