/**
 * Enquiry performance marks (non-sensitive). Enable with:
 *   localStorage.setItem('ops.debugEnquiryPerf', '1')
 */
const ENABLED_KEY = 'ops.debugEnquiryPerf'

function enquiryPerfEnabled() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function markEnquiry(name) {
  if (!enquiryPerfEnabled() || typeof performance === 'undefined' || !performance.mark) return
  try {
    performance.mark(`enquiry:${name}`)
  } catch {
    /* ignore */
  }
}

export function measureEnquiry(name, startMark, endMark) {
  if (!enquiryPerfEnabled() || typeof performance === 'undefined' || !performance.measure) return
  try {
    performance.measure(`enquiry:${name}`, `enquiry:${startMark}`, `enquiry:${endMark}`)
  } catch {
    /* ignore */
  }
}
