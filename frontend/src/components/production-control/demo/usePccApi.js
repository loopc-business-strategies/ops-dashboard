import { useEffect, useMemo, useState } from 'react'
import { useDemoMode } from './DemoModeContext'
import { getRealPccApi, getRealWorkOrdersApi } from './pccApiAdapter'

/**
 * Live PCC API by default. Demo factories load only when Demo View is entered
 * (and only if VITE_ENABLE_PRODUCTION_DEMO built the Demo button).
 */
export function usePccApi() {
  const { isDemo } = useDemoMode()
  const [demoApi, setDemoApi] = useState(null)

  useEffect(() => {
    if (!isDemo) {
      setDemoApi(null)
      return undefined
    }
    let cancelled = false
    import('./demoApi')
      .then((m) => {
        if (!cancelled) setDemoApi(m.createDemoPccApi())
      })
      .catch(() => {
        if (!cancelled) setDemoApi(null)
      })
    return () => {
      cancelled = true
    }
  }, [isDemo])

  return useMemo(() => {
    if (isDemo && demoApi) return demoApi
    return getRealPccApi()
  }, [isDemo, demoApi])
}

export function useWorkOrdersApi() {
  const { isDemo } = useDemoMode()
  const [demoApi, setDemoApi] = useState(null)

  useEffect(() => {
    if (!isDemo) {
      setDemoApi(null)
      return undefined
    }
    let cancelled = false
    import('./demoApi')
      .then((m) => {
        if (!cancelled) setDemoApi(m.createDemoWorkOrdersApi())
      })
      .catch(() => {
        if (!cancelled) setDemoApi(null)
      })
    return () => {
      cancelled = true
    }
  }, [isDemo])

  return useMemo(() => {
    if (isDemo && demoApi) return demoApi
    return getRealWorkOrdersApi()
  }, [isDemo, demoApi])
}
