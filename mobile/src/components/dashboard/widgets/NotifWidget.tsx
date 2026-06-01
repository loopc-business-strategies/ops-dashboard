import { Text, View } from 'react-native'
import type { DashboardPayload } from '@/src/api/dashboard'
import { mgBranding } from '@/src/config/branding'
import { widgetStyles } from '@/src/components/dashboard/widgetStyles'

type Props = {
  dashboard: DashboardPayload | null
  generatedAt?: string
}

export function NotifWidget({ dashboard, generatedAt }: Props) {
  const items = [
    {
      icon: '⚠️',
      bg: '#FEE2E2',
      text: `${Number(dashboard?.vendorComplianceRisk?.nonCompliant || 0)} vendor(s) at risk · Avg score ${Number(dashboard?.vendorComplianceRisk?.averageScore || 0)}%`,
      time: 'Today',
    },
    {
      icon: '📄',
      bg: '#FEF9C3',
      text: `Doc expiry: ${Number(dashboard?.vendorDocumentExpiry?.warning30 || 0)} in 30d · ${Number(dashboard?.vendorDocumentExpiry?.warning60 || 0)} in 60d`,
      time: 'Today',
    },
    ...(dashboard?.lowStockAlerts?.length
      ? [{
          icon: '📦',
          bg: '#DBEAFE',
          text: `${dashboard.lowStockAlerts.length} item(s) below minimum stock`,
          time: 'Now',
        }]
      : []),
    {
      icon: '✅',
      bg: '#DCFCE7',
      text: 'Dashboard refreshed successfully',
      time: generatedAt
        ? new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]

  return (
    <View>
      {items.map((item, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            gap: 10,
            paddingVertical: 10,
            borderBottomWidth: i < items.length - 1 ? 1 : 0,
            borderBottomColor: '#F3F4F6',
            alignItems: 'flex-start',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: item.bg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 16 }}>{item.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: mgBranding.colors.text, lineHeight: 18 }}>{item.text}</Text>
            <Text style={{ fontSize: 11, color: mgBranding.colors.muted, marginTop: 2 }}>{item.time}</Text>
          </View>
        </View>
      ))}
    </View>
  )
}
