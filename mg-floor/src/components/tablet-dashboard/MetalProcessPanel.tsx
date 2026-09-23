import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { tabletDashboard as td } from '@/src/theme'

export type MetalLine = {
  metal: string
  qty: string
  purity: string
  time: string
}

export type MetalBatchBlock = {
  batchLabel: string
  lines: MetalLine[]
}

type Props = {
  title: string
  batches: MetalBatchBlock[]
  onHeaderPress?: () => void
}

function DataCols({ line, isHeader }: { line: MetalLine; isHeader?: boolean }) {
  return (
    <>
      <Text style={[styles.cell, styles.colMetal, isHeader && styles.headerCell]}>{line.metal}</Text>
      <Text style={[styles.cell, styles.colQty, isHeader && styles.headerCell]}>{line.qty}</Text>
      <Text style={[styles.cell, styles.colPurity, isHeader && styles.headerCell]}>{line.purity}</Text>
      <Text style={[styles.cell, styles.colTime, isHeader && styles.headerCell]}>{line.time}</Text>
    </>
  )
}

export function MetalProcessPanel({ title, batches, onHeaderPress }: Props) {
  const HeaderWrap = onHeaderPress ? Pressable : View
  return (
    <View style={styles.wrap}>
      <HeaderWrap
        accessibilityRole={onHeaderPress ? 'button' : undefined}
        onPress={onHeaderPress}
        style={styles.header}
      >
        <Text style={styles.headerText}>{title}</Text>
      </HeaderWrap>
      <View style={styles.body}>
        <View style={styles.subHeader}>
          <Text style={styles.subHeaderText}>Total Process</Text>
        </View>
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.colBatch, styles.headerCell]}>Batch</Text>
            <DataCols line={{ metal: 'Metal', qty: 'Qty', purity: 'Purity', time: 'Time' }} isHeader />
          </View>
          {batches.map((batch, batchIdx) => (
            <View
              key={batch.batchLabel}
              style={[styles.batchGroup, batchIdx === batches.length - 1 && styles.batchGroupLast]}
            >
              <View style={styles.batchLabelCol}>
                <Text style={styles.batchText}>{batch.batchLabel}</Text>
              </View>
              <View style={styles.batchLines}>
                {batch.lines.map((line, idx) => (
                  <View
                    key={`${batch.batchLabel}-${line.metal}-${idx}`}
                    style={[styles.lineRow, idx === batch.lines.length - 1 && styles.lineRowLast]}
                  >
                    <DataCols
                      line={{
                        metal: line.metal,
                        qty: line.qty || '--',
                        purity: line.purity || '--',
                        time: line.time || '--',
                      }}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
  },
  header: {
    backgroundColor: td.orange,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: td.radius,
    borderTopRightRadius: td.radius,
  },
  headerText: {
    color: td.white,
    fontWeight: '800',
    fontSize: 22,
    letterSpacing: 0.3,
  },
  body: {
    flex: 1,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: td.border,
    borderBottomLeftRadius: td.radius,
    borderBottomRightRadius: td.radius,
    backgroundColor: td.white,
    minHeight: 0,
    overflow: 'hidden',
  },
  subHeader: {
    backgroundColor: td.cream,
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  subHeaderText: {
    color: td.text,
    fontWeight: '700',
    fontSize: 15,
  },
  table: { flex: 1 },
  row: {
    flexDirection: 'row',
    minHeight: 40,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: td.borderGrid,
  },
  headerRow: {
    backgroundColor: td.cream,
    borderBottomColor: td.borderLight,
    minHeight: 40,
  },
  batchGroup: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: td.borderLight,
    minHeight: 80,
  },
  batchGroupLast: {
    borderBottomWidth: 0,
  },
  batchLabelCol: {
    width: 56,
    borderRightWidth: 1,
    borderRightColor: td.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: td.cream,
  },
  batchText: {
    color: td.text,
    fontWeight: '800',
    fontSize: 16,
  },
  batchLines: { flex: 1 },
  lineRow: {
    flexDirection: 'row',
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: td.borderGrid,
    alignItems: 'center',
  },
  lineRowLast: { borderBottomWidth: 0 },
  cell: {
    color: td.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 10,
    paddingHorizontal: 8,
    textAlign: 'center',
  },
  headerCell: {
    fontWeight: '700',
    color: td.textMuted,
    fontSize: 13,
    letterSpacing: 0.2,
  },
  colBatch: { width: 56 },
  colMetal: { flex: 1.15, textAlign: 'left' },
  colQty: { flex: 1 },
  colPurity: { flex: 1 },
  colTime: { flex: 1 },
})
