import { Pressable, Text, StyleSheet, type GestureResponderEvent, type PressableProps } from 'react-native'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'

type Props = PressableProps & {
  onPressOverride?: (event: GestureResponderEvent) => void
  accessibilityState?: { selected?: boolean }
}

function createPlusTabButtonStyles(branding: MobileTenantBranding) {
  const { colors } = branding
  return StyleSheet.create({
    wrap: {
      top: -14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    plus: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: colors.primary,
      color: '#FFFFFF',
      fontSize: 32,
      fontWeight: '300',
      textAlign: 'center',
      lineHeight: 50,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    plusFocused: {
      backgroundColor: colors.secondary,
    },
  })
}

export function PlusTabButton({ onPress, onPressOverride, accessibilityState }: Props) {
  const styles = useBrandingStyles(createPlusTabButtonStyles)
  const focused = accessibilityState?.selected

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      onPress={(event) => {
        if (onPressOverride) {
          onPressOverride(event)
          return
        }
        onPress?.(event)
      }}
      style={({ pressed }) => [
        styles.wrap,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.plus, focused && styles.plusFocused]}>+</Text>
    </Pressable>
  )
}
