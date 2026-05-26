const FIXING_REG_UNIT_PER_OZ = {
  GOZ: 1,
  GRAM: 31.1034768,
  KG: 0.0311034768,
  TOLA: 2.66667,
}

const fixingRegNormalizeUnit = (unit) => {
  const normalized = String(unit || 'GOZ').trim().toUpperCase()
  if (normalized === 'OZ' || normalized === 'OUNCE' || normalized === 'OUNCES') return 'GOZ'
  return normalized
}

const fixingRegConvertQty = (oz, unit) => oz * (FIXING_REG_UNIT_PER_OZ[fixingRegNormalizeUnit(unit)] || 1)

const fixingRegConvertRate = (pricePerOz, unit) => pricePerOz / (FIXING_REG_UNIT_PER_OZ[fixingRegNormalizeUnit(unit)] || 1)

const fixingRegConvertToOz = (qty, unit) => {
  const normalizedUnit = fixingRegNormalizeUnit(unit)
  const factor = FIXING_REG_UNIT_PER_OZ[normalizedUnit] || 1
  return Number(qty || 0) / factor
}

const fixingRegFmtQty = (oz, unit) => fixingRegConvertQty(oz, unit).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 })

const fixingRegFmtRate = (pricePerOz, unit) => fixingRegConvertRate(pricePerOz, unit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })

const fixingRegFmtAmt = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export {
  FIXING_REG_UNIT_PER_OZ,
  fixingRegNormalizeUnit,
  fixingRegConvertQty,
  fixingRegConvertRate,
  fixingRegConvertToOz,
  fixingRegFmtQty,
  fixingRegFmtRate,
  fixingRegFmtAmt,
}
