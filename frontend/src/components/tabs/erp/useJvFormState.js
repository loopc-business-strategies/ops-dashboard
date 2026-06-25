import { useState } from 'react'
import { createJvHeader as createNextJvHeader, emptyJvLine } from './journalVoucherHelpers'

/**
 * Journal / Bank JV form state cluster (extracted from ERPTab).
 */
export function useJvFormState() {
  const [jvLines, setJvLines] = useState([emptyJvLine(1), emptyJvLine(2)])
  const [jvHeader, setJvHeader] = useState(() => createNextJvHeader([], 'USD', 'journal'))
  const [nextJvLineId, setNextJvLineId] = useState(3)
  const [jvMode, setJvMode] = useState('journal')
  const [ledgerVoucherTab, setLedgerVoucherTab] = useState('journal')
  const [jvEditEntryIds, setJvEditEntryIds] = useState([])
  const [jvReadOnly, setJvReadOnly] = useState(false)
  const [showLedgerForm, setShowLedgerForm] = useState(false)

  return {
    jvLines,
    setJvLines,
    jvHeader,
    setJvHeader,
    nextJvLineId,
    setNextJvLineId,
    jvMode,
    setJvMode,
    ledgerVoucherTab,
    setLedgerVoucherTab,
    jvEditEntryIds,
    setJvEditEntryIds,
    jvReadOnly,
    setJvReadOnly,
    showLedgerForm,
    setShowLedgerForm,
  }
}
