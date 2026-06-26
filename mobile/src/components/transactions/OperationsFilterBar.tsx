import { useMemo, useState } from 'react'
import { FlatList, Modal, Platform, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import type { AccountListItem } from '@/src/api/erpReports'
import {
  TRANSACTION_STATUS_OPTIONS,
  TRANSACTION_TYPE_FILTER_OPTIONS,
  filterTypeFilterOptions,
  normalizeOperationKey,
  operationKeyFilterLabel,
} from '@/src/constants/transactionTypes'
import {
  formatMonthPillLabel,
  monthPresets,
  type OperationsFilterState,
} from '@/src/utils/operationsFeed'
import { groupAccountsByType } from '@/src/utils/accountListGroups'
import type { OperationsStyles } from '@/src/components/transactions/operationsStyles'

type SheetKind = 'month' | 'account' | 'type' | null

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

function truncateLabel(text: string, max = 22): string {
  const raw = String(text || '').trim()
  if (raw.length <= max) return raw
  return `${raw.slice(0, max - 1)}…`
}

type FilterPillProps = {
  label: string
  onPress: () => void
  pillStyles: ReturnType<typeof usePillStyles>
  primary?: boolean
  flex?: boolean
}

function FilterPill({ label, onPress, pillStyles, primary, flex }: FilterPillProps) {
  return (
    <Pressable
      style={[
        pillStyles.pill,
        primary ? pillStyles.pillPrimary : null,
        flex ? pillStyles.pillFlex : null,
      ]}
      onPress={onPress}
    >
      <View style={[pillStyles.pillInner, flex ? pillStyles.pillInnerFlex : null]}>
        <Text
          style={[
            pillStyles.pillLabel,
            primary ? pillStyles.pillLabelPrimary : null,
            flex ? pillStyles.pillLabelFlex : null,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
          {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
        >
          {label}
        </Text>
        <Text
          style={[pillStyles.chevron, primary ? pillStyles.chevronPrimary : null]}
          {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
        >
          ▾
        </Text>
      </View>
    </Pressable>
  )
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

  const typeOptions = useMemo(
    () => filterTypeFilterOptions(TRANSACTION_TYPE_FILTER_OPTIONS, canTransactions, canLedger),
    [canTransactions, canLedger],
  )

  const months = useMemo(() => monthPresets(24), [])

  const typeLabel = useMemo(
    () => operationKeyFilterLabel(filters.operationKey, typeOptions),
    [filters.operationKey, typeOptions],
  )

  const accountLabel = useMemo(() => {
    if (!filters.accountCode) return 'Accounts and cards'
    const acc = accounts.find((a) => a.accountCode === filters.accountCode)
    if (acc?.accountName) return truncateLabel(acc.accountName)
    return filters.accountCode
  }, [filters.accountCode, accounts])

  const monthLabel = formatMonthPillLabel(filters.startDate, filters.endDate)

  const accountSections = useMemo(
    () => groupAccountsByType(accounts, accountSearch),
    [accounts, accountSearch],
  )

  const pillStyles = usePillStyles(branding)

  const closeSheet = () => {
    setSheet(null)
    setAccountSearch('')
  }

  const applyMonth = (startDate: string, endDate: string) => {
    const next = { ...draftFilters, startDate, endDate }
    onChangeDraft(next)
    onApply(next)
    closeSheet()
  }

  return (
    <>
      <View style={pillStyles.row}>
        <FilterPill
          label={monthLabel}
          onPress={() => setSheet('month')}
          pillStyles={pillStyles}
          primary
        />
        <FilterPill
          label={accountLabel}
          onPress={() => setSheet('account')}
          pillStyles={pillStyles}
          flex
        />
        <FilterPill
          label={typeLabel}
          onPress={() => setSheet('type')}
          pillStyles={pillStyles}
        />
      </View>

      <Modal visible={sheet === 'month'} animationType="slide" transparent onRequestClose={closeSheet}>
        <Pressable style={styles.modalBackdrop} onPress={closeSheet}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Month</Text>
            <FlatList
              data={months}
              keyExtractor={(item) => `${item.startDate}-${item.endDate}`}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const active =
                  filters.startDate === item.startDate && filters.endDate === item.endDate
                return (
                  <Pressable
                    style={styles.sheetOption}
                    onPress={() => applyMonth(item.startDate, item.endDate)}
                  >
                    <Text style={[styles.sheetOptionText, active && styles.sheetOptionActive]}>
                      {item.label}
                    </Text>
                  </Pressable>
                )
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sheet === 'type'} animationType="slide" transparent onRequestClose={closeSheet}>
        <Pressable style={styles.modalBackdrop} onPress={closeSheet}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Type</Text>
            <FlatList
              data={typeOptions}
              keyExtractor={(item) => item.key || 'all'}
              style={{ maxHeight: canTransactions ? 280 : 360 }}
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
                      normalizeOperationKey(filters.operationKey) === item.key && styles.sheetOptionActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
            {canTransactions ? (
              <>
                <Text style={pillStyles.advancedLabel}>Status</Text>
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
              </>
            ) : null}
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
            <Pressable
              style={styles.accountRow}
              onPress={() => {
                const next = { ...draftFilters, accountCode: '' }
                onChangeDraft(next)
                onApply(next)
                closeSheet()
              }}
            >
              <Text
                style={[
                  styles.accountRowName,
                  !filters.accountCode ? styles.sheetOptionActive : null,
                ]}
                numberOfLines={2}
              >
                All accounts
              </Text>
            </Pressable>
            <SectionList
              sections={accountSections}
              keyExtractor={(item) => item._id || item.accountCode || item.accountName || 'row'}
              style={{ maxHeight: 360 }}
              stickySectionHeadersEnabled
              renderSectionHeader={({ section: { title } }) => (
                <Text style={pillStyles.sectionHeader}>{title}</Text>
              )}
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
                  <Text
                    style={[
                      styles.accountRowName,
                      filters.accountCode === item.accountCode ? styles.sheetOptionActive : null,
                    ]}
                    numberOfLines={2}
                  >
                    {item.accountName || item.accountCode}
                  </Text>
                  <Text style={styles.accountRowCode} numberOfLines={1}>
                    {item.accountCode}
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
    row: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    pill: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: '#E5E7EB',
      backgroundColor: '#FFFFFF',
      marginRight: 8,
      flexShrink: 0,
      minWidth: 72,
    },
    pillFlex: {
      flex: 1,
      minWidth: 0,
      marginRight: 0,
    },
    pillPrimary: {
      backgroundColor: `${b.colors.secondary}33`,
      borderColor: `${b.colors.secondary}66`,
    },
    pillInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    pillInnerFlex: {
      flex: 1,
      minWidth: 0,
    },
    pillLabel: {
      flexShrink: 0,
      fontSize: 13,
      fontWeight: '600',
      color: b.colors.text,
    },
    pillLabelFlex: {
      flex: 1,
      minWidth: 0,
      flexShrink: 1,
      maxWidth: undefined,
    },
    pillLabelPrimary: {
      color: b.colors.primary,
    },
    chevron: {
      flexShrink: 0,
      fontSize: 12,
      color: b.colors.muted,
      lineHeight: 14,
    },
    chevronPrimary: {
      color: b.colors.primary,
    },
    advancedLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: b.colors.muted,
      marginTop: 12,
      marginBottom: 4,
      textTransform: 'uppercase',
    },
    sectionHeader: {
      fontSize: 12,
      fontWeight: '700',
      color: b.colors.muted,
      marginTop: 10,
      marginBottom: 4,
      textTransform: 'uppercase',
      backgroundColor: '#FFFFFF',
      paddingTop: 4,
    },
  })
}
