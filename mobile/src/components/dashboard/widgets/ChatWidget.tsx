import { Text, View } from 'react-native'
import type { ChatMessage } from '@/src/api/messages'
import { mgBranding } from '@/src/config/branding'
import { fmtTime } from '@/src/utils/format'
import { widgetStyles } from '@/src/components/dashboard/widgetStyles'

type Props = {
  messages: ChatMessage[]
}

export function ChatWidget({ messages }: Props) {
  const rows = messages.slice(-4)

  if (rows.length === 0) {
    return <Text style={widgetStyles.empty}>No recent team messages.</Text>
  }

  return (
    <View>
      {rows.map((m, i) => {
        const text = String(m.text || m.message || '').trim()
        const initial = String(m.senderName || '?')[0]?.toUpperCase() || '?'
        return (
          <View key={String(m._id || i)} style={[widgetStyles.row, i === rows.length - 1 && widgetStyles.rowLast]}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: '#E8F5EF',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: mgBranding.colors.success }}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={[widgetStyles.rowLabel, { fontWeight: '700' }]} numberOfLines={1}>
                  {m.senderName || 'Unknown'}
                </Text>
                <Text style={{ fontSize: 11, color: mgBranding.colors.muted }}>{fmtTime(m.createdAt)}</Text>
              </View>
              <Text style={{ fontSize: 12, color: mgBranding.colors.muted, marginTop: 2 }} numberOfLines={2}>
                {text || '—'}
              </Text>
            </View>
          </View>
        )
      })}
    </View>
  )
}
