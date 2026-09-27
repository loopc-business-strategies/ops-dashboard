import { useCallback, useMemo, useState } from 'react'
import { fetchScales } from '@/src/api/floor'
import { toWeighProfile, type ScaleWeighProfile } from '@/src/scaleCamera/cameraSettings'
import { useAsyncResource } from '@/src/hooks/useAsyncResource'
import { userFacingMessage } from '@/src/api/errors'

/** Page size only — not a maximum registry size. */
export const SCALE_PAGE = 50

/**
 * Dept-scoped enabled scale IDs with skip/limit paging (Load more).
 */
export function useAuthorizedScaleIds(department?: string | null) {
  const [extra, setExtra] = useState<string[]>([])
  const [extraRows, setExtraRows] = useState<Array<Record<string, unknown>>>([])
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState('')

  const dept = department ? String(department) : ''

  const page = useAsyncResource(
    useCallback(
      async (signal) => {
        const res = await fetchScales(
          {
            limit: SCALE_PAGE,
            skip: 0,
            ...(dept ? { department: dept } : {}),
          },
          { signal },
        )
        setExtra([])
        setExtraRows([])
        setLoadMoreError('')
        return {
          ids: (res.scales || []).map((x) => String(x.scaleId)),
          rows: res.scales || [],
          total: Number(res.total ?? res.scales?.length ?? 0),
        }
      },
      [dept],
    ),
    {
      isEmpty: (d) => !d.ids.length,
      cacheKey: `mg-floor:scale-ids:${dept || 'all'}`,
      deps: [dept],
    },
  )

  const ids = [...(page.data?.ids || []), ...extra]
  const total = page.data?.total ?? ids.length
  const canLoadMore = ids.length < total

  const baseRows = page.data?.rows
  const profiles = useMemo(() => {
    const map: Record<string, ScaleWeighProfile> = {}
    for (const row of [...(baseRows || []), ...extraRows]) {
      const profile = toWeighProfile(row as Parameters<typeof toWeighProfile>[0])
      if (profile.scaleId) map[profile.scaleId] = profile
    }
    return map
  }, [baseRows, extraRows])

  const loadMore = async () => {
    if (loadingMore || !canLoadMore) return
    setLoadingMore(true)
    setLoadMoreError('')
    const nextSkip = (page.data?.ids.length || 0) + extra.length
    try {
      const res = await fetchScales({
        limit: SCALE_PAGE,
        skip: nextSkip,
        ...(dept ? { department: dept } : {}),
      })
      const more = (res.scales || []).map((x) => String(x.scaleId))
      setExtra((prev) => [...prev, ...more])
      setExtraRows((prev) => [...prev, ...(res.scales || [])])
    } catch (err) {
      setLoadMoreError(userFacingMessage(err) || 'Unable to load more scales')
    } finally {
      setLoadingMore(false)
    }
  }

  return {
    ids,
    /** Weigh profile per scaleId (capture methods, capacity, resolution, camera OCR settings). */
    profiles,
    total,
    canLoadMore,
    loadMore,
    loadingMore,
    loadMoreError,
    status: page.status,
    error: page.error,
    reload: page.reload,
    isLoading: page.isLoading,
    updatedAt: page.updatedAt,
    fromCache: page.fromCache,
    stale: page.stale,
  }
}
