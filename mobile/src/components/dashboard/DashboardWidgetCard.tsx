import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native'
import { useBrandingStyles } from '@/src/hooks/useBrandingStyles'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'

type Props = {
  icon: string
  title: string
  children: React.ReactNode
  footerLabel?: string
  onFooterPress?: () => void
  style?: ViewStyle
}

function createStyles(branding: MobileTenantBranding) {
  return StyleSheet.create({
    card: {
      backgroundColor: '#fff',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      marginBottom: 12,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
      backgroundColor: '#FAFAFA',
    },
    icon: { fontSize: 18 },
    title: {
      flex: 1,
      fontSize: 14,
      fontWeight: '800',
      color: branding.colors.text,
    },
    body: { padding: 12 },
    footer: {
      borderTopWidth: 1,
      borderTopColor: '#F3F4F6',
      paddingVertical: 10,
      alignItems: 'center',
      backgroundColor: '#F0FDF4',
    },
    footerText: {
      color: branding.colors.success,
      fontSize: 13,
      fontWeight: '700',
    },
  })
}

export function DashboardWidgetCard({
  icon,
  title,
  children,
  footerLabel,
  onFooterPress,
  style,
}: Props) {
  const styles = useBrandingStyles(createStyles)

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.body}>{children}</View>
      {footerLabel && onFooterPress ? (
        <Pressable onPress={onFooterPress} style={styles.footer}>
          <Text style={styles.footerText}>{footerLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}
