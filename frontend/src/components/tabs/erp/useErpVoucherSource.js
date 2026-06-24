import { useState } from 'react'

export function useErpVoucherSource({
  token,
  setError,
  api,
}) {
  const [voucherSource, setVoucherSource] = useState(null)
  const [voucherSourceLoading, setVoucherSourceLoading] = useState(false)

  const handleOpenVoucherSource = async (ledgerId) => {
    if (!ledgerId) return
    try {
      setVoucherSourceLoading(true)
      const data = await api.getTransactionSourceByLedger(token, ledgerId)
      setVoucherSource(data)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load voucher source')
    } finally {
      setVoucherSourceLoading(false)
    }
  }

  return {
    voucherSource,
    setVoucherSource,
    voucherSourceLoading,
    handleOpenVoucherSource,
  }
}
