import { Fragment, useEffect, useMemo, useState } from 'react'
import erpAccountingAPI from '../../../../api/erp-accounting'
import {
  GOLD_ALLOY_KARAT_RECIPES,
  addAlloyLineByKey,
  ALLOY_METAL_LOSS_MAPPING_TYPE,
  buildAlloyMixPayload,
  buildAlloyInputStockOptionsForLine,
  buildAlloyStockOptions,
  alloyPercentToPurityFraction,
  buildAlloyLinesForFinishedGrossUpdate,
  buildAlloyLinesFromPostedMix,
  buildAlloyMixReasonBase,
  buildFinishedUpdateFormFromPosted,
  buildPostedAlloyMixListFromMovements,
  groupPostedAlloyMixes,
  computeAlloyMetalLoss,
  computeAlloyMixShare,
  computeAlloyPure,
  computeCalculatedGrossFromGoldWeight,
  createBlankAlloyMixLines,
  findFinishedAlloyProductHint,
  listAvailableAlloyLineTemplates,
  listFinishedAlloyOptionsForKarat,
  normalizeAlloyPurity,
  patchInventoryCategoryPurity,
  removeAlloyExtraLine,
  resolveKaratRecipe,
  roundAlloyGrams,
  summarizeAlloyLines,
  validateAlloyMixPost,
} from '../goldAlloyCalculator'


const fieldStyle = {
  width: '100%',
  padding: '0.45rem 0.55rem',
  borderRadius: '0.4rem',
  border: '1px solid #D1D5DB',
  fontSize: '0.88rem',
  background: '#FFFFFF',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '0.28rem',
}

const secondaryBtnStyle = {
  padding: '0.4rem 0.7rem',
  borderRadius: '0.4rem',
  border: '1px solid #D1D5DB',
  background: '#FFFFFF',
  fontWeight: 700,
  fontSize: '0.8rem',
  cursor: 'pointer',
  color: '#334155',
}

function formatAlloyMetalLoss(value) {
  const n = Number(value) || 0
  if (Math.abs(n) < 0.0005) return '0'
  const abs = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 3 })
  return n < 0 ? `-${abs}` : `+${abs}`
}

