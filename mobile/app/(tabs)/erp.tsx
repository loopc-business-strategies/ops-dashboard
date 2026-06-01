import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { mgBranding } from '@/src/config/branding'

const modules = [
  { title: 'Vouchers', note: 'List & detail — coming in update' },
  { title: 'Ledger', note: 'Browse entries — coming in update' },
  { title: 'Customers', note: 'Outstanding & margins — coming in update' },
  { title: 'Inventory', note: 'Stock levels — coming in update' },
]

export default function ErpScreen() {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.lead}>
        ERP modules will expand here. Use Home for live dashboard KPIs today.
      </Text>
      {modules.map((item) => (
        <View key={item.title} style={styles.card}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.note}>{item.note}</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: mgBranding.colors.background },
  content: { padding: 16, gap: 10 },
  lead: { color: mgBranding.colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
  },
  title: { fontSize: 16, fontWeight: '700', color: mgBranding.colors.text },
  note: { marginTop: 4, fontSize: 13, color: mgBranding.colors.muted },
})
