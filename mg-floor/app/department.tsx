import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { LoadingBlock, Screen } from '@/src/components/ui'

/** Department pick is retired — employees log in with username/password from any department. */
export default function DepartmentScreen() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return (
    <Screen>
      <LoadingBlock label="Opening employee login…" />
    </Screen>
  )
}
