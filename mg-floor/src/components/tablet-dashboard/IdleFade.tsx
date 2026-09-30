import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native'

export const IDLE_OPACITY = 0.45
const useNativeDriver = Platform.OS !== 'web'

/** Fades its content while no employee is logged in on the tablet. */
export function IdleFade({
  idle,
  style,
  children,
}: {
  idle: boolean
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  const opacity = useRef(new Animated.Value(idle ? IDLE_OPACITY : 1)).current

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: idle ? IDLE_OPACITY : 1,
      duration: 300,
      useNativeDriver,
    }).start()
  }, [idle, opacity])

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>
}

/** Gentle grow-and-shrink loop while `active`; scale 1 otherwise. */
export function usePulse(active: boolean) {
  const scale = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!active) {
      scale.setValue(1)
      return undefined
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.05, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver }),
        Animated.timing(scale, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver }),
      ]),
    )
    loop.start()
    return () => {
      loop.stop()
      scale.setValue(1)
    }
  }, [active, scale])

  return scale
}
