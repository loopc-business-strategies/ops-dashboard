/**
 * Cash/bank defaults, voucher settlement account resolution, transaction debit/credit resolution,
 * main ledger row creation from a transaction (incl. FX adjustment), and vendor advance confirmation.
 */

const { applyPartyAccountPriority } = require('../../utils/transactionPartyAccounts')
const { isMetalTransferType, isMetalStockType } = require('../../utils/metalStockVoucherTypes')

function createTransactionAccountResolutionService({
  ChartOfAccount,
  AccountMapping,
  Customer,
  Vendor,
  InventoryItem,
  Currency,
  Ledger,
  BASE_CURRENCY_CODE,
  normalizeExchangeRateValue,
  normalizeMoneyValue,
  toMoney,
  ensureAccountByCode,
  resolveVoucherNetLineAmount,
  resolveVoucherVatAmount,
  resolveReferenceExchangeRate,
  resolvePrimaryVoucherFxLine,
  resolveVoucherFxMetrics,
  resolveExchangeAdjustmentAccounts,
  FX_REVALUATION_EPSILON,
}) {

  const normalizeCurrencyCode = (value, fallback = BASE_CURRENCY_CODE) => {
    const code = String(value || fallback || 'USD').trim().toUpperCase()
    return code || String(fallback || BASE_CURRENCY_CODE || 'USD').trim().toUpperCase()
  }

  const findPreferredBankAccountByCurrency = async (currencyCode) => {
    const normalizedCurrency = normalizeCurrencyCode(currencyCode)
    const bankCandidates = await ChartOfAccount.find({
      isActive: true,
      accountType: 'Asset',
      $or: [
        { accountName: /bank|nbd/i },
        { accountCode: /^101/ },
      ],
    }).sort({ accountCode: 1, createdAt: 1, _id: 1 })

    if (!bankCandidates.length) return null

    const preferredCodesByCurrency = {
      USD: ['101001', '1010'],
      AED: ['101002'],
      SOMS: ['101003'],
    }

    const preferredCodes = preferredCodesByCurrency[normalizedCurrency] || []
    for (const code of preferredCodes) {
      const byCode = bankCandidates.find((row) => String(row.accountCode || '').trim() === code)
      if (byCode) return byCode
    }

    const currencyMatches = bankCandidates.filter((row) => normalizeCurrencyCode(row.currency) === normalizedCurrency)
    if (currencyMatches.length) {
      const specific = currencyMatches.find((row) => String(row.accountCode || '').trim().length > 4)
      if (specific) return specific
      return currencyMatches[0]
    }

    return bankCandidates[0]
  }

  const ensureCashBankAccount = async (user, currency = 'USD', preference = 'any') => {
    const normalizedPreference = String(preference || 'any').toLowerCase()
    const isBankPreferred = normalizedPreference === 'bank'
    const isCashPreferred = normalizedPreference === 'cash'

    const query = {
      accountType: 'Asset',
      $or: isBankPreferred
        ? [{ accountCode: '1010' }, { accountName: /bank/i }]
        : isCashPreferred
          ? [{ accountCode: '1000' }, { accountName: /petty cash|cash on hand|cash/i }]
          : [{ accountCode: '1010' }, { accountName: /bank|cash/i }],
    }

    let account = await ChartOfAccount.findOne(query).sort({ accountCode: 1 })

    const preferredCode = isCashPreferred ? '1000' : '1010'

    if (!account) {
      account = await ChartOfAccount.findOne({ accountCode: preferredCode })

      if (!account) {
        try {
          account = await ChartOfAccount.create({
            accountName: isCashPreferred ? 'Petty Cash' : 'Main Bank Account',
            accountCode: preferredCode,
            accountType: 'Asset',
            currency,
            description: isCashPreferred ? 'Default cash account' : 'Default bank account',
            createdBy: user._id,
          })
        } catch (err) {
          if (err?.code !== 11000) throw err
          account = await ChartOfAccount.findOne({ accountCode: preferredCode })
        }
      }
    }

    if (account && !account.isActive) {
      account.isActive = true
      await account.save()
    }

    return account
  }

  const normalizeVoucherSettlementType = (value) => {
    const v = String(value || '').trim().toLowerCase()
    if (v === 'tt' || v === 'transfer') return 'bank'
    if (v === 'cash') return 'cash'
    if (v === 'cheque' || v === 'check') return 'bank'
    return 'any'
  }

  const resolveVoucherSettlementAccount = async (user, tx) => {
    if (!['receipt', 'payment'].includes(String(tx?.type || '').toLowerCase())) return null

    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    if (!lines.length) return null

    const preferredLine = lines.find((line) => String(line?.acCode || '').trim()) || lines[0]
    const accountCode = String(preferredLine?.acCode || '').trim()
    const settlementPreference = normalizeVoucherSettlementType(preferredLine?.type)
    const settlementCurrency = normalizeCurrencyCode(
      preferredLine?.currCode
      || tx?.voucherMeta?.currCode
      || tx?.currency
      || BASE_CURRENCY_CODE
    )

    if (accountCode) {
      const looksLikeObjectId = /^[a-f\d]{24}$/i.test(accountCode)
      let account = null

      if (looksLikeObjectId) {
        account = await ChartOfAccount.findById(accountCode)
      }

      if (!account) {
        const matches = await ChartOfAccount.find({ accountCode })
          .sort({ isActive: -1, createdAt: 1, _id: 1 })

        account =
          matches.find((row) => row.isActive && row.accountType === 'Asset')
          || matches.find((row) => row.isActive)
          || matches.find((row) => row.accountType === 'Asset')
          || matches[0]
      }

      if (account) {
        if (!account.isActive) {
          account.isActive = true
          await account.save()
        }
        return account._id
      }
    }

    if (settlementPreference === 'bank') {
      const preferredBank = await findPreferredBankAccountByCurrency(settlementCurrency)
      if (preferredBank) return preferredBank._id
    }

    const fallbackAccount = await ensureCashBankAccount(user, tx.currency || 'USD', settlementPreference)
    return fallbackAccount?._id || null
  }

  const resolveTransactionAccounts = async ({ user, tx, mappingOverride, preparedVoucherImpact }) => {
    const transactionType = tx.type
    let mapping = null
    if (tx.mappingId) {
      mapping = await AccountMapping.findById(tx.mappingId)
    } else {
      mapping = await AccountMapping.findOne({ mappingType: transactionType, isActive: true })
    }

    let debitAccountId = tx.debitAccountId || mapping?.debitAccountId || null
    let creditAccountId = tx.creditAccountId || mapping?.creditAccountId || null
    const voucherSettlementAccountId = await resolveVoucherSettlementAccount(user, tx)
    const partyAccountIdRaw = String(tx?.voucherMeta?.partyAccountId || '').trim()
    const partyCodeRaw = String(tx?.voucherMeta?.partyCode || '').trim()
    let directPartyAccount = null

    const resolvePartyChartAccount = async (idOrCode) => {
      const key = String(idOrCode || '').trim()
      if (!key) return null
      if (/^[a-f\d]{24}$/i.test(key)) {
        const byId = await ChartOfAccount.findById(key)
        if (byId) return byId
      }
      const matches = await ChartOfAccount.find({ accountCode: key })
        .sort({ isActive: -1, createdAt: 1, _id: 1 })
      return matches.find((row) => row.isActive) || matches[0] || null
    }

    if (partyAccountIdRaw || partyCodeRaw) {
      directPartyAccount = await resolvePartyChartAccount(partyAccountIdRaw)
      if (!directPartyAccount && partyCodeRaw && partyCodeRaw !== partyAccountIdRaw) {
        directPartyAccount = await resolvePartyChartAccount(partyCodeRaw)
      }
    }

    if (transactionType === 'sale' || transactionType === 'receipt' || transactionType === 'metal_payment') {
      const customer = tx.customerId ? await Customer.findById(tx.customerId).populate('ledgerAccountId') : null
      if ((transactionType === 'sale' || transactionType === 'receipt' || transactionType === 'metal_payment') && customer?.ledgerAccountId) {
        if (transactionType === 'sale' || transactionType === 'metal_payment') debitAccountId = customer.ledgerAccountId._id
        if (transactionType === 'receipt') creditAccountId = customer.ledgerAccountId._id
      }

      if ((transactionType === 'sale' || transactionType === 'metal_payment') && !customer?.ledgerAccountId) {
        const vendor = tx.vendorId ? await Vendor.findById(tx.vendorId).populate('ledgerAccountId') : null
        if (vendor?.ledgerAccountId) {
          debitAccountId = debitAccountId || vendor.ledgerAccountId._id
        }
      }

      ;({ debitAccountId, creditAccountId } = applyPartyAccountPriority({
        transactionType,
        debitAccountId,
        creditAccountId,
        directPartyAccountId: directPartyAccount?._id,
      }))

      const bank = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank')
      if (transactionType === 'receipt') debitAccountId = voucherSettlementAccountId || debitAccountId || bank._id
    }

    if (transactionType === 'purchase' || transactionType === 'payment' || transactionType === 'metal_receipt') {
      const vendor = tx.vendorId ? await Vendor.findById(tx.vendorId).populate('ledgerAccountId') : null
      if (vendor?.ledgerAccountId) {
        if (transactionType === 'purchase' || transactionType === 'metal_receipt') creditAccountId = vendor.ledgerAccountId._id
        if (transactionType === 'payment') debitAccountId = vendor.ledgerAccountId._id
      }

      if ((transactionType === 'purchase' || transactionType === 'metal_receipt') && !vendor?.ledgerAccountId) {
        const customer = tx.customerId ? await Customer.findById(tx.customerId).populate('ledgerAccountId') : null
        if (customer?.ledgerAccountId) {
          creditAccountId = creditAccountId || customer.ledgerAccountId._id
        }
      }

      if (transactionType === 'payment' && !vendor?.ledgerAccountId) {
        const customer = tx.customerId ? await Customer.findById(tx.customerId).populate('ledgerAccountId') : null
        if (customer?.ledgerAccountId) {
          debitAccountId = debitAccountId || customer.ledgerAccountId._id
        }
      }

      ;({ debitAccountId, creditAccountId } = applyPartyAccountPriority({
        transactionType,
        debitAccountId,
        creditAccountId,
        directPartyAccountId: directPartyAccount?._id,
      }))

      const bank = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank')
      if (transactionType === 'payment') creditAccountId = voucherSettlementAccountId || creditAccountId || bank._id
    }

    if (transactionType === 'purchase' || transactionType === 'metal_receipt') {
      if (preparedVoucherImpact?.purchaseDebitAccountId) {
        debitAccountId = preparedVoucherImpact.purchaseDebitAccountId
      } else if (tx.inventoryItemId) {
        const item = await InventoryItem.findById(tx.inventoryItemId)
        if (item?.ledgerAccountId) debitAccountId = debitAccountId || item.ledgerAccountId
      }
    }

    if (transactionType === 'metal_payment' && preparedVoucherImpact?.inventoryCreditAccountId) {
      creditAccountId = preparedVoucherImpact.inventoryCreditAccountId
    }

    if (mappingOverride?.debitAccountId) debitAccountId = mappingOverride.debitAccountId
    if (mappingOverride?.creditAccountId) creditAccountId = mappingOverride.creditAccountId

    if (!debitAccountId || !creditAccountId) {
      const ensureAccount = async ({ name, code, type }) => {
        const acc = await ensureAccountByCode({
          user,
          code,
          name,
          accountType: type,
          currency: tx.currency || 'USD',
        })
        return acc._id
      }

      if (isMetalTransferType(transactionType)) {
        if (transactionType === 'metal_receipt') {
          if (!debitAccountId) {
            debitAccountId = preparedVoucherImpact?.purchaseDebitAccountId
              || await ensureAccount({ name: 'Metal Inventory', code: '1300', type: 'Asset' })
          }
          if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Accounts Payable', code: '2000', type: 'Liability' })
        } else if (transactionType === 'metal_payment') {
          if (!debitAccountId) debitAccountId = await ensureAccount({ name: 'Accounts Receivable', code: '1100', type: 'Asset' })
          if (!creditAccountId) {
            creditAccountId = preparedVoucherImpact?.inventoryCreditAccountId
              || await ensureAccount({ name: 'Metal Inventory', code: '1300', type: 'Asset' })
          }
        }
      } else if (transactionType === 'sale') {
        if (!debitAccountId) debitAccountId = await ensureAccount({ name: 'Accounts Receivable', code: '1100', type: 'Asset' })
        if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Sales Revenue', code: '4000', type: 'Income' })
      } else if (transactionType === 'purchase') {
        const hasVoucherInventory = Boolean(preparedVoucherImpact?.purchaseDebitAccountId || tx.inventoryItemId || (Array.isArray(tx.voucherMeta?.lineItems) && tx.voucherMeta.lineItems.length))
        if (!debitAccountId) {
          debitAccountId = hasVoucherInventory
            ? await ensureAccount({ name: 'Metal Inventory', code: '1210', type: 'Asset' })
            : await ensureAccount({ name: 'Metal Purchases', code: '5100', type: 'Expense' })
        }
        if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Accounts Payable', code: '2000', type: 'Liability' })
      } else if (transactionType === 'receipt') {
        if (!debitAccountId) debitAccountId = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank').then((a) => a._id)
        if (!creditAccountId) creditAccountId = await ensureAccount({ name: 'Accounts Receivable', code: '1100', type: 'Asset' })
      } else if (transactionType === 'payment') {
        if (!creditAccountId) creditAccountId = await ensureCashBankAccount(user, tx.currency || 'USD', 'bank').then((a) => a._id)
        if (!debitAccountId) debitAccountId = await ensureAccount({ name: 'Accounts Payable', code: '2000', type: 'Liability' })
      }
    }

    if (!debitAccountId || !creditAccountId) {
      throw new Error('Unable to resolve debit/credit accounts. Configure mapping or provide override.')
    }

    return {
      debitAccountId,
      creditAccountId,
    }
  }

  const createLedgerFromTransaction = async ({ user, transaction, referenceType }) => {
    const currencyCode = String(transaction.currency || 'USD').toUpperCase()
    const base = await Currency.findOne({ baseCurrency: true, isActive: true })
    const baseCurrencyCode = String(base?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    const txCurrency = await Currency.findOne({ code: currencyCode, isActive: true })
    const exchangeRate = normalizeExchangeRateValue(transaction.exchangeRate ?? txCurrency?.exchangeRate ?? 1)
    const transactionAmount = normalizeMoneyValue(transaction.amount, 'amount')
    const voucherNetAmount = resolveVoucherNetLineAmount(transaction)
    const voucherVatAmount = resolveVoucherVatAmount(transaction)
    const voucherGrossAmount = toMoney(voucherNetAmount + voucherVatAmount)
    const shouldPostNetMainAmount = isMetalStockType(String(transaction.type || '').toLowerCase())
      && voucherNetAmount > 0
      && voucherVatAmount > 0
      && Math.abs(transactionAmount - voucherGrossAmount) <= 0.02
    const postingAmount = shouldPostNetMainAmount ? voucherNetAmount : transactionAmount
    const amountInBase = postingAmount * exchangeRate

    const entry = await Ledger.create({
      date: transaction.voucherMeta?.valueDate || transaction.date || new Date(),
      debitAccountId: transaction.debitAccountId,
      creditAccountId: transaction.creditAccountId,
      amount: toMoney(amountInBase),
      description: transaction.description || `${transaction.type} transaction`,
      referenceType,
      referenceId: transaction._id,
      createdBy: user._id,
      updatedBy: user._id,
      department: user.department,
      currency: baseCurrencyCode,
      exchangeRate: 1,
    })

    const type = String(transaction.type || '').toLowerCase()
    const voucherMeta = transaction?.voucherMeta || {}
    const voucherLine = resolvePrimaryVoucherFxLine(voucherMeta)
    const voucherCurrencyCode = String(
      voucherMeta?.currCode
      || voucherLine?.currCode
      || currencyCode
      || 'USD'
    ).toUpperCase()

    if (['receipt', 'payment'].includes(type)) {
      const lineCurrCode = String(voucherLine?.currCode || currencyCode || 'USD').toUpperCase()
      const baseCurr = String(baseCurrencyCode || 'USD').toUpperCase()
      const isForeignLine = lineCurrCode !== baseCurr

      let masterRate = 0
      if (isForeignLine) {
        const lineCurrency = lineCurrCode === currencyCode
          ? txCurrency
          : await Currency.findOne({ code: lineCurrCode, isActive: true })
        masterRate = Number(lineCurrency?.exchangeRate || 0)
      }

      const referenceRate = Number(
        resolveReferenceExchangeRate(voucherMeta)
        || masterRate
        || 0
      )

      if (Number.isFinite(referenceRate) && referenceRate > 0) {
        const txAmount = Number(transaction.amount || 0)
        const fxMetrics = resolveVoucherFxMetrics({
          voucherMeta,
          txAmount,
          fallbackRate: Number(voucherLine?.currRate || exchangeRate || masterRate || 1),
          referenceRate,
        })

        const foreignAmount = Number(fxMetrics.totalForeignAmount || 0)
        const lineRate = Number(fxMetrics.lineRate || exchangeRate || masterRate || 1)

        const expectedFC = Number(fxMetrics.expectedForeignAmount || (txAmount / referenceRate))
        const actualFC = Number(fxMetrics.actualForeignAmount || (txAmount / lineRate))
        const fcDiff = Number.isFinite(Number(fxMetrics.fcDifference))
          ? Number(fxMetrics.fcDifference)
          : (actualFC - expectedFC)
        const rawDiffInBase = Math.abs(fcDiff) * referenceRate

        if (rawDiffInBase >= FX_REVALUATION_EPSILON) {
          const diffInBase = toMoney(rawDiffInBase)
          const isGain = type === 'payment' ? fcDiff < 0 : fcDiff > 0
          const accounts = await resolveExchangeAdjustmentAccounts({
            user,
            isGain,
            transactionType: type,
            offsetAccountId: type === 'receipt' ? transaction.creditAccountId : transaction.debitAccountId,
          })

          await Ledger.create({
            date: transaction.date || new Date(),
            debitAccountId: accounts.debitAccountId,
            creditAccountId: accounts.creditAccountId,
            amount: diffInBase,
            description: `Exchange ${isGain ? 'gain' : 'loss'} adjustment for transaction ${transaction._id}`,
            referenceType: 'journal',
            referenceId: transaction._id,
            createdBy: user._id,
            updatedBy: user._id,
            department: user.department,
            currency: base?.code || 'USD',
            exchangeRate: 1,
          })
        }
      }
    }

    return entry
  }

  return {
    normalizeCurrencyCode,
    findPreferredBankAccountByCurrency,
    normalizeVoucherSettlementType,
    ensureCashBankAccount,
    resolveVoucherSettlementAccount,
    resolveTransactionAccounts,
    createLedgerFromTransaction,
  }
}

function createVendorAdvanceConfirmationHelpers({
  ChartOfAccount,
  Currency,
  BASE_CURRENCY_CODE,
  normalizeExchangeRateValue,
  normalizeMoneyValue,
  toMoney,
  getOutstandingForAccount,
}) {
  const buildVendorAdvanceConfirmationError = ({ account, outstandingBefore, paymentAmount, projectedBalance, currencyCode }) => {
    const payableOutstanding = Math.max(0, Number(-outstandingBefore || 0))
    const paymentShortfall = Math.max(0, Number(paymentAmount || 0) - payableOutstanding)
    const advanceAmount = Math.max(0, Number(projectedBalance || 0))
    const err = new Error(
      payableOutstanding > 0
        ? `Current outstanding payable for ${account.accountCode} - ${account.accountName} is ${toMoney(payableOutstanding).toLocaleString()} ${currencyCode}. This payment is ${toMoney(paymentAmount).toLocaleString()} ${currencyCode}, so the shortfall of ${toMoney(paymentShortfall).toLocaleString()} ${currencyCode} will be posted as a vendor advance. Result after posting: ${toMoney(advanceAmount).toLocaleString()} ${currencyCode} Dr. Continue?`
        : `No outstanding payable was found for ${account.accountCode} - ${account.accountName}. This full payment of ${toMoney(paymentAmount).toLocaleString()} ${currencyCode} will be posted as a vendor advance. Result after posting: ${toMoney(advanceAmount).toLocaleString()} ${currencyCode} Dr. Continue?`
    )
    err.status = 409
    err.code = 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED'
    err.details = {
      accountCode: account.accountCode,
      accountName: account.accountName,
      outstandingBefore: toMoney(outstandingBefore),
      paymentAmount: toMoney(paymentAmount),
      projectedBalance: toMoney(projectedBalance),
      payableOutstanding: toMoney(payableOutstanding),
      paymentShortfall: toMoney(paymentShortfall),
      advanceAmount: toMoney(advanceAmount),
    }
    return err
  }

  const ensurePaymentAdvanceConfirmed = async ({ tx, resolvedAccounts, confirmed }) => {
    if (confirmed || String(tx?.type || '').toLowerCase() !== 'payment' || !resolvedAccounts?.debitAccountId) return

    const debitAccount = await ChartOfAccount.findById(resolvedAccounts.debitAccountId)
      .select('accountCode accountName accountType isActive')
      .lean()

    if (!debitAccount || String(debitAccount.accountType || '').toLowerCase() !== 'liability') return

    const txCurrency = await Currency.findOne({ code: String(tx.currency || 'USD').toUpperCase(), isActive: true }).select('exchangeRate').lean()
    const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean()
    const exchangeRate = normalizeExchangeRateValue(tx.exchangeRate ?? txCurrency?.exchangeRate ?? 1)
    const paymentAmount = normalizeMoneyValue(tx.amount, 'amount') * exchangeRate
    const outstandingBefore = Number(await getOutstandingForAccount(resolvedAccounts.debitAccountId) || 0)
    const projectedBalance = outstandingBefore + paymentAmount

    if (projectedBalance > 0) {
      throw buildVendorAdvanceConfirmationError({
        account: debitAccount,
        outstandingBefore,
        paymentAmount,
        projectedBalance,
        currencyCode: String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase(),
      })
    }
  }

  return {
    buildVendorAdvanceConfirmationError,
    ensurePaymentAdvanceConfirmed,
  }
}

module.exports = {
  createTransactionAccountResolutionService,
  createVendorAdvanceConfirmationHelpers,
}
