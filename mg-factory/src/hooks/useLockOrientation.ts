import { useEffect } from 'react'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useIsTablet } from '@/src/components/ui'

/** Tablets lock landscape; phones stay free (portrait OK). */
export function useLockOrientation() {
  const tablet = useIsTablet()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (tablet) {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
        } else {
          await ScreenOrientation.unlockAsync()
        }
      } catch {
        // Orientation module may be unavailable in some builds; never crash launch.
      }
      if (cancelled) return
    })()
    return () => {
      cancelled = true
    }
  }, [tablet])
}
