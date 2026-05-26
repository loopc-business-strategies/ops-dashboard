/**
 * VAT line resolution and automatic VAT ledger postings for metal stock vouchers.
 */

const {
  isMetalStockInType,
  isMetalStockOutType,
  isMetalStockType,
  isMetalTransferType,
} = require('../../utils/metalStockVoucherTypes')

function createVoucherVatService({
  ensureAccountByCode,
  AccountMapping,
  Ledger,
  BASE_CURRENCY_CODE,
  toMoney,
}) {
  const resolveVoucherLineVatAmount = (line = {}) => {
    const vatAmountLC = Number(line.vatAmountLC || 0)
    if (Number.isFinite(vatAmountLC) && vatAmountLC > 0) return vatAmountLC

    const vatAmountFC = Number(line.vatAmountFC || 0)
    const currRate = Number(line.currRate || 0)
    if (Number.isFinite(vatAmountFC) && vatAmountFC > 0 && Number.isFinite(currRate) && currRate > 0) {
      return vatAmountFC * currRate
    }

    const amountWithVAT = Number(line.amountWithVAT || 0)
    const totalAmount = Number(line.totalAmount || line.amountLC || 0)
    if (Number.isFinite(amountWithVAT) && Number.isFinite(totalAmount) && amountWithVAT > totalAmount) {
      return amountWithVAT - totalAmount
    }

    return 0
  }

  const resolveVoucherVatAmount = (tx) => {
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    if (!lines.length) return 0

    const total = lines.reduce((sum, line) => sum + resolveVoucherLineVatAmount(line), 0)
    return toMoney(total)
  }

  const resolveVoucherNetLineAmount = (tx) => {
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    if (!lines.length) return 0

    const total = lines.reduce((sum, line) => {
      const amount = Number(line.totalAmount || line.amountLC || line.metalAmount || 0)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)
    return toMoney(total)
  }

  const resolveVatPostingAccounts = async ({ user, tx, resolvedAccounts }) => {
    const transactionType = String(tx?.type || '').toLowerCase()

    if (isMetalStockOutType(transactionType)) {
      const mapping = await AccountMapping.findOne({ mappingType: 'vat_output', isActive: true })
        .select('debitAccountId creditAccountId')
        .lean()

      let debitAccountId = resolvedAccounts?.debitAccountId || mapping?.debitAccountId || null
      let creditAccountId = mapping?.creditAccountId || null

      if (!debitAccountId) {
        const receivable = await ensureAccountByCode({
          user,
          code: '1100',
          name: 'Accounts Receivable',
          accountType: 'Asset',
          currency: tx.currency || BASE_CURRENCY_CODE,
        })
        debitAccountId = receivable._id
      }
      if (!creditAccountId) {
        const vatPayable = await ensureAccountByCode({
          user,
          code: '2190',
          name: 'VAT Payable',
          accountType: 'Liability',
          currency: tx.currency || BASE_CURRENCY_CODE,
        })
        creditAccountId = vatPayable._id
      }

      return {
        referenceType: 'vat_output',
        debitAccountId,
        creditAccountId,
      }
    }

    if (isMetalStockInType(transactionType)) {
      const mapping = await AccountMapping.findOne({ mappingType: 'vat_input', isActive: true })
        .select('debitAccountId creditAccountId')
        .lean()

      let debitAccountId = mapping?.debitAccountId || null
      let creditAccountId = resolvedAccounts?.creditAccountId || mapping?.creditAccountId || null

      if (!debitAccountId) {
        const vatReceivable = await ensureAccountByCode({
          user,
          code: '1190',
          name: 'VAT Receivable',
          accountType: 'Asset',
          currency: tx.currency || BASE_CURRENCY_CODE,
        })
        debitAccountId = vatReceivable._id
      }
      if (!creditAccountId) {
        const payable = await ensureAccountByCode({
          user,
          code: '2000',
          name: 'Accounts Payable',
          accountType: 'Liability',
          currency: tx.currency || BASE_CURRENCY_CODE,
        })
        creditAccountId = payable._id
      }

      return {
        referenceType: 'vat_input',
        debitAccountId,
        creditAccountId,
      }
    }

    return null
  }

  const applyVoucherVatImpact = async ({ user, tx, resolvedAccounts }) => {
    const transactionType = String(tx?.type || '').toLowerCase()
    if (!isMetalStockType(transactionType) || isMetalTransferType(transactionType)) return null

    await Ledger.updateMany(
      {
        referenceType: { $in: ['vat_output', 'vat_input'] },
        referenceId: tx._id,
        isDeleted: { $ne: true },
      },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } }
    )

    const vatAmount = resolveVoucherVatAmount(tx)
    if (!Number.isFinite(vatAmount) || vatAmount <= 0) return null

    const posting = await resolveVatPostingAccounts({ user, tx, resolvedAccounts })
    if (!posting?.debitAccountId || !posting?.creditAccountId) {
      throw new Error('Unable to resolve VAT posting accounts')
    }
    if (String(posting.debitAccountId) === String(posting.creditAccountId)) {
      throw new Error('VAT posting debit and credit accounts cannot be identical')
    }

    return Ledger.create({
      date: tx.voucherMeta?.valueDate || tx.date || new Date(),
      debitAccountId: posting.debitAccountId,
      creditAccountId: posting.creditAccountId,
      amount: vatAmount,
      description: `Auto VAT ${isMetalStockOutType(transactionType) ? 'output' : 'input'} for transaction ${tx._id}`,
      referenceType: posting.referenceType,
      referenceId: tx._id,
      createdBy: user._id,
      updatedBy: user._id,
      department: user.department || tx.department || '',
      currency: tx.currency || BASE_CURRENCY_CODE,
      exchangeRate: Number(tx.exchangeRate || 1),
      notes: 'Auto VAT split from voucher line amounts.',
    })
  }

  return {
    resolveVoucherLineVatAmount,
    resolveVoucherVatAmount,
    resolveVoucherNetLineAmount,
    resolveVatPostingAccounts,
    applyVoucherVatImpact,
  }
}

module.exports = {
  createVoucherVatService,
}
