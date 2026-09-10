import { useMemo } from 'react'
import { useDemoMode } from './DemoModeContext'
import {
  createDemoPccApi,
  createDemoWorkOrdersApi,
  getRealPccApi,
  getRealWorkOrdersApi,
} from './pccApiAdapter'

export function usePccApi() {
  const { isDemo } = useDemoMode()
  return useMemo(() => (isDemo ? createDemoPccApi() : getRealPccApi()), [isDemo])
}

export function useWorkOrdersApi() {
  const { isDemo } = useDemoMode()
  return useMemo(() => (isDemo ? createDemoWorkOrdersApi() : getRealWorkOrdersApi()), [isDemo])
}
