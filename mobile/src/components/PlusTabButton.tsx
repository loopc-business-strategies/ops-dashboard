import { Pressable, Text, StyleSheet, type GestureResponderEvent, type PressableProps } from 'react-native'
import { mgBranding } from '@/src/config/branding'

type Props = PressableProps & {
  onPressOverride?: (event: GestureResponderEvent) => void
  accessibilityState?: { selected?: boolean }
}

export function PlusTabButton({ onPress, onPressOverride, accessibilityState }: Props) {
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

const styles = StyleSheet.create({
  wrap: {
    top: -14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plus: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: mgBranding.colors.primary,
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 50,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#005B96',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  plusFocused: {
    backgroundColor: mgBranding.colors.secondary,
  },
})
