const DEFAULT_CURRENCY_MASTER = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchangeRate: 1, baseCurrency: true },
  { code: 'EUR', name: 'Euro', symbol: 'EUR', exchangeRate: 1.08, baseCurrency: false },
  { code: 'AED', name: 'UAE Dirham', symbol: 'AED', exchangeRate: 0.2723, baseCurrency: false },
  { code: 'UZS', name: 'Uzbekistan Som', symbol: 'UZS', exchangeRate: 0.000078, baseCurrency: false },
]

function createCurrencyBootstrapService({ Currency, BASE_CURRENCY_CODE }) {
  const ensureBaseCurrencyConfig = async () => {
    let base = await Currency.findOne({ baseCurrency: true, isActive: true })

    if (!base) {
      base = await Currency.findOneAndUpdate(
        { code: BASE_CURRENCY_CODE },
        {
          $set: {
            code: BASE_CURRENCY_CODE,
            name: 'US Dollar',
            symbol: '$',
            baseCurrency: true,
            exchangeRate: 1,
            isActive: true,
            rateUpdatedAt: new Date(),
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
      )
    }

    await Currency.updateMany(
      { _id: { $ne: base._id }, baseCurrency: true },
      { $set: { baseCurrency: false } }
    )

    if (String(base.exchangeRate || 1) !== '1') {
      base.exchangeRate = 1
      base.rateUpdatedAt = new Date()
      await base.save()
    }

    return base
  }

  const ensureDefaultCurrencyMaster = async () => {
    const base = await ensureBaseCurrencyConfig()
    const now = new Date()
    let createdCount = 0
    let normalizedCount = 0

    for (const preset of DEFAULT_CURRENCY_MASTER) {
      if (preset.baseCurrency) continue

      const existing = await Currency.findOne({ code: preset.code })
      if (!existing) {
        await Currency.create({
          code: preset.code,
          name: preset.name,
          symbol: preset.symbol,
          exchangeRate: preset.exchangeRate,
          baseCurrency: false,
          isActive: true,
          rateUpdatedAt: now,
        })
        createdCount += 1
        continue
      }

      let changed = false
      if (String(existing.name || '').trim() !== preset.name) {
        existing.name = preset.name
        changed = true
      }
      if (String(existing.symbol || '').trim() !== preset.symbol) {
        existing.symbol = preset.symbol
        changed = true
      }
      if (existing.baseCurrency) {
        existing.baseCurrency = false
        changed = true
      }
      if (existing.isActive !== true) {
        existing.isActive = true
        changed = true
      }
      const nextRate = Number(existing.exchangeRate || 0)
      if (!Number.isFinite(nextRate) || nextRate <= 0) {
        existing.exchangeRate = preset.exchangeRate
        changed = true
      }

      if (changed) {
        existing.rateUpdatedAt = now
        await existing.save()
        normalizedCount += 1
      }
    }

    return { base, createdCount, normalizedCount }
  }

  return {
    ensureBaseCurrencyConfig,
    ensureDefaultCurrencyMaster,
  }
}

module.exports = {
  DEFAULT_CURRENCY_MASTER,
  createCurrencyBootstrapService,
}
