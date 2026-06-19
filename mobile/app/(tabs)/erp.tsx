import { useLocalSearchParams } from 'expo-router'
import ErpReportsScreen from '@/src/components/erp/ErpReportsScreen'

export default function ErpScreen() {
  const { account, view } = useLocalSearchParams<{ account?: string; view?: string }>()
  return (
    <ErpReportsScreen
      initialAccountCode={String(account || '').trim()}
      initialView={String(view || '').trim()}
    />
  )
}
