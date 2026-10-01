import { describe, expect, it } from 'vitest'
import { fmCallButtonStatus, fmCallPhaseFor } from './fmCall'

describe('fmCallPhaseFor', () => {
  it('waits while the call is open; acknowledged or resolved means the F.M is coming', () => {
    expect(fmCallPhaseFor({ status: 'OPEN' })).toBe('waiting')
    expect(fmCallPhaseFor({ status: 'ACKNOWLEDGED' })).toBe('coming')
    expect(fmCallPhaseFor({ status: 'RESOLVED' })).toBe('coming')
  })
})

describe('fmCallButtonStatus', () => {
  it('labels the button only while a call is in progress', () => {
    expect(fmCallButtonStatus('idle')).toBeUndefined()
    expect(fmCallButtonStatus('error')).toBeUndefined()
    expect(fmCallButtonStatus('sending')).toBe('Calling…')
    expect(fmCallButtonStatus('waiting')).toBe('Waiting for F.M…')
    expect(fmCallButtonStatus('coming')).toBe('F.M is coming')
  })
})
