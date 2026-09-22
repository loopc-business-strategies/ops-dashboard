import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native'
import { colors, spacing } from '@/src/theme'

export function useIsTablet() {
  const { width, height } = useWindowDimensions()
  return Math.min(width, height) >= 600 || width >= 900
}

export function useIsLandscape() {
  const { width, height } = useWindowDimensions()
  return width > height
}

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const tablet = useIsTablet()
  return (
    <View style={[styles.screen, tablet && styles.screenTablet, style]}>{children}</View>
  )
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>
}

export function BigButton({
  label,
  onPress,
  disabled,
  tone = 'accent',
  style,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  tone?: 'accent' | 'danger' | 'neutral' | 'success'
  style?: ViewStyle
}) {
  const tablet = useIsTablet()
  const bg =
    tone === 'danger'
      ? colors.danger
      : tone === 'neutral'
        ? colors.surfaceAlt
        : tone === 'success'
          ? colors.success
          : colors.accent
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.bigBtn,
        tablet && styles.bigBtnTablet,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      <Text style={[styles.bigBtnText, tablet && styles.bigBtnTextTablet]}>{label}</Text>
    </Pressable>
  )
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.subtitle}>{label}</Text>
    </View>
  )
}

/** Centers a max-width form on landscape / tablet login screens. */
export function FormPanel({ children }: { children: React.ReactNode }) {
  const tablet = useIsTablet()
  const landscape = useIsLandscape()
  if (!tablet && !landscape) {
    return <View style={styles.formPanelFill}>{children}</View>
  }
  return (
    <View style={styles.formPanelOuter}>
      <View style={styles.formPanelInner}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
  },
  screenTablet: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginTop: 4,
  },
  bigBtn: {
    minHeight: 64,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.sm,
  },
  bigBtnTablet: {
    minHeight: 80,
  },
  bigBtnText: {
    color: colors.bg,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  bigBtnTextTablet: {
    fontSize: 22,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  formPanelFill: {
    flex: 1,
    justifyContent: 'center',
  },
  formPanelOuter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formPanelInner: {
    width: '100%',
    maxWidth: 520,
  },
})
