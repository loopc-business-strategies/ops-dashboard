function createTransactionPostingService(deps) {
  const {
    isSuperAdmin,
    isFinance,
    Currency,
    BASE_CURRENCY_CODE,
    validateFxReferenceRateRequirement,
    Customer,
    getOutstandingForAccount,
    prepareVoucherInventoryImpact,
    resolveTransactionAccounts,
    ensurePaymentAdvanceConfirmed,
    Ledger,
    createLedgerFromTransaction,
    applyVoucherVatImpact,
    applyVoucherInventoryImpact,
    isMetalTransferType,
    appendTransactionComment,
    appendTransactionAudit,
  } = deps
  const { withSession, writeOpts } = require('../../utils/mongoTransaction')

  const executePostWorkflowAction = async ({ tx, user, note, fromStatus, options = {}, session = null }) => {
    if (!isSuperAdmin(user) && !isFinance(user)) throw new Error('Only Admin/Finance can post transactions')
    if (tx.status !== 'approved') throw new Error('Transaction must be approved before posting')

    const baseCurrency = await withSession(
      Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean(),
      session,
    )
    const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    const fxValidationMessage = validateFxReferenceRateRequirement({
      type: tx.type,
      currency: tx.currency,
      voucherMeta: tx.voucherMeta,
      baseCurrencyCode,
    })
    if (fxValidationMessage) throw new Error(fxValidationMessage)

    if (tx.type === 'sale' && tx.customerId) {
      const customer = await withSession(Customer.findById(tx.customerId), session)
      if (customer && Number(customer.creditLimit || 0) > 0 && customer.ledgerAccountId) {
        const currentOutstanding = await getOutstandingForAccount(customer.ledgerAccountId, session)
        const projected = Number(currentOutstanding || 0) + Number(tx.amount || 0)
        if (projected > Number(customer.creditLimit || 0)) {
          throw new Error(`Credit limit exceeded for customer ${customer.name}`)
        }
      }
    }

    const preparedVoucherImpact = await prepareVoucherInventoryImpact({ user, tx, session })

    const transactionType = String(tx?.type || '').toLowerCase()
    const fixingType = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || 'fixed').toLowerCase()
    const isUnfixed = ['sale', 'purchase'].includes(transactionType)
      && ['unfixed', 'non-fixing', 'nonfixing', 'non_fixing'].includes(fixingType)

    const resolved = await resolveTransactionAccounts({
      user,
      tx,
      mappingOverride: options.mappingOverride || {},
      preparedVoucherImpact,
      session,
    })
    await ensurePaymentAdvanceConfirmed({
      tx,
      resolvedAccounts: resolved,
      confirmed: Boolean(options?.mappingOverride?.confirmVendorAdvance),
      session,
    })
    tx.debitAccountId = resolved.debitAccountId
    tx.creditAccountId = resolved.creditAccountId

    const skipMainLedger = isMetalTransferType(transactionType)

    if (skipMainLedger) {
      await Ledger.updateMany(
        { referenceId: tx._id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } },
        writeOpts(session),
      )
      tx.journalEntryId = null
    }

    let ledgerEntry = null
    if (!skipMainLedger) {
      const existingMainEntries = await withSession(Ledger.find({
        referenceType: tx.type,
        referenceId: tx._id,
        isDeleted: { $ne: true },
      })
        .sort({ createdAt: 1, _id: 1 }), session)

      if (existingMainEntries.length > 1) {
        const keepEntry = existingMainEntries[existingMainEntries.length - 1]
        const staleIds = existingMainEntries
          .slice(0, -1)
          .map((entry) => entry._id)

        if (staleIds.length) {
          await Ledger.updateMany(
            { _id: { $in: staleIds } },
            { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } },
            writeOpts(session),
          )
        }

        tx.journalEntryId = keepEntry._id
      }

      if (tx.journalEntryId) {
        ledgerEntry = await withSession(Ledger.findOne({ _id: tx.journalEntryId, isDeleted: { $ne: true } }), session)
      }
      if (!ledgerEntry) {
        ledgerEntry = await withSession(Ledger.findOne({
          referenceType: tx.type,
          referenceId: tx._id,
          isDeleted: { $ne: true },
        }).sort({ createdAt: -1, _id: -1 }), session)
      }
      if (!ledgerEntry) {
        if (!isUnfixed) {
          ledgerEntry = await createLedgerFromTransaction({
            user,
            transaction: tx,
            referenceType: tx.type,
            session,
          })
        } else {
          const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
          const unfixedPremiumAmount = lines.reduce((sum, line) => {
            const premiumVal = Number(line.premiumValue || 0)
            if (!premiumVal) return sum
            const purity = Number(line.purity || 0)
            const purityRatio = purity > 1.2 ? purity / 1000 : purity
            const grossWeight = Number(line.grossWeight || 0)
            const storedPureWeight = Number(line.pureWeight || 0)
            const ozOnly = Number(line.weightInOz || 0)
            const pureFromOz = ozOnly > 0 ? ozOnly * 31.1034768 : 0
            const pureWeight = storedPureWeight > 0 ? storedPureWeight : (pureFromOz > 0 ? pureFromOz : (grossWeight * purityRatio))
            const rateType = String(line.rateType || 'OZ').trim().toUpperCase()
            const weightInOz = pureWeight / 31.1034768
            const rateQty = rateType === 'GRAM' ? pureWeight : rateType === 'KG' ? pureWeight / 1000 : weightInOz
            return sum + (premiumVal * rateQty)
          }, 0)

          const roundedPremiumImpact = Number(unfixedPremiumAmount.toFixed(2))
          const isDiscountImpact = roundedPremiumImpact < 0
          const postingAmount = Math.abs(roundedPremiumImpact)
          const debitAccountId = isDiscountImpact ? resolved.creditAccountId : resolved.debitAccountId
          const creditAccountId = isDiscountImpact ? resolved.debitAccountId : resolved.creditAccountId

          ledgerEntry = await Ledger.create([{
            date: tx.voucherMeta?.valueDate || tx.date || new Date(),
            debitAccountId,
            creditAccountId,
            amount: postingAmount,
            description: tx.description || `Unfixed ${tx.type} voucher`,
            referenceType: tx.type,
            referenceId: tx._id,
            createdBy: user._id,
            department: user.department || tx.department || '',
            currency: tx.currency || 'USD',
            exchangeRate: tx.exchangeRate || 1,
            notes: isDiscountImpact
              ? 'Unfixed voucher - discount-only ledger entry (customer credit impact).'
              : 'Unfixed voucher - premium-only ledger entry (customer debit impact).',
          }], writeOpts(session)).then((rows) => rows[0])
        }
      }

      if (!ledgerEntry?._id) {
        throw new Error(`Unable to create ledger entry for ${tx.type} voucher`)
      }
      tx.journalEntryId = ledgerEntry._id
    }

    await Ledger.updateMany(
      { referenceType: 'cogs', referenceId: tx._id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: user._id } },
      writeOpts(session),
    )

    await applyVoucherVatImpact({ user, tx, resolvedAccounts: resolved, session })
    await applyVoucherInventoryImpact({ user, tx, preparedImpact: preparedVoucherImpact, session })

    tx.status = 'posted'
    tx.postedBy = user._id
    tx.updatedBy = user._id
    appendTransactionComment(tx, user, note, 'posting_note')
    appendTransactionAudit(tx, user, 'post', { fromStatus, toStatus: 'posted', comment: note })
    await tx.save(writeOpts(session))
    return { transaction: tx, ledgerEntry }
  }

  return {
    executePostWorkflowAction,
  }
}

module.exports = {
  createTransactionPostingService,
}