export default function ERPGoldAlloyTab({
  activeTab,
  C = {},
  inventoryProducts = [],
  mappings = [],
  loadInventory,
  token,
  tenantKey = '',
  showNotification,
  setError,
}) {
  const [karat, setKarat] = useState('')
  const [goldRatio, setGoldRatio] = useState('')
  const [alloyRatio, setAlloyRatio] = useState('')
  const [goldInput, setGoldInput] = useState('')
  const [targetGross, setTargetGross] = useState('')
  const [lines, setLines] = useState(() => createBlankAlloyMixLines())
  const [finishedProductId, setFinishedProductId] = useState('')
  const [posting, setPosting] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [newMixOpen, setNewMixOpen] = useState(false)
  const [postedMixes, setPostedMixes] = useState([])
  const [postedMixesLoading, setPostedMixesLoading] = useState(false)
  const [mixActionId, setMixActionId] = useState('')
  const [updateOpen, setUpdateOpen] = useState(false)
  const [updatePosted, setUpdatePosted] = useState(null)
  const [updateFinishedGross, setUpdateFinishedGross] = useState('')
  const [updateFinishedPurityPct, setUpdateFinishedPurityPct] = useState('')
  const [updateOriginalFinishedGross, setUpdateOriginalFinishedGross] = useState(0)
  const [updateMetalLines, setUpdateMetalLines] = useState([])
  const [updating, setUpdating] = useState(false)
  const [editingPosted, setEditingPosted] = useState(null)
  const [viewPosted, setViewPosted] = useState(null)
  const postingEnabled = String(tenantKey || '').toLowerCase() === 'mg'

  useEffect(() => {
    if (activeTab !== 'gold-alloy' || !token || typeof loadInventory !== 'function') return
    Promise.resolve(loadInventory()).catch(() => {})
  }, [activeTab, token, loadInventory])

  const reloadPostedMixes = async () => {
    if (!token) return
    setPostedMixesLoading(true)
    try {
      // includeDeleted so prior Posted rows remain after Update reverse+repost.
      const data = await erpAccountingAPI.getStockLedger(token, {
        includeDeleted: 1,
        alloyOnly: 1,
        limit: 200,
      })
      setPostedMixes(buildPostedAlloyMixListFromMovements(data?.movements || []))
    } catch {
      setPostedMixes([])
    } finally {
      setPostedMixesLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab !== 'gold-alloy' || !token) return
    let cancelled = false
    setPostedMixesLoading(true)
    erpAccountingAPI.getStockLedger(token, {
      includeDeleted: 1,
      alloyOnly: 1,
      limit: 200,
    })
      .then((data) => {
        if (cancelled) return
        setPostedMixes(buildPostedAlloyMixListFromMovements(data?.movements || []))
      })
      .catch(() => {
        if (!cancelled) setPostedMixes([])
      })
      .finally(() => {
        if (!cancelled) setPostedMixesLoading(false)
      })
    return () => { cancelled = true }
  }, [activeTab, token])

  const stockOptions = useMemo(
    () => buildAlloyStockOptions(inventoryProducts),
    [inventoryProducts],
  )

  const postedMixGroups = useMemo(
    () => groupPostedAlloyMixes(postedMixes),
    [postedMixes],
  )

  const finishedOptions = useMemo(
    () => listFinishedAlloyOptionsForKarat(karat, stockOptions),
    [karat, stockOptions],
  )

  // Keep selected finished product aligned with karat (14K → 14K alloy inventory, etc.).
  useEffect(() => {
    if (!karat) return
    const hint = findFinishedAlloyProductHint(karat, stockOptions)
    if (!hint.id) return
    const stillValid = finishedOptions.some((row) => String(row.id) === String(finishedProductId))
    if (!finishedProductId || !stillValid) {
      setFinishedProductId(hint.id)
    }
  }, [karat, stockOptions, finishedOptions, finishedProductId])

  const finishedHint = useMemo(
    () => (karat ? findFinishedAlloyProductHint(karat, stockOptions) : {
      id: '',
      message: 'Select karat, gold input, stocks, and finished product to build a new mix.',
    }),
    [karat, stockOptions],
  )

  const summary = useMemo(
    () => summarizeAlloyLines(lines, targetGross),
    [lines, targetGross],
  )

  // Mix calc gross from gold input ÷ karat gold ratio (e.g. 75 @ 18K → 100). Also the post target.
  const calculatedMixGross = useMemo(() => {
    const fromField = computeCalculatedGrossFromGoldWeight(goldInput, goldRatio)
    if (fromField) return fromField
    const goldLine = (lines || []).find((line) => line.role === 'gold')
    return computeCalculatedGrossFromGoldWeight(goldLine?.gross, goldRatio)
  }, [goldInput, lines, goldRatio])

  // While editing a posted mix, credit back its consumed qty for the stock check
  // (reverse will restore that stock before the new post).
  const stockOptionsForPost = useMemo(() => {
    if (!editingPosted) return stockOptions
    const credits = new Map(
      (editingPosted.consumed || []).map((row) => [String(row.itemId || ''), Number(row.gross) || 0]),
    )
    return stockOptions.map((row) => {
      const credit = credits.get(String(row.id)) || 0
      if (!credit) return row
      return { ...row, quantity: Number(row.quantity || 0) + credit }
    })
  }, [stockOptions, editingPosted])

  const postCheck = useMemo(
    () => validateAlloyMixPost({
      karat,
      targetGross,
      lines,
      finishedProductId,
      stockOptions: stockOptionsForPost,
    }),
    [karat, targetGross, lines, finishedProductId, stockOptionsForPost],
  )

  const availableLineTemplates = useMemo(
    () => listAvailableAlloyLineTemplates(lines, { stockOptions }),
    [lines, stockOptions],
  )

  const syncGoldInputToLinesAndTarget = (nextGoldInput, nextGoldRatio = goldRatio) => {
    const goldGross = nextGoldInput
    const calc = computeCalculatedGrossFromGoldWeight(goldGross, nextGoldRatio)
    setGoldInput(nextGoldInput)
    if (calc) setTargetGross(calc)
    else if (nextGoldInput === '' || nextGoldInput == null) setTargetGross('')
    setLines((prev) => prev.map((line) => {
      if (line.role !== 'gold') return line
      const purity = line.purity === '' || line.purity == null ? '1' : line.purity
      return {
        ...line,
        gross: goldGross,
        pure: computeAlloyPure(goldGross, purity),
      }
    }))
  }

  const resetNewMix = () => {
    setKarat('')
    setGoldRatio('')
    setAlloyRatio('')
    setGoldInput('')
    setTargetGross('')
    setLines(createBlankAlloyMixLines())
    setFinishedProductId('')
    setAddMenuOpen(false)
    setEditingPosted(null)
  }

  const closeUpdateDialogState = () => {
    setUpdateOpen(false)
    setUpdatePosted(null)
    setUpdateFinishedGross('')
    setUpdateFinishedPurityPct('')
    setUpdateOriginalFinishedGross(0)
    setUpdateMetalLines([])
  }

  const closeNewMixDialog = () => {
    if (posting) return
    resetNewMix()
    setNewMixOpen(false)
  }

  const openNewMixDialog = () => {
    if (!postingEnabled) {
      if (typeof setError === 'function') setError('Gold alloy posting is MG-only')
      return
    }
    setViewPosted(null)
    if (updateOpen) closeUpdateDialogState()
    resetNewMix()
    setNewMixOpen(true)
  }

  const openEditPostedMix = (posted) => {
    if (!postingEnabled) {
      if (typeof setError === 'function') setError('Gold alloy posting is MG-only')
      return
    }
    if (!posted?.reason) {
      if (typeof setError === 'function') setError('This mix cannot be edited (missing reason)')
      return
    }
    // Always open the Edit dialog for Edit — never fall through to New mix.
    setViewPosted(null)
    if (updateOpen) closeUpdateDialogState()
    const recipe = resolveKaratRecipe(posted.karat)
    const nextLines = buildAlloyLinesFromPostedMix(posted)
    const goldLine = nextLines.find((line) => line.role === 'gold')
    const nextGoldInput = goldLine?.gross != null && goldLine.gross !== ''
      ? String(goldLine.gross)
      : ''
    setKarat(posted.karat || '')
    setGoldRatio(recipe ? recipe.goldRatio : '')
    setAlloyRatio(recipe ? recipe.alloyRatio : '')
    setGoldInput(nextGoldInput)
    setTargetGross(
      posted.targetGross != null && posted.targetGross !== ''
        ? String(posted.targetGross)
        : (computeCalculatedGrossFromGoldWeight(nextGoldInput, recipe?.goldRatio) || ''),
    )
    setFinishedProductId(String(posted.finishedProductId || ''))
    setLines(nextLines)
    setEditingPosted(posted)
    setNewMixOpen(true)
    if (typeof showNotification === 'function') {
      showNotification(
        posted.isHistory
          ? `Editing prior ${posted.karat ? `${posted.karat}K ` : ''}${posted.targetGross || ''} g — inventory already restored; post to create again`
          : `Editing ${posted.karat ? `${posted.karat}K ` : ''}${posted.targetGross || ''} g — change the form, then post to replace this mix`,
      )
    }
  }

  const openViewPostedMix = (posted) => {
    if (!posted) return
    // View only — close Edit / Update so the correct popup is alone.
    if (posting) return
    if (newMixOpen) {
      resetNewMix()
      setNewMixOpen(false)
    }
    if (updateOpen) closeUpdateDialogState()
    setViewPosted(posted)
  }

  const closeViewPostedMix = () => setViewPosted(null)

  const onKaratChange = (value) => {
    const nextKarat = value === '' ? '' : Number(value)
    setKarat(nextKarat === '' ? '' : nextKarat)
    const recipe = resolveKaratRecipe(nextKarat)
    if (!recipe) {
      setGoldRatio('')
      setAlloyRatio('')
      return
    }
    // Ratios fill from karat; gold input → calc mix target.
    setGoldRatio(recipe.goldRatio)
    setAlloyRatio(recipe.alloyRatio)
    const hint = findFinishedAlloyProductHint(nextKarat, stockOptions)
    setFinishedProductId(hint.id || '')
    if (goldInput !== '' && goldInput != null) {
      const calc = computeCalculatedGrossFromGoldWeight(goldInput, recipe.goldRatio)
      if (calc) setTargetGross(calc)
    }
  }

  const onGoldInputChange = (value) => {
    syncGoldInputToLinesAndTarget(value, goldRatio)
  }

  const onGoldRatioChange = (value) => {
    setGoldRatio(value)
    if (goldInput !== '' && goldInput != null) {
      const calc = computeCalculatedGrossFromGoldWeight(goldInput, value)
      if (calc) setTargetGross(calc)
      else setTargetGross('')
    }
  }

  const onAlloyRatioChange = (value) => {
    setAlloyRatio(value)
  }

  const updateLine = (key, patch) => {
    setLines((prev) => {
      const nextLines = prev.map((line) => {
        if (line.key !== key) return line
        const next = { ...line, ...patch }
        if (Object.prototype.hasOwnProperty.call(patch, 'gross') || Object.prototype.hasOwnProperty.call(patch, 'purity')) {
          next.pure = computeAlloyPure(next.gross, next.purity)
        }
        return next
      })
      const touched = nextLines.find((line) => line.key === key)
      if (touched?.role === 'gold' && Object.prototype.hasOwnProperty.call(patch, 'gross')) {
        const calc = computeCalculatedGrossFromGoldWeight(patch.gross, goldRatio)
        setGoldInput(patch.gross === '' || patch.gross == null ? '' : String(patch.gross))
        if (calc) setTargetGross(calc)
        else if (patch.gross === '' || patch.gross == null) setTargetGross('')
      }
      return nextLines
    })
  }

  const onStockChange = (key, stockId) => {
    const option = stockOptions.find((row) => row.id === stockId)
    const line = lines.find((row) => row.key === key)
    const purity = line?.role === 'gold'
      ? '1'
      : (option?.purity || line?.purity || '1')
    updateLine(key, {
      stockId: stockId || '',
      stockLabel: option?.name || '',
      purity: stockId ? purity : (line?.role === 'extra' ? '' : '1'),
    })
  }

  const addRow = (templateKey) => {
    if (!templateKey) return
    setLines((prev) => {
      const next = addAlloyLineByKey(prev, templateKey)
      if (templateKey !== 'gold' || goldInput === '' || goldInput == null) return next
      return next.map((line) => {
        if (line.role !== 'gold') return line
        const purity = line.purity === '' || line.purity == null ? '1' : line.purity
        return {
          ...line,
          gross: goldInput,
          pure: computeAlloyPure(goldInput, purity),
        }
      })
    })
    if (templateKey === 'gold' && goldInput !== '' && goldInput != null) {
      const calc = computeCalculatedGrossFromGoldWeight(goldInput, goldRatio)
      if (calc) setTargetGross(calc)
    }
    setAddMenuOpen(false)
  }

  const removeRow = (key) => {
    setLines((prev) => removeAlloyExtraLine(prev, key))
  }

  const updateFinishedPure = useMemo(() => {
    const gross = Number(updateFinishedGross)
    const frac = normalizeAlloyPurity(updateFinishedPurityPct)
    if (!(gross > 0) || !(frac > 0)) return 0
    return roundAlloyGrams(gross * frac)
  }, [updateFinishedGross, updateFinishedPurityPct])

  // Update dialog uses purity as fraction (0.75), not percent (75).
  const clampPurityFractionInput = (raw) => {
    if (raw === '' || raw == null) return ''
    const text = String(raw)
    if (text === '.' || text === '0.' || /^0\.\d*$/.test(text) || /^\d\.\d*$/.test(text)) {
      const n = Number(text)
      if (text.endsWith('.') || text === '.') return text
      if (!Number.isFinite(n)) return text
      if (n > 1) return '1'
      if (n < 0) return '0'
      return text
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) return text
    const frac = n > 1.2 ? n / 100 : n
    if (frac > 1) return '1'
    if (frac < 0) return '0'
    return String(roundAlloyGrams(frac, 6))
  }

  const buildUpdateMetalLinesFromPosted = (posted, targetGross, previousLines = []) => {
    const scaled = buildAlloyLinesForFinishedGrossUpdate(posted, {
      targetGross: targetGross !== '' && targetGross != null ? targetGross : posted?.targetGross,
    })
    const consumed = Array.isArray(posted?.consumed) ? posted.consumed : []
    return scaled.map((line) => {
      const prev = (previousLines || []).find((row) => (
        row.key === line.key || String(row.stockId) === String(line.stockId)
      ))
      const option = stockOptions.find((row) => String(row.id) === String(line.stockId))
      const originalFromPosted = Number(
        consumed.find((row) => (
          String(row.itemId) === String(line.stockId)
          || String(row.key || '') === String(line.key)
        ))?.gross || 0,
      )
      const gross = line.gross !== '' && line.gross != null ? line.gross : (prev?.gross || '')
      // Update-voucher "purity" = mix share (gross ÷ allowed wt), e.g. 0.75 / 0.13 / 0.11
      const share = computeAlloyMixShare(gross, targetGross)
      const metalPurity = String(normalizeAlloyPurity(option?.purity || line.purity || '1') || 1)
      return {
        ...line,
        stockLabel: line.stockLabel || option?.name || prev?.stockLabel || line.label || '',
        originalGross: prev?.originalGross != null ? Number(prev.originalGross) : originalFromPosted,
        gross,
        purityPercent: share || prev?.purityPercent || '',
        metalPurity,
        pure: computeAlloyPure(gross, metalPurity),
      }
    })
  }

  const updateMetalLossTotal = useMemo(() => {
    const finishedLoss = computeAlloyMetalLoss(updateFinishedGross, updateOriginalFinishedGross)
    const metalsLoss = roundAlloyGrams(
      (updateMetalLines || []).reduce((sum, line) => (
        sum + computeAlloyMetalLoss(line.gross, line.originalGross)
      ), 0),
    )
    return {
      finished: finishedLoss,
      metals: metalsLoss,
    }
  }, [updateFinishedGross, updateOriginalFinishedGross, updateMetalLines])

  // Remaining metals in the bar must equal Allowed wt. Oxidation = original − remaining.
  const updateMixBalance = useMemo(() => {
    const target = Number(updateFinishedGross) || 0
    const shareSum = roundAlloyGrams(
      (updateMetalLines || []).reduce((sum, line) => sum + (Number(line.purityPercent) || 0), 0),
      6,
    )
    const metalGross = roundAlloyGrams(
      (updateMetalLines || []).reduce((sum, line) => sum + (Number(line.gross) || 0), 0),
    )
    const originalMetalGross = roundAlloyGrams(
      (updateMetalLines || []).reduce((sum, line) => {
        const original = Number(line.originalGross)
        const gross = Number(line.gross) || 0
        return sum + (Number.isFinite(original) && original > 0 ? original : gross)
      }, 0),
    )
    const diff = target > 0 ? roundAlloyGrams(metalGross - target) : 0
    const oxidationLoss = roundAlloyGrams(originalMetalGross - metalGross)
    const balanced = target > 0 && Math.abs(diff) <= 0.0005
    return {
      target,
      shareSum,
      metalGross,
      originalMetalGross,
      oxidationLoss,
      diff,
      balanced,
      message: !target
        ? 'Enter allowed gross weight'
        : balanced
          ? ''
          : metalGross + 0.0005 < target
            ? `Metals remaining ${metalGross} g are below Allowed wt ${target} g. `
              + `For oxidation, set Allowed wt to ${metalGross} g — loss posts to Metal Loss.`
            : `Need metals = finished (now ${metalGross} g vs ${target} g). `
              + `Lower shares or raise Allowed wt (share sum ${shareSum}).`,
    }
  }, [updateFinishedGross, updateMetalLines])

  const alloyMetalLossMapping = useMemo(() => (
    (Array.isArray(mappings) ? mappings : []).find((row) => (
      row?.isActive !== false
      && String(row?.mappingType || '').trim().toLowerCase() === ALLOY_METAL_LOSS_MAPPING_TYPE
    )) || null
  ), [mappings])

  const updateAchievedKarat = useMemo(() => {
    const frac = normalizeAlloyPurity(updateFinishedPurityPct)
    if (!(frac > 0)) return ''
    return roundAlloyGrams(frac * 24, 1)
  }, [updateFinishedPurityPct])

  const onUpdateFinishedGrossChange = (value) => {
    setUpdateFinishedGross(value)
    if (!updatePosted) return
    setUpdateMetalLines((prev) => buildUpdateMetalLinesFromPosted(updatePosted, value, prev))
  }

  const patchUpdateMetalLine = (key, patch) => {
    const finished = Number(updateFinishedGross)
    setUpdateMetalLines((prev) => {
      const nextLines = prev.map((line) => {
        if (line.key !== key) return line
        const next = { ...line, ...patch }
        const purityPercent = Object.prototype.hasOwnProperty.call(patch, 'purityPercent')
          ? patch.purityPercent
          : next.purityPercent
        next.purityPercent = purityPercent
        // Mix share drives metal gross: share × finished allowed wt.
        if (Object.prototype.hasOwnProperty.call(patch, 'purityPercent')) {
          const share = Number(purityPercent)
          if (share > 0 && finished > 0) {
            next.gross = roundAlloyGrams(share * finished)
          }
        } else if (Object.prototype.hasOwnProperty.call(patch, 'gross')) {
          next.gross = patch.gross
        }
        next.pure = computeAlloyPure(next.gross, next.metalPurity || '1')
        return next
      })
      return nextLines
    })
  }

  const reversePostedMix = async (posted, { skipConfirm = false } = {}) => {
    const reason = String(posted?.reason || '').trim()
    if (!reason) {
      if (typeof setError === 'function') setError('Cannot reverse mix: missing reason')
      return false
    }
    const label = `${posted?.karat ? `${posted.karat}K ` : ''}${posted?.targetGross || ''} g → ${posted?.finishedName || 'finished'}`
    if (!skipConfirm) {
      const ok = window.confirm(`Delete this posted mix and restore inventory?\n\n${label}`)
      if (!ok) return false
    }
    try {
      setMixActionId(posted.id)
      await erpAccountingAPI.reverseAlloyMix(token, { reason })
      if (typeof loadInventory === 'function') await loadInventory()
      await reloadPostedMixes()
      return true
    } catch (err) {
      if (typeof setError === 'function') {
        setError(err.response?.data?.message || err.message || 'Failed to reverse alloy mix')
      }
      return false
    } finally {
      setMixActionId('')
    }
  }

  const openUpdatePostedMix = (posted) => {
    if (!postingEnabled) {
      if (typeof setError === 'function') setError('Gold alloy posting is MG-only')
      return
    }
    if (!posted?.reason || !posted?.finishedProductId) {
      if (typeof setError === 'function') setError('This mix cannot be updated (missing finished product or reason)')
      return
    }
    // Update only — close View / Edit so the correct popup is alone.
    setViewPosted(null)
    if (newMixOpen) {
      resetNewMix()
      setNewMixOpen(false)
    }
    setEditingPosted(null)
    setUpdatePosted(posted)
    const form = buildFinishedUpdateFormFromPosted(posted, stockOptions)
    setUpdateFinishedGross(form.gross)
    setUpdateFinishedPurityPct(
      alloyPercentToPurityFraction(form.purityPercent)
      || String(normalizeAlloyPurity(form.purityPercent) || ''),
    )
    setUpdateOriginalFinishedGross(Number(posted?.targetGross || form.gross || 0))
    setUpdateMetalLines(buildUpdateMetalLinesFromPosted(posted, form.gross, []))
    setUpdateOpen(true)
  }

  const closeUpdateDialog = () => {
    if (updating) return
    closeUpdateDialogState()
  }

  const submitUpdatePostedMix = async () => {
    if (!updatePosted || updating) return
    const finishedFrac = normalizeAlloyPurity(updateFinishedPurityPct)
    if (!(finishedFrac > 0)) {
      if (typeof setError === 'function') setError('Enter finished purity as a fraction (e.g. 0.75 for 18K)')
      return
    }
    if (finishedFrac > 1) {
      if (typeof setError === 'function') setError('Finished purity cannot be more than 1')
      return
    }
    const active = (updateMetalLines || []).filter((line) => (
      String(line.stockId || '').trim() && Math.abs(Number(line.gross || 0)) > 0.0005
    )).map((line) => ({
      ...line,
      // Mix share is display-only; consume still uses catalog metal purity.
      purity: String(normalizeAlloyPurity(line.metalPurity || line.purity || '1') || 1),
      pure: computeAlloyPure(line.gross, line.metalPurity || line.purity || '1'),
    }))
    if (!active.length) {
      if (typeof setError === 'function') setError('Enter gross weight on at least one metal')
      return
    }
    for (const line of active) {
      const share = Number(line.purityPercent)
      if (!(share > 0)) {
        if (typeof setError === 'function') {
          setError(`Enter mix share for ${line.stockLabel || line.label} (e.g. 0.75)`)
        }
        return
      }
    }
    const nextTarget = Number(updateFinishedGross) > 0
      ? roundAlloyGrams(Number(updateFinishedGross))
      : roundAlloyGrams(active.reduce((sum, line) => sum + Number(line.gross || 0), 0))
    if (!(nextTarget > 0)) {
      if (typeof setError === 'function') setError('Enter finished gross weight (g)')
      return
    }
    const metalGross = roundAlloyGrams(
      active.reduce((sum, line) => sum + Number(line.gross || 0), 0),
    )
    const balanceDiff = roundAlloyGrams(metalGross - nextTarget)
    if (Math.abs(balanceDiff) > 0.0005) {
      if (typeof setError === 'function') {
        setError(
          `Metals remaining must equal Allowed wt (${metalGross} g vs ${nextTarget} g). `
          + `For oxidation, set Allowed wt to ${metalGross} g.`,
        )
      }
      return
    }
    const originalMetalGross = roundAlloyGrams(
      active.reduce((sum, line) => {
        const original = Number(line.originalGross)
        const gross = Number(line.gross) || 0
        return sum + (Number.isFinite(original) && original > 0 ? original : gross)
      }, 0),
    )
    const historyOnly = Boolean(updatePosted.isHistory)
    for (const line of active) {
      const option = stockOptions.find((row) => row.id === line.stockId)
      // Active update reverses first — credit current consume. History is already reversed.
      const postedGross = historyOnly
        ? 0
        : Number(
          (updatePosted.consumed || []).find((row) => String(row.itemId) === String(line.stockId))?.gross || 0,
        )
      const onHand = Number(option?.quantity || 0) + postedGross
      const remain = Number(line.gross || 0)
      const original = Number(line.originalGross)
      const need = Number.isFinite(original) && original > remain + 0.0005 ? original : remain
      if (onHand + 0.0005 < need) {
        if (typeof setError === 'function') {
          setError(`Insufficient stock for ${option?.name || line.label}. Available ~${onHand} g, need ${need} g`)
        }
        return
      }
    }

    try {
      setUpdating(true)

      const catalogProducts = Array.isArray(inventoryProducts) ? inventoryProducts : []
      const finishedProduct = catalogProducts
        .find((row) => String(row._id || row.id) === String(updatePosted.finishedProductId))
      const currentFrac = normalizeAlloyPurity(
        stockOptions.find((row) => String(row.id) === String(updatePosted.finishedProductId))?.purity,
      )
      const nextFrac = finishedFrac
      if (
        finishedProduct
        && nextFrac > 0
        && Math.abs(currentFrac - nextFrac) > 0.00005
      ) {
        await erpAccountingAPI.updateInventoryProduct(token, updatePosted.finishedProductId, {
          category: patchInventoryCategoryPurity(finishedProduct.category, nextFrac),
        })
      }

      if (!historyOnly) {
        const reversed = await reversePostedMix(updatePosted, { skipConfirm: true })
        if (!reversed) return
      }

      const payload = buildAlloyMixPayload({
        karat: updatePosted.karat,
        targetGross: nextTarget,
        finishedProductId: updatePosted.finishedProductId,
        lines: active,
        description: buildAlloyMixReasonBase({
          karat: updatePosted.karat,
          targetGross: nextTarget,
          status: 'updated',
        }),
      })
      const result = await erpAccountingAPI.postAlloyMix(token, payload)
      if (typeof showNotification === 'function') {
        const lossPart = Number(result?.metalLossGross) > 0
          ? ` · metal loss ${result.metalLossGross} g → ${ALLOY_METAL_LOSS_MAPPING_TYPE}`
          : ''
        showNotification(
          `✅ Mix updated: ${result?.finishedProduct?.name || updatePosted.finishedName} → ${result?.targetGross || nextTarget} g · purity ${finishedFrac}${lossPart}`,
        )
      }
      if (typeof loadInventory === 'function') await loadInventory()
      await reloadPostedMixes()
      setUpdateOpen(false)
      setUpdatePosted(null)
      setUpdateFinishedGross('')
      setUpdateFinishedPurityPct('')
      setUpdateOriginalFinishedGross(0)
      setUpdateMetalLines([])
    } catch (err) {
      if (typeof setError === 'function') {
        setError(err.response?.data?.message || err.message || 'Failed to update alloy mix')
      }
      await reloadPostedMixes()
    } finally {
      setUpdating(false)
    }
  }

  const onDeletePostedMix = async (posted) => {
    if (!postingEnabled) {
      if (typeof setError === 'function') setError('Gold alloy posting is MG-only')
      return
    }
    if (posted?.isHistory) {
      if (typeof showNotification === 'function') {
        showNotification('ℹ️ Prior history is already reversed — inventory was restored. Use Edit / Update to post again.')
      }
      return
    }
    const removed = await reversePostedMix(posted, { skipConfirm: false })
    if (removed && typeof showNotification === 'function') {
      showNotification('🗑️ Mix deleted and inventory restored')
    }
  }

  const submitPost = async () => {
    if (!postingEnabled) {
      if (typeof setError === 'function') setError('Gold alloy posting is MG-only')
      return
    }
    if (!postCheck.ok) {
      if (typeof setError === 'function') setError(postCheck.message)
      return
    }
    try {
      setPosting(true)
      // Active Edit reverses first. History Edit is already reversed — skip reverse.
      if (editingPosted && !editingPosted.isHistory) {
        const reversed = await reversePostedMix(editingPosted, { skipConfirm: true })
        if (!reversed) return
      }
      // Edit = reverse + replace as a normal posted mix (never tag as "updated").
      // Update dialog alone uses status "updated" for metal-loss versions.
      const payload = buildAlloyMixPayload({
        karat,
        targetGross,
        finishedProductId,
        lines,
        ...(editingPosted
          ? {
            description: buildAlloyMixReasonBase({
              karat,
              targetGross,
              status: 'posted',
            }),
          }
          : {}),
      })
      const result = await erpAccountingAPI.postAlloyMix(token, payload)
      if (typeof showNotification === 'function') {
        showNotification(
          editingPosted
            ? `✅ Mix edited: ${result?.finishedProduct?.name || 'finished'} → ${result?.targetGross || payload.targetGross} g`
            : `✅ Alloy mix posted: ${result?.finishedProduct?.name || 'finished'} +${result?.targetGross || payload.targetGross} g`,
        )
      }
      if (typeof loadInventory === 'function') await loadInventory()
      await reloadPostedMixes()
      resetNewMix()
      setNewMixOpen(false)
    } catch (err) {
      if (typeof setError === 'function') {
        setError(err.response?.data?.message || err.message || 'Failed to post alloy mix')
      }
      await reloadPostedMixes()
    } finally {
      setPosting(false)
    }
  }

  if (activeTab !== 'gold-alloy') return null

  const goldRatioFraction = Number(goldRatio) > 0
    ? roundAlloyGrams(Number(goldRatio) / 100, 4)
    : ''
  const alloyRatioFraction = Number(alloyRatio) > 0
    ? roundAlloyGrams(Number(alloyRatio) / 100, 4)
    : ''

  return (
    <div style={{ padding: '1rem 1.15rem 1.5rem', maxWidth: 980 }}>
      <div style={{
        marginBottom: '1rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.75rem',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      }}
      >
        <div>
          <h2 style={{ margin: 0, color: C.ink || '#111827', fontSize: '1.35rem', fontWeight: 800 }}>Gold Alloy</h2>
          <p style={{ margin: '0.35rem 0 0', color: C.inkSoft || '#64748B', fontSize: '0.88rem', lineHeight: 1.45 }}>
            Open <strong>New mix</strong> to enter karat, target gross, and stocks. Posted mixes stay below.
          </p>
        </div>
        <button
          type="button"
          onClick={openNewMixDialog}
          disabled={!postingEnabled}
          style={{
            padding: '0.5rem 0.95rem',
            borderRadius: '0.45rem',
            border: 'none',
            background: postingEnabled ? '#EA580C' : '#CBD5E1',
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: postingEnabled ? 'pointer' : 'not-allowed',
          }}
        >
          + New mix
        </button>
      </div>

      <div style={{
        border: '1px solid #E5E7EB',
        borderRadius: '0.65rem',
        background: '#FFFFFF',
        overflow: 'hidden',
      }}
      >
        <div style={{
          padding: '0.75rem 0.9rem',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 800, color: C.ink || '#111827', fontSize: '0.95rem' }}>
              Posted mixes
            </p>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: '#64748B' }}>
              Posted and Updated versions of the same finished product are grouped and linked. View / Edit / Update / Delete on every row.
            </p>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: 700 }}>
            {postedMixesLoading
              ? 'Loading…'
              : `${postedMixGroups.length} group${postedMixGroups.length === 1 ? '' : 's'} · ${postedMixes.length} mix${postedMixes.length === 1 ? '' : 'es'}`}
          </span>
        </div>
        {!postedMixesLoading && postedMixes.length > 0 && postedMixes.every((row) => row.isHistory) ? (
          <div style={{
            margin: '0.65rem 0.9rem 0',
            padding: '0.55rem 0.7rem',
            borderRadius: '0.4rem',
            border: '1px solid #FDE68A',
            background: '#FFFBEB',
            color: '#92400E',
            fontSize: '0.78rem',
            fontWeight: 600,
            lineHeight: 1.45,
          }}
          >
            No active mix — only prior history. Inventory is already restored. Use <strong>Edit</strong> /
            <strong> Update</strong> on a prior row, or <strong>+ New mix</strong>.
          </div>
        ) : null}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B' }}>When</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B' }}>Status</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B' }}>Karat</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B', textAlign: 'right' }}>Target</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B', textAlign: 'right' }}>Metal loss</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B' }}>Finished (IN)</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B' }}>Inputs (OUT)</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B' }}>By</th>
                {postingEnabled ? (
                  <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.75rem', color: '#64748B', textAlign: 'right' }}>Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {!postedMixesLoading && !postedMixes.length ? (
                <tr>
                  <td colSpan={postingEnabled ? 9 : 8} style={{ padding: '1rem 0.75rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.85rem' }}>
                    No posted mixes yet. Click + New mix to create one.
                  </td>
                </tr>
              ) : null}
              {postedMixGroups.map((group) => {
                const groupTitle = [
                  group.karat ? `${group.karat}K` : null,
                  group.finishedName || 'Alloy mix',
                ].filter(Boolean).join(' · ')
                const versionCount = group.rows.length
                return (
                  <Fragment key={group.id}>
                    {versionCount > 1 ? (
                      <tr style={{ background: '#FFF7ED' }}>
                        <td
                          colSpan={postingEnabled ? 9 : 8}
                          style={{
                            padding: '0.45rem 0.75rem',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: '#9A3412',
                            borderTop: '1px solid #FED7AA',
                          }}
                        >
                          Linked mix group · {groupTitle}
                          <span style={{ fontWeight: 600, color: '#C2410C', marginLeft: '0.55rem' }}>
                            · {versionCount} versions (Posted → Updated)
                          </span>
                        </td>
                      </tr>
                    ) : null}
                    {group.rows.map((row, rowIndex) => {
                      const whenLabel = row.at
                        ? new Date(row.at).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : '—'
                      const busy = mixActionId === row.id
                      const isUpdated = String(row.status || '').toLowerCase() === 'updated'
                      const isHistory = Boolean(row.isHistory)
                      const statusLabel = isUpdated ? 'Updated' : 'Posted'
                      const canAct = postingEnabled
                      const linkNote = row.isGroupHead
                        ? (isHistory ? 'Latest history' : (isUpdated ? 'Current updated' : 'Current posted'))
                        : (isUpdated ? 'Prior update · linked' : 'Original post · linked')
                      // Compare to the next older version in this linked group (Posted → Updated).
                      const priorRow = group.rows[rowIndex + 1] || null
                      const showMetalLoss = Boolean(priorRow) && (
                        isUpdated || Number(row.targetGross) !== Number(priorRow.targetGross)
                      )
                      const finishedLoss = showMetalLoss
                        ? computeAlloyMetalLoss(row.targetGross, priorRow.targetGross)
                        : 0
                      const inputLossByKey = new Map()
                      if (showMetalLoss) {
                        ;(row.consumed || []).forEach((item) => {
                          const priorGross = Number(
                            (priorRow.consumed || []).find((c) => (
                              String(c.itemId || '') === String(item.itemId || '')
                              || String(c.name || '') === String(item.name || '')
                            ))?.gross || 0,
                          )
                          inputLossByKey.set(
                            String(item.itemId || item.name || ''),
                            computeAlloyMetalLoss(item.gross, priorGross),
                          )
                        })
                      }
                      return (
                        <tr
                          key={row.id}
                          style={{
                            borderTop: '1px solid #F1F5F9',
                            background: row.linkedPrior
                              ? '#F8FAFC'
                              : (isHistory ? '#F8FAFC' : '#FFFFFF'),
                            opacity: isHistory ? 0.94 : 1,
                          }}
                        >
                          <td style={{
                            padding: '0.6rem 0.75rem',
                            fontSize: '0.82rem',
                            color: isHistory ? '#94A3B8' : '#334155',
                            whiteSpace: 'nowrap',
                            borderLeft: versionCount > 1
                              ? (row.isGroupHead ? '3px solid #EA580C' : '3px solid #FDBA74')
                              : undefined,
                            position: 'relative',
                          }}
                          >
                            {row.linkedPrior ? (
                              <div
                                title="Linked to the version above in this group"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  marginBottom: '0.4rem',
                                  padding: '0.22rem 0.55rem',
                                  borderRadius: '0.4rem',
                                  background: 'linear-gradient(180deg, #FFF7ED 0%, #FFEDD5 100%)',
                                  border: '1px solid #FB923C',
                                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(234, 88, 12, 0.12)',
                                }}
                              >
                                <svg
                                  aria-hidden="true"
                                  width="13"
                                  height="13"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#EA580C"
                                  strokeWidth="2.4"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  style={{ flex: '0 0 auto' }}
                                >
                                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  letterSpacing: '0.03em',
                                  textTransform: 'uppercase',
                                  color: '#C2410C',
                                  lineHeight: 1,
                                }}
                                >
                                  Linked
                                </span>
                              </div>
                            ) : null}
                            <div>{whenLabel}</div>
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '0.12rem 0.45rem',
                              borderRadius: '0.3rem',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              letterSpacing: '0.01em',
                              background: isHistory
                                ? '#F1F5F9'
                                : (isUpdated ? '#FEF3C7' : '#ECFDF5'),
                              color: isHistory
                                ? '#64748B'
                                : (isUpdated ? '#B45309' : '#047857'),
                              border: isHistory
                                ? '1px solid #E2E8F0'
                                : (isUpdated ? '1px solid #FCD34D' : '1px solid #A7F3D0'),
                            }}
                            >
                              {statusLabel}
                            </span>
                            <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginTop: 3, fontWeight: 600 }}>
                              {linkNote}
                            </div>
                            {showMetalLoss && finishedLoss < 0 ? (
                              <div style={{ fontSize: '0.68rem', color: '#B91C1C', marginTop: 3, fontWeight: 800 }}>
                                Update · metal loss {formatAlloyMetalLoss(finishedLoss)} g
                              </div>
                            ) : null}
                          </td>
                          <td style={{
                            padding: '0.6rem 0.75rem',
                            fontWeight: 800,
                            color: isHistory ? '#94A3B8' : '#0F172A',
                            fontSize: '0.85rem',
                          }}
                          >
                            {row.karat ? `${row.karat}K` : '—'}
                          </td>
                          <td style={{
                            padding: '0.6rem 0.75rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isHistory ? '#94A3B8' : '#0F172A',
                            fontSize: '0.85rem',
                          }}
                          >
                            {Number(row.targetGross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                            {showMetalLoss && priorRow ? (
                              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                                was {Number(priorRow.targetGross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                              </div>
                            ) : null}
                          </td>
                          <td style={{
                            padding: '0.6rem 0.75rem',
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            color: showMetalLoss && finishedLoss < 0
                              ? '#B91C1C'
                              : (showMetalLoss && finishedLoss > 0 ? '#047857' : '#94A3B8'),
                          }}
                          >
                            {showMetalLoss ? `${formatAlloyMetalLoss(finishedLoss)} g` : '—'}
                            {showMetalLoss ? (
                              <div style={{ fontSize: '0.66rem', color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>
                                vs prior version
                              </div>
                            ) : null}
                          </td>
                          <td style={{
                            padding: '0.6rem 0.75rem',
                            fontSize: '0.82rem',
                            color: isHistory ? '#64748B' : '#166534',
                          }}
                          >
                            <div style={{ fontWeight: 700 }}>{row.finishedName || '—'}</div>
                            {!isHistory && row.finishedQtyAfter != null ? (
                              <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                                on hand {Number(row.finishedQtyAfter).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                              </div>
                            ) : null}
                            {row.linkedPrior ? (
                              <div style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: 2, fontWeight: 600 }}>
                                Replaced by later update in this group
                              </div>
                            ) : null}
                            {!isHistory && isUpdated ? (
                              <div style={{ fontSize: '0.7rem', color: '#B45309', marginTop: 2, fontWeight: 700 }}>
                                Product updated
                              </div>
                            ) : null}
                          </td>
                          <td style={{
                            padding: '0.6rem 0.75rem',
                            fontSize: '0.8rem',
                            color: isHistory ? '#94A3B8' : '#B45309',
                          }}
                          >
                            {(row.consumed || []).length
                              ? (row.consumed || []).map((item) => {
                                const lossKey = String(item.itemId || item.name || '')
                                const lineLoss = inputLossByKey.get(lossKey)
                                return (
                                  <div key={`${row.id}-${item.itemId || item.name}-${item.gross}`}>
                                    {item.name}: {Number(item.gross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                                    {showMetalLoss && lineLoss != null && Math.abs(lineLoss) >= 0.0005 ? (
                                      <span style={{
                                        marginLeft: '0.35rem',
                                        color: lineLoss < 0 ? '#B91C1C' : '#047857',
                                        fontWeight: 700,
                                        fontSize: '0.72rem',
                                      }}
                                      >
                                        ({formatAlloyMetalLoss(lineLoss)})
                                      </span>
                                    ) : null}
                                  </div>
                                )
                              })
                              : '—'}
                          </td>
                          <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#64748B' }}>
                            {row.actorName || '—'}
                          </td>
                          {postingEnabled ? (
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => openViewPostedMix(row)}
                                disabled={Boolean(mixActionId)}
                                style={{
                                  ...secondaryBtnStyle,
                                  padding: '0.28rem 0.55rem',
                                  fontSize: '0.75rem',
                                  marginRight: '0.35rem',
                                }}
                              >
                                View
                              </button>
                              {canAct ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditPostedMix(row)}
                                    disabled={Boolean(mixActionId) || posting || updating || updateOpen}
                                    style={{
                                      ...secondaryBtnStyle,
                                      padding: '0.28rem 0.55rem',
                                      fontSize: '0.75rem',
                                      marginRight: '0.35rem',
                                      opacity: mixActionId && !busy ? 0.55 : 1,
                                      borderColor: editingPosted?.id === row.id ? '#F59E0B' : secondaryBtnStyle.border,
                                      color: editingPosted?.id === row.id ? '#B45309' : secondaryBtnStyle.color,
                                    }}
                                    title={isHistory ? 'Edit this prior mix (inventory already restored)' : 'Edit and replace this active mix'}
                                  >
                                    {editingPosted?.id === row.id ? 'Editing…' : 'Edit'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openUpdatePostedMix(row)}
                                    disabled={Boolean(mixActionId) || posting || updating || updateOpen}
                                    style={{
                                      ...secondaryBtnStyle,
                                      padding: '0.28rem 0.55rem',
                                      fontSize: '0.75rem',
                                      marginRight: '0.35rem',
                                      opacity: mixActionId && !busy ? 0.55 : 1,
                                    }}
                                    title={isHistory ? 'Post a new updated mix from this prior (inventory already restored)' : 'Update finished weight / metal loss'}
                                  >
                                    {busy ? '…' : 'Update'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDeletePostedMix(row)}
                                    disabled={Boolean(mixActionId) || posting || updating}
                                    style={{
                                      ...secondaryBtnStyle,
                                      padding: '0.28rem 0.55rem',
                                      fontSize: '0.75rem',
                                      color: '#B91C1C',
                                      borderColor: '#FECACA',
                                      opacity: mixActionId && !busy ? 0.55 : 1,
                                    }}
                                    title={isHistory ? 'Already reversed from inventory' : 'Delete and restore inventory'}
                                  >
                                    {busy ? '…' : 'Delete'}
                                  </button>
                                </>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {newMixOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingPosted ? 'Edit alloy mix' : 'New alloy mix'}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
            padding: '1rem',
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: 920,
            background: '#FFFFFF',
            borderRadius: '0.7rem',
            padding: '1.1rem 1.2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            maxHeight: '92vh',
            overflowY: 'auto',
          }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '0.75rem',
              marginBottom: '0.75rem',
            }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>
                  {editingPosted
                    ? (editingPosted.isHistory ? 'Edit prior mix' : 'Edit posted mix')
                    : 'New mix'}
                </h3>
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#475569', lineHeight: 1.45 }}>
                  {editingPosted ? (
                    <>
                      <strong>Edit</strong> opens the full mix form — change karat, stocks, or weights, then
                      <strong> Post edited mix</strong> to reverse and replace this row as a normal <strong>Posted</strong> mix.
                      For finished-weight / metal-loss only, close and use <strong>Update</strong>.
                    </>
                  ) : (
                    <>
                      Choose karat → ratios fill in. Enter <strong>gold input</strong> → mix
                      <strong> Calc gross</strong> / post target (e.g. 75 @ 18K → 100). Other stocks
                      <strong> gross</strong> / <strong>purity</strong> stay manual.
                    </>
                  )}
                </p>
              </div>
              <button type="button" onClick={closeNewMixDialog} disabled={posting} style={secondaryBtnStyle}>
                Close
              </button>
            </div>

            {editingPosted ? (
              <div style={{
                marginBottom: '0.75rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '0.45rem',
                border: '1px solid #FDE68A',
                background: '#FFFBEB',
                color: '#92400E',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
              >
                Editing {editingPosted.karat ? `${editingPosted.karat}K ` : ''}
                {Number(editingPosted.targetGross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                {' → '}
                {editingPosted.finishedName || 'finished'}
                {editingPosted.isHistory ? ' · prior history (inventory already restored)' : ''}
              </div>
            ) : null}

            <div style={{
              marginBottom: '0.75rem',
              padding: '0.55rem 0.7rem',
              borderRadius: '0.45rem',
              border: `1px solid ${finishedHint.id ? '#BBF7D0' : '#E2E8F0'}`,
              background: finishedHint.id ? '#F0FDF4' : '#F8FAFC',
              color: finishedHint.id ? '#166534' : '#475569',
              fontSize: '0.78rem',
              lineHeight: 1.45,
            }}
            >
              {finishedHint.message}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '0.65rem',
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
              borderRadius: '0.55rem',
              padding: '0.8rem',
              marginBottom: '0.85rem',
            }}
            >
              <div>
                <label style={labelStyle} htmlFor="gold-alloy-karat">Karat / allowing gold</label>
                <select
                  id="gold-alloy-karat"
                  aria-label="Karat"
                  value={karat}
                  onChange={(e) => onKaratChange(e.target.value)}
                  style={fieldStyle}
                >
                  <option value="">Select karat</option>
                  {GOLD_ALLOY_KARAT_RECIPES.map((row) => (
                    <option key={row.karat} value={row.karat}>{row.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="gold-alloy-gold-ratio">Gold ratio %</label>
                <input
                  id="gold-alloy-gold-ratio"
                  aria-label="Gold ratio percent"
                  type="number"
                  step="0.001"
                  value={goldRatio}
                  onChange={(e) => onGoldRatioChange(e.target.value)}
                  style={fieldStyle}
                  placeholder="e.g. 75"
                />
                {goldRatioFraction !== '' ? (
                  <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#64748B' }}>
                    = {goldRatioFraction}
                  </div>
                ) : null}
              </div>
              <div>
                <label style={labelStyle} htmlFor="gold-alloy-alloy-ratio">Alloy ratio %</label>
                <input
                  id="gold-alloy-alloy-ratio"
                  aria-label="Alloy ratio percent"
                  type="number"
                  step="0.001"
                  value={alloyRatio}
                  onChange={(e) => onAlloyRatioChange(e.target.value)}
                  style={fieldStyle}
                  placeholder="e.g. 25"
                />
                {alloyRatioFraction !== '' ? (
                  <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#64748B' }}>
                    = {alloyRatioFraction}
                  </div>
                ) : null}
              </div>
              <div>
                <label style={labelStyle} htmlFor="gold-alloy-gold-input">Gold input (g)</label>
                <input
                  id="gold-alloy-gold-input"
                  aria-label="Gold input weight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={goldInput}
                  onChange={(e) => onGoldInputChange(e.target.value)}
                  style={fieldStyle}
                  placeholder="e.g. 75"
                />
                {calculatedMixGross ? (
                  <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#B45309', fontWeight: 700 }}>
                    mix target {Number(calculatedMixGross).toLocaleString(undefined, { maximumFractionDigits: 4 })} g
                  </div>
                ) : null}
              </div>
              <div>
                <label style={labelStyle} htmlFor="gold-alloy-finished">Finished product (inventory IN)</label>
                <select
                  id="gold-alloy-finished"
                  aria-label="Finished alloy product"
                  value={finishedProductId}
                  onChange={(e) => setFinishedProductId(e.target.value)}
                  style={fieldStyle}
                >
                  <option value="">Select finished product</option>
                  {finishedOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label || option.name}
                      {option.quantity != null
                        ? ` · on hand ${Number(option.quantity).toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
                        : ''}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#64748B', lineHeight: 1.35 }}>
                  {karat
                    ? `Post / Edit adds finished weight to this ${karat}K product only. Metals go OUT.`
                    : 'Select karat first — finished product locks to that karat’s inventory SKU.'}
                </div>
              </div>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #E5E7EB', borderRadius: '0.55rem', background: '#FFFFFF' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B' }}>Stock</th>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B' }}>Product</th>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>On hand</th>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Gross</th>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Purity</th>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Pure wt</th>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Calc gross</th>
                    <th style={{ padding: '0.55rem 0.65rem', fontSize: '0.72rem', color: '#64748B' }} />
                  </tr>
                </thead>
                <tbody>
                  {!lines.length ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '1rem 0.65rem', textAlign: 'center', color: '#64748B', fontSize: '0.84rem' }}>
                        Click <strong>+ Add stock</strong> to choose gold, silver, copper…
                      </td>
                    </tr>
                  ) : null}
                  {lines.map((line, index) => {
                    const option = stockOptions.find((row) => row.id === line.stockId)
                    const onHand = Number(option?.quantity || 0)
                    const need = Number(line.gross || 0)
                    const short = line.stockId && need > 0 && onHand + 0.0005 < need
                    const showSingleCalcGross = index === 0
                    const lineStockOptions = buildAlloyInputStockOptionsForLine(stockOptions, line.key, {
                      excludeIds: finishedProductId ? [finishedProductId] : [],
                      selectedId: line.stockId,
                    })
                    return (
                      <tr key={line.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.45rem 0.65rem', fontWeight: 700, color: '#111827', textTransform: 'lowercase' }}>
                          {line.label}
                          {line.role === 'gold' ? (
                            <div style={{ fontWeight: 600, fontSize: '0.68rem', color: '#64748B', marginTop: 2 }}>
                              fine gold
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: '0.35rem 0.65rem' }}>
                          <select
                            aria-label={`Product for ${line.label}`}
                            value={line.stockId}
                            onChange={(e) => onStockChange(line.key, e.target.value)}
                            style={fieldStyle}
                          >
                            <option value="">Select product</option>
                            {lineStockOptions.map((opt) => (
                              <option key={opt.id} value={opt.id}>{opt.inputLabel || opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{
                          padding: '0.45rem 0.65rem',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: short ? '#B91C1C' : '#334155',
                          fontSize: '0.82rem',
                        }}
                        >
                          {line.stockId ? onHand.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}
                        </td>
                        <td style={{ padding: '0.35rem 0.65rem' }}>
                          <input
                            aria-label={`Gross for ${line.label}`}
                            type="number"
                            step="0.001"
                            value={line.gross}
                            onChange={(e) => updateLine(line.key, { gross: e.target.value })}
                            style={{ ...fieldStyle, textAlign: 'right' }}
                            placeholder="0"
                          />
                        </td>
                        <td style={{ padding: '0.35rem 0.65rem' }}>
                          <input
                            aria-label={`Purity for ${line.label}`}
                            type="number"
                            step="0.0001"
                            value={line.purity}
                            onChange={(e) => updateLine(line.key, { purity: e.target.value })}
                            style={{ ...fieldStyle, textAlign: 'right' }}
                            placeholder="1"
                          />
                        </td>
                        <td style={{ padding: '0.45rem 0.65rem', textAlign: 'right', fontWeight: 700, color: '#0F172A', fontSize: '0.82rem' }}>
                          {Number(line.pure || 0)
                            ? Number(line.pure).toLocaleString(undefined, { maximumFractionDigits: 3 })
                            : '—'}
                        </td>
                        {showSingleCalcGross ? (
                          <td
                            rowSpan={Math.max(lines.length, 1)}
                            style={{
                              padding: '0.45rem 0.65rem',
                              textAlign: 'right',
                              fontWeight: 800,
                              color: '#B45309',
                              fontSize: '0.95rem',
                              background: calculatedMixGross ? '#FFFBEB' : 'transparent',
                              verticalAlign: 'middle',
                              borderLeft: '1px solid #F1F5F9',
                            }}
                          >
                            {calculatedMixGross
                              ? Number(calculatedMixGross).toLocaleString(undefined, { maximumFractionDigits: 4 })
                              : '—'}
                            {calculatedMixGross ? (
                              <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontWeight: 600, marginTop: 4 }}>
                                mix total
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                        <td style={{ padding: '0.35rem 0.4rem' }}>
                          <button
                            type="button"
                            aria-label={`Remove ${line.label}`}
                            onClick={() => removeRow(line.key)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: '#94A3B8',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: '0.78rem',
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                    <td colSpan={3} style={{ padding: '0.6rem 0.65rem', fontWeight: 800, color: '#111827', fontSize: '0.82rem' }}>
                      Total / target
                    </td>
                    <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', fontWeight: 800 }}>
                      {summary.totalGross.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                    </td>
                    <td />
                    <td style={{
                      padding: '0.6rem 0.65rem',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: summary.balanced ? '#166534' : '#B45309',
                      fontSize: '0.8rem',
                    }}
                    >
                      {summary.checkLabel}
                    </td>
                    <td style={{ padding: '0.6rem 0.65rem', textAlign: 'right', fontWeight: 800, color: '#B45309', fontSize: '0.82rem' }}>
                      {calculatedMixGross
                        ? Number(calculatedMixGross).toLocaleString(undefined, { maximumFractionDigits: 4 })
                        : '—'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.55rem',
              alignItems: 'center',
              marginTop: '0.75rem',
              position: 'relative',
              zIndex: 5,
            }}
            >
              <div style={{ position: 'relative', flex: '0 0 auto' }}>
                <button
                  type="button"
                  aria-label="Add stock"
                  aria-haspopup="menu"
                  aria-expanded={addMenuOpen}
                  onClick={() => setAddMenuOpen((open) => !open)}
                  disabled={!availableLineTemplates.length}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    padding: '0.38rem 0.7rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #FDBA74',
                    background: availableLineTemplates.length ? '#FFF7ED' : '#F8FAFC',
                    color: availableLineTemplates.length ? '#C2410C' : '#94A3B8',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: availableLineTemplates.length ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Add stock
                  <span aria-hidden="true" style={{ fontSize: '0.65rem', lineHeight: 1 }}>
                    {addMenuOpen ? '▴' : '▾'}
                  </span>
                </button>
                {addMenuOpen && availableLineTemplates.length ? (
                  <div
                    role="menu"
                    aria-label="Choose stock to add"
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 0.4rem)',
                      left: 0,
                      minWidth: 168,
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '0.5rem',
                      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.16)',
                      zIndex: 120,
                      padding: '0.35rem',
                    }}
                  >
                    {availableLineTemplates.map((row) => (
                      <button
                        key={row.key}
                        type="button"
                        role="menuitem"
                        onClick={() => addRow(row.key)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '0.48rem 0.65rem',
                          border: 'none',
                          borderRadius: '0.35rem',
                          background: 'transparent',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          color: '#0F172A',
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF7ED' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                      >
                        {row.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button type="button" onClick={closeNewMixDialog} disabled={posting} style={secondaryBtnStyle}>
                Cancel
              </button>
              {postingEnabled ? (
                <button
                  type="button"
                  onClick={submitPost}
                  disabled={posting || !postCheck.ok}
                  style={{
                    marginLeft: 'auto',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '0.45rem',
                    border: 'none',
                    background: postCheck.ok && !posting ? '#EA580C' : '#CBD5E1',
                    color: '#FFFFFF',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    cursor: postCheck.ok && !posting ? 'pointer' : 'not-allowed',
                  }}
                >
                  {posting
                    ? 'Posting…'
                    : (editingPosted
                      ? (editingPosted.isHistory ? 'Post mix to inventory' : 'Post edited mix')
                      : 'Post mix to inventory')}
                </button>
              ) : null}
            </div>

            {!postCheck.ok && postingEnabled ? (
              <p style={{ margin: '0.55rem 0 0', fontSize: '0.78rem', color: '#B45309' }}>{postCheck.message}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {updateOpen && updatePosted ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Update posted alloy mix"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
            padding: '1rem',
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: 720,
            background: '#FFFFFF',
            borderRadius: '0.7rem',
            padding: '1.1rem 1.2rem',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}
          >
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>Update posted mix</h3>
            <p style={{ margin: '0.45rem 0 0.75rem', fontSize: '0.84rem', color: '#475569', lineHeight: 1.5 }}>
              <strong>Update</strong> adjusts finished weight / oxidation loss and posts a new <strong>Updated</strong> version
              (keeps the original as linked history). Remaining metals must equal <strong>Allowed wt</strong>.
              {' '}
              Loss vs original (oxidation) posts automatically to mapping <strong>{ALLOY_METAL_LOSS_MAPPING_TYPE}</strong>
              {alloyMetalLossMapping ? ' ✓' : ' (create in Mappings first)'}.
              {' '}
              Remelt and Update again anytime — loss revises with the voucher. <strong>Purity</strong> = mix share.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.65rem',
              marginBottom: '0.85rem',
              padding: '0.7rem 0.8rem',
              borderRadius: '0.5rem',
              border: '1px dashed #86EFAC',
              background: '#F0FDF4',
            }}
            >
              <div>
                <div style={{ ...labelStyle, color: '#166534' }}>Allowed wt / Gross (g)</div>
                <input
                  aria-label="Update finished gross weight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={updateFinishedGross}
                  onChange={(e) => onUpdateFinishedGrossChange(e.target.value)}
                  style={{ ...fieldStyle, fontWeight: 800 }}
                />
                <div style={{ marginTop: 4, fontSize: '0.7rem', color: '#64748B' }}>
                  was {Number(updateOriginalFinishedGross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                </div>
              </div>
              <div>
                <div style={{ ...labelStyle, color: '#166534' }}>Pure / achieved</div>
                <div style={{
                  padding: '0.45rem 0.55rem',
                  borderRadius: '0.4rem',
                  border: '1px solid #BBF7D0',
                  background: '#FFFFFF',
                  fontWeight: 800,
                  color: '#0F172A',
                  fontSize: '0.9rem',
                }}
                >
                  {updateFinishedPure
                    ? `${updateFinishedPure.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
                    : '—'}
                  {normalizeAlloyPurity(updateFinishedPurityPct) > 0 ? (
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#047857', marginTop: 2 }}>
                      {normalizeAlloyPurity(updateFinishedPurityPct).toFixed(2)}
                      {updateAchievedKarat !== '' ? ` · ${updateAchievedKarat}K` : ''}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.75rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: '#F8FAFC' }}>
                  <th style={{ padding: '0.45rem 0.5rem', fontSize: '0.72rem', color: '#64748B' }}>Stock</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontSize: '0.72rem', color: '#64748B' }}>Product</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Gross (g)</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Purity</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Pure</th>
                  <th style={{ padding: '0.45rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Metal loss</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: '1px solid #F1F5F9', background: '#FFFBEB' }}>
                  <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A' }}>
                    finished
                    <div style={{ fontWeight: 600, fontSize: '0.7rem', color: '#94A3B8' }}>
                      {updatePosted.karat ? `${updatePosted.karat}K IN` : 'IN'}
                    </div>
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    {updatePosted.finishedName || 'Finished alloy'}
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                    {Number(updateFinishedGross) > 0
                      ? Number(updateFinishedGross).toLocaleString(undefined, { maximumFractionDigits: 3 })
                      : '—'}
                  </td>
                  <td style={{
                    padding: '0.45rem 0.5rem',
                    textAlign: 'right',
                    fontSize: '0.82rem',
                    color: '#CBD5E1',
                  }}
                  >
                    —
                  </td>
                  <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '0.82rem', color: '#334155' }}>
                    {updateFinishedPure
                      ? updateFinishedPure.toLocaleString(undefined, { maximumFractionDigits: 3 })
                      : '—'}
                  </td>
                  <td style={{
                    padding: '0.45rem 0.5rem',
                    textAlign: 'right',
                    fontWeight: 800,
                    fontSize: '0.82rem',
                    color: updateMetalLossTotal.finished < 0 ? '#B91C1C' : (updateMetalLossTotal.finished > 0 ? '#047857' : '#64748B'),
                  }}
                  >
                    {formatAlloyMetalLoss(updateMetalLossTotal.finished)}
                  </td>
                </tr>
                {(updateMetalLines || []).map((line) => {
                  const loss = computeAlloyMetalLoss(line.gross, line.originalGross)
                  return (
                    <tr key={line.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', textTransform: 'lowercase' }}>
                        {line.label || line.key}
                        <div style={{ fontWeight: 500, fontSize: '0.7rem', color: '#94A3B8' }}>OUT</div>
                      </td>
                      <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                        {line.stockLabel || line.label || 'Metal'}
                      </td>
                      <td
                        style={{
                          padding: '0.45rem 0.5rem',
                          textAlign: 'right',
                          fontSize: '0.82rem',
                          color: '#CBD5E1',
                        }}
                        title="Gross is only shown on finished alloy — metals rebalance from Allowed wt"
                      >
                        —
                      </td>
                      <td style={{ padding: '0.35rem 0.5rem' }}>
                        <input
                          aria-label={`Update ${line.stockLabel || line.label} purity fraction`}
                          type="number"
                          step="0.0001"
                          min="0"
                          max="1"
                          value={line.purityPercent ?? ''}
                          onChange={(e) => patchUpdateMetalLine(line.key, {
                            purityPercent: clampPurityFractionInput(e.target.value),
                          })}
                          style={{ ...fieldStyle, textAlign: 'right' }}
                          placeholder="e.g. 0.75"
                        />
                      </td>
                      <td style={{
                        padding: '0.45rem 0.5rem',
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        color: '#334155',
                      }}
                      >
                        {Number(line.pure) > 0
                          ? Number(line.pure).toLocaleString(undefined, { maximumFractionDigits: 3 })
                          : '—'}
                      </td>
                      <td style={{
                        padding: '0.45rem 0.5rem',
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: '0.82rem',
                        color: loss < 0 ? '#B91C1C' : (loss > 0 ? '#047857' : '#64748B'),
                      }}
                      >
                        {formatAlloyMetalLoss(loss)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                  <td colSpan={2} style={{ padding: '0.55rem 0.5rem', fontWeight: 800, fontSize: '0.8rem' }}>
                    Achieved purity
                  </td>
                  <td style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontWeight: 800, fontSize: '0.85rem' }}>
                    {Number(updateFinishedGross) > 0
                      ? `${Number(updateFinishedGross).toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
                      : '—'}
                  </td>
                  <td colSpan={2} style={{ padding: '0.55rem 0.5rem', textAlign: 'right', fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>
                    {normalizeAlloyPurity(updateFinishedPurityPct) > 0
                      ? `${normalizeAlloyPurity(updateFinishedPurityPct).toFixed(2)} · ${updateAchievedKarat || '—'}K · pure ${updateFinishedPure || '—'}`
                      : '—'}
                  </td>
                  <td style={{
                    padding: '0.55rem 0.5rem',
                    textAlign: 'right',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    color: updateMetalLossTotal.metals < 0 ? '#B91C1C' : '#64748B',
                  }}
                  >
                    metals {formatAlloyMetalLoss(updateMetalLossTotal.metals)}
                  </td>
                </tr>
              </tfoot>
            </table>
            {!updateMixBalance.balanced ? (
              <div style={{ margin: '0 0 0.65rem' }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#B45309', fontWeight: 600 }}>
                  {updateMixBalance.message}
                </p>
                {updateMixBalance.metalGross > 0 && updateMixBalance.metalGross + 0.0005 < updateMixBalance.target ? (
                  <button
                    type="button"
                    onClick={() => onUpdateFinishedGrossChange(String(updateMixBalance.metalGross))}
                    style={{ ...secondaryBtnStyle, marginTop: '0.45rem', borderColor: '#F59E0B', color: '#92400E' }}
                  >
                    Set Allowed wt to {updateMixBalance.metalGross} g (metals remaining)
                  </button>
                ) : null}
              </div>
            ) : updateMixBalance.oxidationLoss > 0.0005 ? (
              <p style={{ margin: '0 0 0.65rem', fontSize: '0.78rem', color: '#B45309', fontWeight: 600 }}>
                Oxidation loss {updateMixBalance.oxidationLoss} g will post to{' '}
                {alloyMetalLossMapping
                  ? `mapping ${ALLOY_METAL_LOSS_MAPPING_TYPE}`
                  : `mapping ${ALLOY_METAL_LOSS_MAPPING_TYPE} (create in Mappings first)`}
                . Remelt later → Update again to revise.
              </p>
            ) : null}
            <div style={{ display: 'flex', gap: '0.55rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeUpdateDialog}
                disabled={updating}
                style={secondaryBtnStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitUpdatePostedMix}
                disabled={
                  updating
                  || !updateMixBalance.balanced
                  || !(Number(updateFinishedPurityPct) > 0)
                  || !(updateMetalLines || []).some((line) => Number(line.gross) > 0 && Number(line.purityPercent) > 0)
                }
                style={{
                  padding: '0.45rem 0.8rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  background: (
                    updating
                    || !updateMixBalance.balanced
                    || !(Number(updateFinishedPurityPct) > 0)
                    || !(updateMetalLines || []).some((line) => Number(line.gross) > 0 && Number(line.purityPercent) > 0)
                  )
                    ? '#CBD5E1'
                    : '#EA580C',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  cursor: (
                    updating
                    || !updateMixBalance.balanced
                    || !(Number(updateFinishedPurityPct) > 0)
                    || !(updateMetalLines || []).some((line) => Number(line.gross) > 0 && Number(line.purityPercent) > 0)
                  )
                    ? 'not-allowed'
                    : 'pointer',
                }}
              >
                {updating ? 'Updating…' : 'Update mix'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewPosted ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="View posted mix"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 85,
            padding: '1rem',
          }}
          onClick={closeViewPostedMix}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 720,
              background: '#FFFFFF',
              borderRadius: '0.7rem',
              padding: '1.1rem 1.2rem',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const row = viewPosted
              const isUpdated = String(row.status || '').toLowerCase() === 'updated'
              const isHistory = Boolean(row.isHistory)
              const statusLabel = isHistory
                ? 'Prior (before update)'
                : (isUpdated ? 'Updated' : 'Posted')
              const whenLabel = row.at
                ? new Date(row.at).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
                : '—'
              const target = Number(row.targetGross || 0)
              const finishedId = String(row.finishedProductId || '')
              const finishedOpt = stockOptions.find((o) => String(o.id) === finishedId)
              const recipe = resolveKaratRecipe(row.karat)
              const finishedPurity = normalizeAlloyPurity(
                finishedOpt?.purity || (recipe ? recipe.goldRatio / 100 : 0),
              )
              const finishedPure = target > 0 && finishedPurity > 0
                ? roundAlloyGrams(target * finishedPurity)
                : 0
              const achievedKarat = finishedPurity > 0
                ? roundAlloyGrams(finishedPurity * 24, 1)
                : ''
              // Metal loss vs prior history row for same finished product (Updated mixes).
              const prior = !isHistory
                ? (postedMixes || []).find((m) => (
                  m.isHistory
                  && String(m.finishedProductId || '') === finishedId
                  && m.id !== row.id
                ))
                : null
              const priorTarget = Number(prior?.targetGross || 0)
              const finishedLoss = prior
                ? computeAlloyMetalLoss(target, priorTarget)
                : 0
              const metalRows = (row.consumed || []).map((item) => {
                const gross = Number(item.gross || 0)
                const share = target > 0 && gross > 0 ? computeAlloyMixShare(gross, target) : ''
                const option = stockOptions.find((o) => String(o.id) === String(item.itemId || ''))
                const metalPurity = normalizeAlloyPurity(option?.purity || 1) || 1
                const pure = computeAlloyPure(gross, metalPurity)
                const priorGross = Number(
                  (prior?.consumed || []).find((c) => (
                    String(c.itemId) === String(item.itemId || '')
                    || String(c.name || '') === String(item.name || '')
                  ))?.gross || 0,
                )
                const loss = prior ? computeAlloyMetalLoss(gross, priorGross) : 0
                return {
                  key: `${item.itemId || item.name}-${gross}`,
                  name: item.name || item.label || 'Metal',
                  label: item.label || '',
                  gross,
                  share,
                  metalPurity,
                  pure,
                  loss,
                }
              })
              const metalsLossTotal = roundAlloyGrams(
                metalRows.reduce((sum, line) => sum + Number(line.loss || 0), 0),
              )
              const metalsGrossTotal = roundAlloyGrams(
                metalRows.reduce((sum, line) => sum + Number(line.gross || 0), 0),
              )
              return (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#111827' }}>View mix</h3>
                      <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#64748B', lineHeight: 1.45 }}>
                        {whenLabel} · {statusLabel}
                        {row.actorName ? ` · ${row.actorName}` : ''}
                        {prior ? ' · metal loss vs prior' : ''}
                      </p>
                    </div>
                    <button type="button" onClick={closeViewPostedMix} style={secondaryBtnStyle}>
                      Close
                    </button>
                  </div>

                  <div style={{
                    marginTop: '0.85rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '0.45rem',
                    border: '1px solid #BBF7D0',
                    background: '#F0FDF4',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '0.55rem 1rem',
                    fontSize: '0.82rem',
                  }}
                  >
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>Karat</div>
                      <div style={{ fontWeight: 800, color: '#0F172A' }}>{row.karat ? `${row.karat}K` : '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>Allowed / target</div>
                      <div style={{ fontWeight: 800, color: '#0F172A' }}>
                        {target > 0 ? `${target.toLocaleString(undefined, { maximumFractionDigits: 3 })} g` : '—'}
                      </div>
                      {prior ? (
                        <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: 2 }}>
                          was {priorTarget.toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                        </div>
                      ) : null}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>Finished purity</div>
                      <div style={{ fontWeight: 800, color: '#0F172A' }}>
                        {finishedPurity > 0 ? finishedPurity.toFixed(2) : '—'}
                        {achievedKarat !== '' ? ` · ${achievedKarat}K` : ''}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>Pure / achieved</div>
                      <div style={{ fontWeight: 800, color: '#0F172A' }}>
                        {finishedPure > 0
                          ? `${finishedPure.toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
                          : '—'}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700 }}>Finished (IN)</div>
                      <div style={{ fontWeight: 700, color: '#166534' }}>{row.finishedName || '—'}</div>
                      {!isHistory && row.finishedQtyAfter != null ? (
                        <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                          on hand {Number(row.finishedQtyAfter).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                        </div>
                      ) : null}
                      {isHistory ? (
                        <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2, fontWeight: 600 }}>
                          Replaced by a later Edit or Update — read only
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', color: '#64748B' }}>Stock</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', color: '#64748B' }}>Product</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Gross (g)</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Purity / share</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Pure</th>
                        <th style={{ padding: '0.4rem 0.5rem', fontSize: '0.72rem', color: '#64748B', textAlign: 'right' }}>Metal loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderTop: '1px solid #F1F5F9', background: '#FFFBEB' }}>
                        <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 700 }}>
                          finished
                          <div style={{ fontWeight: 600, fontSize: '0.7rem', color: '#94A3B8' }}>
                            {row.karat ? `${row.karat}K IN` : 'IN'}
                          </div>
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                          {row.finishedName || 'Finished alloy'}
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                          {target > 0 ? target.toLocaleString(undefined, { maximumFractionDigits: 3 }) : '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontSize: '0.82rem', color: '#64748B' }}>
                          {finishedPurity > 0 ? finishedPurity.toFixed(2) : '—'}
                        </td>
                        <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '0.82rem' }}>
                          {finishedPure > 0
                            ? finishedPure.toLocaleString(undefined, { maximumFractionDigits: 3 })
                            : '—'}
                        </td>
                        <td style={{
                          padding: '0.45rem 0.5rem',
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          color: finishedLoss < 0 ? '#B91C1C' : (finishedLoss > 0 ? '#047857' : '#64748B'),
                        }}
                        >
                          {prior ? formatAlloyMetalLoss(finishedLoss) : '—'}
                        </td>
                      </tr>
                      {metalRows.length ? metalRows.map((line) => (
                        <tr key={line.key} style={{ borderTop: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 700, textTransform: 'lowercase' }}>
                            {line.label || 'metal'}
                            <div style={{ fontWeight: 500, fontSize: '0.7rem', color: '#94A3B8' }}>OUT</div>
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                            {line.name}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '0.82rem' }}>
                            {line.gross.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontSize: '0.82rem', color: '#334155' }}>
                            {line.share || '—'}
                          </td>
                          <td style={{ padding: '0.45rem 0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '0.82rem' }}>
                            {Number(line.pure) > 0
                              ? Number(line.pure).toLocaleString(undefined, { maximumFractionDigits: 3 })
                              : '—'}
                          </td>
                          <td style={{
                            padding: '0.45rem 0.5rem',
                            textAlign: 'right',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            color: line.loss < 0 ? '#B91C1C' : (line.loss > 0 ? '#047857' : '#64748B'),
                          }}
                          >
                            {prior ? formatAlloyMetalLoss(line.loss) : '—'}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={6} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' }}>
                            No input stocks recorded
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid #E2E8F0', background: '#F8FAFC' }}>
                        <td colSpan={2} style={{ padding: '0.5rem', fontWeight: 800, fontSize: '0.8rem' }}>
                          Totals
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 800, fontSize: '0.82rem' }}>
                          {metalsGrossTotal.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                        </td>
                        <td colSpan={2} style={{ padding: '0.5rem', textAlign: 'right', fontSize: '0.78rem', color: '#047857', fontWeight: 700 }}>
                          {finishedPurity > 0
                            ? `${finishedPurity.toFixed(2)} · ${achievedKarat || '—'}K · pure ${finishedPure || '—'}`
                            : '—'}
                        </td>
                        <td style={{
                          padding: '0.5rem',
                          textAlign: 'right',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          color: metalsLossTotal < 0 ? '#B91C1C' : '#64748B',
                        }}
                        >
                          {prior ? `metals ${formatAlloyMetalLoss(metalsLossTotal)}` : '—'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                  {!prior && !isHistory ? (
                    <p style={{ margin: '0.55rem 0 0', fontSize: '0.75rem', color: '#94A3B8' }}>
                      Metal loss shows after an update (compares to the prior posted mix).
                    </p>
                  ) : null}

                  <div style={{ display: 'flex', gap: '0.55rem', justifyContent: 'flex-end', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {postingEnabled ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditPostedMix(row)}
                          style={secondaryBtnStyle}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => openUpdatePostedMix(row)}
                          style={{
                            padding: '0.45rem 0.8rem',
                            borderRadius: '0.4rem',
                            border: 'none',
                            background: '#EA580C',
                            color: '#FFFFFF',
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Update
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            closeViewPostedMix()
                            onDeletePostedMix(row)
                          }}
                          style={{
                            ...secondaryBtnStyle,
                            color: '#B91C1C',
                            borderColor: '#FECACA',
                          }}
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                    <button type="button" onClick={closeViewPostedMix} style={secondaryBtnStyle}>
                      Close
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      ) : null}

    </div>
  )
}
