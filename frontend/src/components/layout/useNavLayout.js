import { useCallback, useEffect, useState } from 'react'
import authAPI from '../../api/auth'
import { EMPTY_NAV_LAYOUT, moveInList, normalizeNavLayout } from './navLayout'

/**
 * Per-user sidebar order saved on the account (MG only). While customizing, moves go to a draft
 * that is shown live and only sent to the server on save().
 */
export function useNavLayout(enabled) {
  const [saved, setSaved] = useState(EMPTY_NAV_LAYOUT)
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!enabled) {
      setSaved(EMPTY_NAV_LAYOUT)
      setDraft(null)
      return undefined
    }
    let cancelled = false
    authAPI.getNavLayout()
      .then((res) => { if (!cancelled) setSaved(normalizeNavLayout(res?.navLayout)) })
      .catch(() => { /* keep the default order */ })
    return () => { cancelled = true }
  }, [enabled])

  const editing = draft != null
  const layout = draft || saved

  const startEdit = useCallback(() => {
    setError('')
    setDraft(saved)
  }, [saved])

  const moveSection = useCallback((orderedKeys, index, delta) => {
    setDraft((d) => ({ ...(d || EMPTY_NAV_LAYOUT), sections: moveInList(orderedKeys, index, delta) }))
  }, [])

  const moveItem = useCallback((group, orderedIds, index, delta) => {
    setDraft((d) => {
      const base = d || EMPTY_NAV_LAYOUT
      return { ...base, items: { ...base.items, [group]: moveInList(orderedIds, index, delta) } }
    })
  }, [])

  const reset = useCallback(() => setDraft(EMPTY_NAV_LAYOUT), [])

  const save = useCallback(async () => {
    if (!draft || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await authAPI.saveNavLayout(draft)
      setSaved(normalizeNavLayout(res?.navLayout || draft))
      setDraft(null)
    } catch (err) {
      setSaved(draft)
      setDraft(null)
      setError(err?.response?.data?.message || 'Could not save the sidebar order. It applies until you reload.')
    } finally {
      setSaving(false)
    }
  }, [draft, saving])

  return { layout, editing, saving, error, startEdit, moveSection, moveItem, reset, save }
}
