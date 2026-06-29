import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  fetchExpenseRegister,
  type ExpenseRegisterItem,
  type ExpenseRegisterQuery,
} from '@/src/api/expenseReport'
import { useWidgetStyles } from '@/src/components/dashboard/widgetStyles'
import { useAuth } from '@/src/context/AuthContext'
import { useTenant } from '@/src/context/TenantContext'
import { useTenantSessionKey } from '@/src/hooks/useTenantSessionKey'
import { useTenantSessionReady } from '@/src/hooks/useTenantSessionReady'
import { fmtMoney } from '@/src/utils/format'

type PaymentFilter = NonNullable<ExpenseRegisterQuery['paymentSource']>

const PAYMENT_FILTERS: { key: PaymentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'bank', label: 'Bank' },
  { key: 'cash', label: 'Cash' },
  { key: 'other', label: 'Other' },
]

type Props = {
  refreshKey?: number | string
}

function formatExpenseDate(value?: string) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function ExpenseReportWidget({ refreshKey = 0 }: Props) {
  const widgetStyles = useWidgetStyles()
  const { branding } = useTenant()
  const { token } = useAuth()
  const sessionReady = useTenantSessionReady()
  const tenantSessionKey = useTenantSessionKey()

  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [categories, setCategories] = useState<string[]>([])
  const [items, setItems] = useState<ExpenseRegisterItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)

  const load = useCallback(async () => {
    if (!token || !sessionReady) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetchExpenseRegister(token, {
        paymentSource: paymentFilter,
        category: categoryFilter || undefined,
      })
      setItems(res.items || [])
      setTotal(Number(res.total || 0))
      setCategories(res.categories || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expense report')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [token, sessionReady, paymentFilter, categoryFilter])

  useEffect(() => {
    load()
  }, [load, refreshKey, tenantSessionKey])

  const categoryLabel = useMemo(
    () => (categoryFilter ? categoryFilter : 'All categories'),
    [categoryFilter],
  )

  const localStyles = useMemo(
    () =>
      StyleSheet.create({
        filterRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 8,
        },
        chip: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          backgroundColor: '#FAFAFA',
        },
        chipActive: {
          borderColor: branding.colors.success,
          backgroundColor: '#ECFDF5',
        },
        chipText: { fontSize: 11, fontWeight: '700', color: branding.colors.muted },
        chipTextActive: { color: branding.colors.success },
        categoryBtn: {
          alignSelf: 'flex-start',
          marginBottom: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          backgroundColor: '#F9FAFB',
        },
        categoryBtnText: { fontSize: 11, fontWeight: '700', color: branding.colors.text },
        list: { maxHeight: 340 },
        row: {
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        },
        rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        rowBody: { flex: 1, minWidth: 0 },
        rowTitle: { fontSize: 13, fontWeight: '700', color: branding.colors.text },
        rowMeta: { fontSize: 11, color: branding.colors.muted, marginTop: 2 },
        rowRoute: { fontSize: 11, color: branding.colors.primary, marginTop: 4 },
        rowAmount: { fontSize: 13, fontWeight: '800', color: branding.colors.text },
        badge: {
          alignSelf: 'flex-start',
          marginTop: 4,
          paddingHorizontal: 6,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: '#F3F4F6',
        },
        badgeText: { fontSize: 10, fontWeight: '700', color: branding.colors.muted },
        footer: { marginTop: 8, fontSize: 11, color: branding.colors.muted, textAlign: 'right' },
        modalBackdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.35)',
          justifyContent: 'flex-end',
        },
        modalSheet: {
          backgroundColor: '#fff',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          maxHeight: '60%',
          paddingBottom: 24,
        },
        modalHeader: {
          padding: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#F3F4F6',
        },
        modalTitle: { fontSize: 15, fontWeight: '800', color: branding.colors.text },
        modalOption: {
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: '#F3F4F6',
        },
        modalOptionActive: { backgroundColor: '#ECFDF5' },
        modalOptionText: { fontSize: 14, color: branding.colors.text },
      }),
    [branding.colors],
  )

  if (loading && items.length === 0) {
    return (
      <View style={{ paddingVertical: 12, alignItems: 'center' }}>
        <ActivityIndicator color={branding.colors.primary} />
      </View>
    )
  }

  if (error && items.length === 0) {
    return (
      <View>
        <Text style={widgetStyles.empty}>{error}</Text>
        <Pressable onPress={load} style={{ marginTop: 8 }}>
          <Text style={{ color: branding.colors.primary, fontWeight: '700', fontSize: 13 }}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <View style={localStyles.filterRow}>
        {PAYMENT_FILTERS.map((chip) => {
          const active = paymentFilter === chip.key
          return (
            <Pressable
              key={chip.key}
              style={[localStyles.chip, active ? localStyles.chipActive : null]}
              onPress={() => setPaymentFilter(chip.key)}
            >
              <Text style={[localStyles.chipText, active ? localStyles.chipTextActive : null]}>
                {chip.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <Pressable style={localStyles.categoryBtn} onPress={() => setCategoryModalOpen(true)}>
        <Text style={localStyles.categoryBtnText} numberOfLines={1}>
          Category: {categoryLabel}
        </Text>
      </Pressable>

      {items.length === 0 ? (
        <Text style={widgetStyles.empty}>No expenses in this period.</Text>
      ) : (
        <ScrollView style={localStyles.list} nestedScrollEnabled showsVerticalScrollIndicator>
          {items.map((item) => (
            <View key={item.id} style={localStyles.row}>
              <View style={localStyles.rowTop}>
                <View style={localStyles.rowBody}>
                  <Text style={localStyles.rowTitle} numberOfLines={2}>
                    {item.description || item.category || 'Expense'}
                  </Text>
                  <Text style={localStyles.rowMeta}>
                    {formatExpenseDate(item.date)}
                    {item.paymentMethod ? ` · ${item.paymentMethod}` : ''}
                  </Text>
                  {item.category ? (
                    <View style={localStyles.badge}>
                      <Text style={localStyles.badgeText}>{item.category}</Text>
                    </View>
                  ) : null}
                  {item.paymentRoute ? (
                    <Text style={localStyles.rowRoute} numberOfLines={2}>
                      {item.paymentRoute}
                    </Text>
                  ) : null}
                </View>
                <Text style={localStyles.rowAmount}>
                  {fmtMoney(item.amount, item.currency || 'USD')}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {total > 0 ? (
        <Text style={localStyles.footer}>
          Showing {items.length} of {total} expense{total === 1 ? '' : 's'} (YTD)
        </Text>
      ) : null}

      <Modal
        visible={categoryModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalOpen(false)}
      >
        <Pressable style={localStyles.modalBackdrop} onPress={() => setCategoryModalOpen(false)}>
          <Pressable style={localStyles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={localStyles.modalHeader}>
              <Text style={localStyles.modalTitle}>Filter by category</Text>
            </View>
            <ScrollView>
              <Pressable
                style={[localStyles.modalOption, !categoryFilter ? localStyles.modalOptionActive : null]}
                onPress={() => {
                  setCategoryFilter('')
                  setCategoryModalOpen(false)
                }}
              >
                <Text style={localStyles.modalOptionText}>All categories</Text>
              </Pressable>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  style={[localStyles.modalOption, categoryFilter === cat ? localStyles.modalOptionActive : null]}
                  onPress={() => {
                    setCategoryFilter(cat)
                    setCategoryModalOpen(false)
                  }}
                >
                  <Text style={localStyles.modalOptionText}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  )
}
