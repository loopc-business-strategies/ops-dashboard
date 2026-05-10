function createFxRevaluationService(deps) {
  const {
    parseNumber,
    toMoney,
    Ledger,
    FX_REVALUATION_EPSILON,
    appendTransactionAudit,
    Currency,
    BASE_CURRENCY_CODE,
  } = deps

  const resolveReferenceExchangeRate = (voucherMeta) => {
    const lines = Array.isArray(voucherMeta?.lineItems) ? voucherMeta.lineItems : []
    const lineReferenceRate = lines.reduce((acc, line) => {
      if (acc > 0) return acc
      const rate = Number(line?.referenceRate || 0)
      return Number.isFinite(rate) && rate > 0 ? rate : 0
    }, 0)

    const rate = Number(
      voucherMeta?.referenceExchangeRate
      || voucherMeta?.invoiceExchangeRate
      || lineReferenceRate
      || 0
    )
    if (!Number.isFinite(rate) || rate <= 0) return null
    return rate
  }

  const resolveVoucherFxLineForeignAmount = (line = {}) => {
    const amount = Number(line.amountFC || line.amountFc || line.amtFc || line.headerAmt || 0)
    return Number.isFinite(amount) && amount > 0 ? amount : 0
  }

  const resolveVoucherFxLineBaseAmount = (line = {}) => {
    const foreignAmount = resolveVoucherFxLineForeignAmount(line)
    const lineRate = Number(line?.currRate || 0)
    if (foreignAmount > 0 && Number.isFinite(lineRate) && lineRate > 0) {
      return foreignAmount * lineRate
    }

    const candidates = [line.amountLC, line.totalAmount, line.amountWithVAT, line.metalAmount]
    for (const candidate of candidates) {
      const amount = Number(candidate || 0)
      if (Number.isFinite(amount) && amount > 0) return amount
    }
    return 0
  }

  const resolvePrimaryVoucherFxLine = (voucherMeta = {}) => {
    const lines = Array.isArray(voucherMeta?.lineItems) ? voucherMeta.lineItems : []
    if (!lines.length) return {}

    return lines.find((line) => {
      const hasCurrency = String(line?.currCode || '').trim().length > 0
      const hasRate = Number(line?.currRate || 0) > 0
      const hasForeign = resolveVoucherFxLineForeignAmount(line) > 0
      const hasBase = resolveVoucherFxLineBaseAmount(line) > 0
      return hasCurrency || hasRate || hasForeign || hasBase
    }) || lines[0] || {}
  }

  const resolveVoucherFxMetrics = ({ voucherMeta = {}, txAmount = 0, fallbackRate = 0 }) => {
    const lines = Array.isArray(voucherMeta?.lineItems) ? voucherMeta.lineItems : []
    let totalForeignAmount = 0
    let totalBaseAmount = 0
    let weightedLineRateBase = 0
    let weightedLineRateWeight = 0

    lines.forEach((line) => {
      const foreignAmount = resolveVoucherFxLineForeignAmount(line)
      const baseAmount = resolveVoucherFxLineBaseAmount(line)
      const lineRate = Number(line?.currRate || 0)

      if (foreignAmount > 0) totalForeignAmount += foreignAmount
      if (baseAmount > 0) totalBaseAmount += baseAmount

      if (lineRate > 0 && foreignAmount > 0) {
        weightedLineRateBase += foreignAmount * lineRate
        weightedLineRateWeight += foreignAmount
      }
    })

    const lineRateFromTotals = totalForeignAmount > 0 && totalBaseAmount > 0
      ? totalBaseAmount / totalForeignAmount
      : 0
    const lineRateFromWeighted = weightedLineRateWeight > 0
      ? weightedLineRateBase / weightedLineRateWeight
      : 0
    const normalizedFallbackRate = Number(fallbackRate || 0)

    const lineRate = lineRateFromTotals > 0
      ? lineRateFromTotals
      : lineRateFromWeighted > 0
        ? lineRateFromWeighted
        : (Number.isFinite(normalizedFallbackRate) && normalizedFallbackRate > 0 ? normalizedFallbackRate : 0)

    const actualForeignAmount = totalForeignAmount > 0
      ? totalForeignAmount
      : (lineRate > 0 ? Number(txAmount || 0) / lineRate : 0)

    return {
      lineRate,
      totalForeignAmount,
      totalBaseAmount,
      actualForeignAmount,
    }
  }

  const getFxJournalEntriesForTransaction = async (txId) => Ledger.find({
    referenceId: txId,
    referenceType: 'journal',
    isDeleted: { $ne: true },
    description: /Exchange (gain|loss) adjustment/i,
  })
    .sort({ createdAt: 1, _id: 1 })
    .populate('debitAccountId', 'accountCode accountName')
    .populate('creditAccountId', 'accountCode accountName')

  const buildFxJournalRevaluationPreview = async (transaction) => {
    const voucherMeta = transaction?.voucherMeta || {}
    const referenceRate = parseNumber(resolveReferenceExchangeRate(voucherMeta), 0)
    if (!(referenceRate > 0)) {
      return {
        ok: false,
        message: 'Reference exchange rate is missing for this voucher.',
        transaction: {
          id: String(transaction?._id || ''),
          vocNo: voucherMeta?.vocNo || '',
          type: transaction?.type || '',
        },
        counts: { journalCount: 0, updateCandidates: 0, removeCandidates: 0, unchangedCount: 0, skippedDirectionCount: 0 },
        journals: [],
      }
    }

    const firstLine = resolvePrimaryVoucherFxLine(voucherMeta)
    const txAmount = parseNumber(transaction?.amount, 0)
    const fxMetrics = resolveVoucherFxMetrics({
      voucherMeta,
      txAmount,
      fallbackRate: firstLine.currRate || transaction?.exchangeRate || 0,
    })
    const lineRate = parseNumber(fxMetrics.lineRate, 0)
    const actualForeignAmount = parseNumber(fxMetrics.actualForeignAmount, 0)
    const expectedForeignAmount = referenceRate > 0 ? txAmount / referenceRate : 0
    const foreignDifference = actualForeignAmount - expectedForeignAmount
    const rawCorrectedAmount = Math.abs(foreignDifference) * referenceRate
    const correctedAmount = toMoney(rawCorrectedAmount)
    const isGain = String(transaction?.type || '').toLowerCase() === 'payment' ? foreignDifference < 0 : foreignDifference > 0
    const expectedDirection = isGain ? 'gain' : 'loss'

    const journals = await getFxJournalEntriesForTransaction(transaction._id)
    const previewRows = journals.map((journal) => {
      const currentAmount = toMoney(parseNumber(journal.amount, 0))
      const description = String(journal.description || '')
      const descriptionLower = description.toLowerCase()
      const journalDirection = descriptionLower.includes('exchange gain')
        ? 'gain'
        : descriptionLower.includes('exchange loss')
          ? 'loss'
          : 'unknown'
      const directionMatches = journalDirection === expectedDirection
      const deltaAmount = toMoney(correctedAmount - currentAmount)
      const needsUpdate = directionMatches
        && rawCorrectedAmount >= FX_REVALUATION_EPSILON
        && Math.abs(deltaAmount) >= FX_REVALUATION_EPSILON
      const needsRemoval = directionMatches
        && rawCorrectedAmount < FX_REVALUATION_EPSILON
        && currentAmount >= FX_REVALUATION_EPSILON

      return {
        journalId: String(journal._id),
        description,
        journalDirection,
        expectedDirection,
        directionMatches,
        currentAmount,
        correctedAmount,
        deltaAmount,
        status: directionMatches
          ? (needsUpdate ? 'update' : (needsRemoval ? 'remove' : 'unchanged'))
          : 'skipped_direction',
        debitAccount: journal.debitAccountId
          ? {
              id: String(journal.debitAccountId._id || journal.debitAccountId),
              code: journal.debitAccountId.accountCode || '',
              name: journal.debitAccountId.accountName || '',
            }
          : null,
        creditAccount: journal.creditAccountId
          ? {
              id: String(journal.creditAccountId._id || journal.creditAccountId),
              code: journal.creditAccountId.accountCode || '',
              name: journal.creditAccountId.accountName || '',
            }
          : null,
      }
    })

    return {
      ok: true,
      message: rawCorrectedAmount >= FX_REVALUATION_EPSILON
        ? 'FX journal revaluation preview generated.'
        : 'No FX difference remains after reference-rate valuation.',
      transaction: {
        id: String(transaction._id),
        vocNo: voucherMeta?.vocNo || '',
        type: transaction.type,
        status: transaction.status,
        currency: transaction.currency,
        amount: txAmount,
        lineRate,
        referenceRate,
        actualForeignAmount,
        expectedForeignAmount,
        foreignDifference,
        correctedAmount,
        expectedDirection,
      },
      counts: {
        journalCount: previewRows.length,
        updateCandidates: previewRows.filter((row) => row.status === 'update').length,
        removeCandidates: previewRows.filter((row) => row.status === 'remove').length,
        unchangedCount: previewRows.filter((row) => row.status === 'unchanged').length,
        skippedDirectionCount: previewRows.filter((row) => row.status === 'skipped_direction').length,
      },
      journals: previewRows,
    }
  }

  const applyFxJournalRevaluation = async ({ transaction, user, preview }) => {
    let updatedCount = 0
    let removedCount = 0

    for (const row of preview.journals) {
      if (row.status !== 'update') continue

      await Ledger.updateOne(
        { _id: row.journalId, isDeleted: { $ne: true } },
        {
          $set: {
            amount: row.correctedAmount,
            updatedAt: new Date(),
            updatedBy: user._id,
            notes: `FX journal revalued using reference rate ${preview.transaction.referenceRate}`,
          },
        },
      )
      updatedCount += 1
    }

    for (const row of preview.journals) {
      if (row.status !== 'remove') continue

      await Ledger.updateOne(
        { _id: row.journalId, isDeleted: { $ne: true } },
        {
          $set: {
            isDeleted: true,
            deletedAt: new Date(),
            updatedAt: new Date(),
            updatedBy: user._id,
            notes: `FX journal removed after revaluation at reference rate ${preview.transaction.referenceRate}`,
          },
        },
      )
      removedCount += 1
    }

    if (updatedCount > 0 || removedCount > 0) {
      transaction.updatedBy = user._id
      appendTransactionAudit(transaction, user, 'revalue_fx_journal', {
        fromStatus: transaction.status,
        toStatus: transaction.status,
        comment: `Revalued ${updatedCount} and removed ${removedCount} FX journal row(s) at reference rate ${preview.transaction.referenceRate}`,
      })
      await transaction.save()
    }

    return {
      ...preview,
      message: updatedCount > 0
        ? `Revalued ${updatedCount} FX journal row(s).`
        : removedCount > 0
          ? `Removed ${removedCount} stale FX journal row(s).`
          : preview.message,
      counts: {
        ...preview.counts,
        updatedCount,
        removedCount,
      },
      journals: preview.journals.map((row) => (
        row.status === 'update'
          ? { ...row, currentAmount: row.correctedAmount, deltaAmount: 0, status: 'updated' }
          : row.status === 'remove'
            ? { ...row, status: 'removed' }
            : row
      )),
    }
  }

  const validateFxReferenceRateRequirement = ({ type, currency, voucherMeta, baseCurrencyCode }) => {
    const normalizedType = String(type || '').trim().toLowerCase()
    if (!['receipt', 'payment'].includes(normalizedType)) return ''

    const txCurrency = String(currency || baseCurrencyCode || 'USD').trim().toUpperCase()
    const baseCode = String(baseCurrencyCode || BASE_CURRENCY_CODE || 'USD').trim().toUpperCase()
    if (!txCurrency || txCurrency === baseCode) return ''

    if (!resolveReferenceExchangeRate(voucherMeta)) {
      return `Reference exchange rate is required for ${normalizedType} transactions in ${txCurrency}.`
    }

    return ''
  }

  const validateFxReferenceRateForTransaction = async (tx) => {
    const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean()
    const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    return validateFxReferenceRateRequirement({
      type: tx.type,
      currency: tx.currency,
      voucherMeta: tx.voucherMeta,
      baseCurrencyCode,
    })
  }

  return {
    resolveReferenceExchangeRate,
    resolveVoucherFxLineBaseAmount,
    resolvePrimaryVoucherFxLine,
    resolveVoucherFxMetrics,
    buildFxJournalRevaluationPreview,
    applyFxJournalRevaluation,
    validateFxReferenceRateRequirement,
    validateFxReferenceRateForTransaction,
  }
}

module.exports = {
  createFxRevaluationService,
}
