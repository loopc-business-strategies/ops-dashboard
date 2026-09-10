/** Feature flag for temporary PCC Demo View. Unset/false removes the Demo button. */
export function isProductionDemoEnabled() {
  return String(import.meta.env.VITE_ENABLE_PRODUCTION_DEMO || '').toLowerCase() === 'true'
}
