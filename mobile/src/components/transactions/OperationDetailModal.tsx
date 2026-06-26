import { Modal, Pressable, Text } from 'react-native'
import { apiTypeToLabel } from '@/src/constants/transactionTypes'
import type { OperationEntry } from '@/src/utils/operationsFeed'
import { getTransactionDescription, getTransactionPartyLabel } from '@/src/utils/transactionFilters'
import type { OperationsStyles } from '@/src/components/transactions/operationsStyles'

type OperationDetailModalProps = {
  entry: OperationEntry | null
  styles: OperationsStyles
  onClose: () => void
}

export default function OperationDetailModal({ entry, styles, onClose }: OperationDetailModalProps) {
  return (
    <Modal visible={Boolean(entry)} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          {entry ? (
            entry.kind === 'transaction' ? (
              <TransactionDetail entry={entry} styles={styles} onClose={onClose} />
            ) : (
              <JvDetail entry={entry} styles={styles} onClose={onClose} />
            )
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function TransactionDetail({
  entry,
  styles,
  onClose,
}: {
  entry: Extract<OperationEntry, { kind: 'transaction' }>
  styles: OperationsStyles
  onClose: () => void
}) {
  const tx = entry.row
  return (
    <>
      <Text style={styles.modalTitle}>{apiTypeToLabel(String(tx.type || ''))}</Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Status: </Text>
        {tx.status || '—'}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Date: </Text>
        {tx.date ? new Date(tx.date).toLocaleString() : '—'}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Amount: </Text>
        {tx.currency} {Number(tx.amount || 0).toLocaleString()}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Party: </Text>
        {getTransactionPartyLabel(tx)}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Description: </Text>
        {getTransactionDescription(tx)}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Debit: </Text>
        {tx.debitAccountId
          ? `${tx.debitAccountId.accountCode} — ${tx.debitAccountId.accountName}`
          : '—'}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Credit: </Text>
        {tx.creditAccountId
          ? `${tx.creditAccountId.accountCode} — ${tx.creditAccountId.accountName}`
          : '—'}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Attachments: </Text>
        {(tx.attachments || []).length}
      </Text>
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>Close</Text>
      </Pressable>
    </>
  )
}

function JvDetail({
  entry,
  styles,
  onClose,
}: {
  entry: Extract<OperationEntry, { kind: 'jv' }>
  styles: OperationsStyles
  onClose: () => void
}) {
  const v = entry.voucher
  return (
    <>
      <Text style={styles.modalTitle}>{entry.subtitle}</Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Voucher: </Text>
        {v.voucherNo}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Date: </Text>
        {v.date ? new Date(v.date).toLocaleString() : '—'}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Amount: </Text>
        {entry.currency} {Number(entry.amount || 0).toLocaleString()}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Narration: </Text>
        {v.narration}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Lines: </Text>
        {v.lineCount}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Debit accounts: </Text>
        {v.debitAccounts}
      </Text>
      <Text style={styles.detailLine}>
        <Text style={styles.detailLabel}>Credit accounts: </Text>
        {v.creditAccounts}
      </Text>
      {v.autoTxNo ? (
        <Text style={styles.detailLine}>
          <Text style={styles.detailLabel}>Auto tx no: </Text>
          {v.autoTxNo}
        </Text>
      ) : null}
      {v.chequeNo ? (
        <Text style={styles.detailLine}>
          <Text style={styles.detailLabel}>Cheque: </Text>
          {v.chequeNo}
        </Text>
      ) : null}
      <Pressable style={styles.closeBtn} onPress={onClose}>
        <Text style={styles.closeBtnText}>Close</Text>
      </Pressable>
    </>
  )
}
