/**
 * Button label for syncing the seeded currency master.
 * Must stay aligned with backend currencyBootstrapService tenant masters.
 */
export function currencyMasterSyncLabel(tenant) {
  const key = String(tenant || '').trim().toLowerCase()
  if (key === 'vb') return 'Sync USD/AED'
  return 'Sync USD/EUR/AED/UZS'
}
