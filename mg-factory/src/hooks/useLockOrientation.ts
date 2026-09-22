import { useEffect } from 'react'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useIsTablet } from '@/src/components/ui'

/**
 * Tablets lock landscape; phones stay free (portrait OK).
 * Pass enabled=false until auth hydrate finishes so orientation is off the critical startup path.
 */
export function useLockOrientation(enabled = true) {
  const tablet = useIsTablet()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const timer = setTimeout(() => {
      ;(async () => {
        try {
          if (tablet) {
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE)
          } else {
            await ScreenOrientation.unlockAsync()
          }
        } catch {
          // Orientation module may be unavailable; never crash launch.
        }
        if (cancelled) return
      })()
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tablet, enabled])
}
