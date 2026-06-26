import { Pressable, SectionList, Text, View } from 'react-native'
import type { MobileTenantBranding } from '@/src/config/tenantBranding'
import OperationListItem from '@/src/components/transactions/OperationListItem'
import type { OperationEntry } from '@/src/utils/operationsFeed'
import { categoryLabel, formatMoneyAmount, groupEntriesByDate } from '@/src/utils/operationsFeed'
import type { OperationsStyles } from '@/src/components/transactions/operationsStyles'

type CategoryDetailViewProps = {
  categoryKey: string
  entries: OperationEntry[]
  total: number
  currency: string
  periodLabel: string
  branding: MobileTenantBranding
  styles: OperationsStyles
  onBack: () => void
  onSelectEntry: (entry: OperationEntry) => void
}

export default function CategoryDetailView({
  categoryKey,
  entries,
  total,
  currency,
  periodLabel,
  branding,
  styles,
  onBack,
  onSelectEntry,
}: CategoryDetailViewProps) {
  const sections = groupEntriesByDate(entries)
  const label = categoryLabel(categoryKey)

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <>
          <View style={styles.subHeader}>
            <Pressable style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backText}>‹</Text>
            </Pressable>
            <Text style={styles.subHeaderTitle}>{label}</Text>
          </View>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryHeroTitle}>{label}</Text>
            <Text style={styles.categoryHeroPeriod}>{periodLabel}</Text>
            <Text style={styles.categoryHeroAmount}>
              {formatMoneyAmount(-Math.abs(total), currency, true)}
            </Text>
          </View>
        </>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <OperationListItem
          entry={item}
          styles={styles}
          branding={branding}
          onPress={() => onSelectEntry(item)}
        />
      )}
      ListEmptyComponent={<Text style={styles.empty}>No operations in this category.</Text>}
    />
  )
}
