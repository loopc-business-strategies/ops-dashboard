import { useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import type { AccountListItem } from '@/src/api/erpReports'
import DateField from '@/src/components/common/DateField'
import {
  OPERATION_TYPE_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
} from '@/src/constants/transactionTypes'
import {
  currentMonthDateRange,
  formatPeriodLabel,
  lastMonthDateRange,
  type OperationsFilterState,
} from '@/src/utils/operationsFeed'
import { filterOperationOptions } from '@/src/utils/operationsFeed'
import type { OperationsStyles } from '@/src/components/transactions/operationsStyles'

type SheetKind = 'date' | 'account' | 'operation' | 'status' | null

type OperationsFilterBarProps = {
  filters: OperationsFilterState
  draftFilters: OperationsFilterState
  onChangeDraft: (next: OperationsFilterState) => void
  onApply: (override?: OperationsFilterState) => void
  accounts: AccountListItem[]
  canTransactions: boolean
  canLedger: boolean
  branding: MobileTenantBranding
  styles: OperationsStyles
}

export default function OperationsFilterBar({
  filters,
  draftFilters,
  onChangeDraft,
  onApply,
  accounts,
  canTransactions,
  canLedger,
  branding,
  styles,
}: OperationsFilterBarProps) {
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [accountSearch, setAccountSearch] = useState('')

  const operationOptions = useMemo(
    () => filterOperationOptions(OPERATION_TYPE_OPTIONS, canTransactions, canLedger),
    [canTransactions, canLedger],
  )

  const operationLabel = useMemo(() => {
    const opt = operationOptions.find((o) => o.key === filters.operationKey)
    return opt?.label || 'All transactions'
  }, [filters.operationKey, operationOptions])

  const accountLabel = useMemo(() => {
    if (!filters.accountCode) return 'Accounts and cards'
    const acc = accounts.find((a) => a.accountCode === filters.accountCode)
    return acc ? `${acc.accountCode}` : filters.accountCode
  }, [filters.accountCode, accounts])

  const dateLabel = formatPeriodLabel(filters.startDate, filters.endDate)

  const filteredAccounts = useMemo(() => {
    const q = accountSearch.trim().toLowerCase()
    if (!q) return accounts
    return accounts.filter(
      (a) =>
        String(a.accountCode || '').toLowerCase().includes(q) ||
        String(a.accountName || '').toLowerCase().includes(q),
    )
  }, [accounts, accountSearch])

  const pillStyles = usePillStyles(branding)

  const closeSheet = () => {
    setSheet(null)
    setAccountSearch('')
  }

  const applyDatePreset = (range: { startDate: string; endDate: string }) => {
    const next = { ...draftFilters, ...range }
    onChangeDraft(next)
    onApply(next)
    closeSheet()
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={pillStyles.row}
      >
        <Pressable style={[pillStyles.pill, pillStyles.pillPrimary]} onPress={() => setSheet('date')}>
          <Text style={[pillStyles.pillText, pillStyles.pillTextPrimary]} numberOfLines={1}>
            {dateLabel}
          </Text>
          <Text style={[pillStyles.chevron, pillStyles.chevronPrimary]}>▾</Text>
        </Pressable>
        <Pressable style={pillStyles.pill} onPress={() => setSheet('account')}>
          <Text style={pillStyles.pillText} numberOfLines={1}>
            {accountLabel}
          </Text>
          <Text style={pillStyles.chevron}>▾</Text>
        </Pressable>
        <Pressable style={pillStyles.pill} onPress={() => setSheet('operation')}>
          <Text style={pillStyles.pillText} numberOfLines={1}>
            {operationLabel}
          </Text>
          <Text style={pillStyles.chevron}>▾</Text>
        </Pressable>
        {canTransactions ? (
          <Pressable style={pillStyles.pill} onPress={() => setSheet('status')}>
            <Text style={pillStyles.pillText} numberOfLines={1}>
              {TRANSACTION_STATUS_OPTIONS.find((o) => o.value === filters.status)?.label || 'Status'}
            </Text>
            <Text style={pillStyles.chevron}>▾</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal visible={sheet === 'date'} animationType="slide" transparent onRequestClose={closeSheet}>
        <Pressable style={styles.modalBackdrop} onPress={closeSheet}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Date range</Text>
            <Pressable style={styles.sheetOption} onPress={() => applyDatePreset(currentMonthDateRange())}>
              <Text style={styles.sheetOptionText}>This month</Text>
            </Pressable>
            <Pressable style={styles.sheetOption} onPress={() => applyDatePreset(lastMonthDateRange())}>
              <Text style={styles.sheetOptionText}>Last month</Text>
            </Pressable>
            <View style={{ marginTop: 8 }}>
              <DateField
                label="From"
                value={draftFilters.startDate}
                onChange={(startDate) => onChangeDraft({ ...draftFilters, startDate })}
              />
              <DateField
                label="To"
                value={draftFilters.endDate}
                onChange={(endDate) => onChangeDraft({ ...draftFilters, endDate })}
              />
            </View>
            <Pressable
              style={[pillStyles.applyBtn, { marginTop: 12 }]}
              onPress={() => {
                onApply()
                closeSheet()
              }}
            >
              <Text style={pillStyles.applyBtnText}>Apply</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sheet === 'operation'} animationType="slide" transparent onRequestClose={closeSheet}>
        <Pressable style={styles.modalBackdrop} onPress={closeSheet}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Transaction type</Text>
            <FlatList
              data={operationOptions}
              keyExtractor={(item) => item.key || 'all'}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.sheetOption}
                  onPress={() => {
                    const next = { ...draftFilters, operationKey: item.key }
                    onChangeDraft(next)
                    onApply(next)
                    closeSheet()
                  }}
                >
                  <Text
                    style={[
                      styles.sheetOptionText,
                      filters.operationKey === item.key && styles.sheetOptionActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sheet === 'status'} animationType="slide" transparent onRequestClose={closeSheet}>
        <Pressable style={styles.modalBackdrop} onPress={closeSheet}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Voucher status</Text>
            {TRANSACTION_STATUS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value || 'all'}
                style={styles.sheetOption}
                onPress={() => {
                  const next = { ...draftFilters, status: opt.value }
                  onChangeDraft(next)
                  onApply(next)
                  closeSheet()
                }}
              >
                <Text
                  style={[
                    styles.sheetOptionText,
                    filters.status === opt.value && styles.sheetOptionActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sheet === 'account'} animationType="slide" transparent onRequestClose={closeSheet}>
        <Pressable style={styles.modalBackdrop} onPress={closeSheet}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Accounts and cards</Text>
            <TextInput
              style={styles.input}
              placeholder="Search accounts…"
              placeholderTextColor={branding.colors.muted}
              value={accountSearch}
              onChangeText={setAccountSearch}
            />
            <FlatList
              data={[{ _id: '', accountCode: '', accountName: 'All accounts' }, ...filteredAccounts]}
              keyExtractor={(item) => item._id || 'all'}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.accountRow}
                  onPress={() => {
                    const next = { ...draftFilters, accountCode: item.accountCode || '' }
                    onChangeDraft(next)
                    onApply(next)
                    closeSheet()
                  }}
                >
                  <Text style={styles.accountRowCode}>{item.accountCode || '—'}</Text>
                  <Text style={styles.accountRowName} numberOfLines={1}>
                    {item.accountName || 'All accounts'}
                  </Text>
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

function usePillStyles(b: MobileTenantBranding) {
  return StyleSheet.create({
    row: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      backgroundColor: '#FFFFFF',
      maxWidth: 200,
    },
    pillPrimary: {
      backgroundColor: `${b.colors.secondary}22`,
      borderColor: `${b.colors.secondary}55`,
    },
    pillText: { fontSize: 13, fontWeight: '600', color: b.colors.text, marginRight: 4 },
    pillTextPrimary: { color: b.colors.primary },
    chevron: { fontSize: 10, color: b.colors.muted },
    chevronPrimary: { color: b.colors.primary },
    applyBtn: {
      backgroundColor: b.colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    applyBtnText: { color: '#FFFFFF', fontWeight: '700' },
  })
}
