import { describe, expect, test } from 'vitest'
import { SECTION_GROUPS, SECTION_IDS, formatClock, getSectionTrail } from './shared'

describe('PCC nav IA', () => {
  test('PRODUCTION group includes department flow and planning', () => {
    const production = SECTION_GROUPS.find((g) => g.id === 'production')
    expect(production?.label).toBe('PRODUCTION')
    expect(production?.sections.some((s) => s.id === 'dept-flow')).toBe(true)
    expect(production?.sections.some((s) => s.id === 'planning')).toBe(true)
    expect(SECTION_IDS.has('dept-flow')).toBe(true)
    expect(SECTION_IDS.has('planning')).toBe(true)
  })

  test('Floor Attendance keeps stable section id', () => {
    const factory = SECTION_GROUPS.find((g) => g.id === 'factory')
    const attendance = factory?.sections.find((s) => s.id === 'floor-attendance')
    expect(attendance?.label).toBe('Floor Attendance')
  })

  test('formatClock returns HH:MM-like string', () => {
    const out = formatClock(new Date('2026-09-16T08:04:00'))
    expect(out).toMatch(/\d{1,2}:\d{2}/)
  })

  test('getSectionTrail resolves group and section labels', () => {
    const trail = getSectionTrail('planning')
    expect(trail?.group.label).toBe('PRODUCTION')
    expect(trail?.section.label).toBe('Planning')
    expect(getSectionTrail('missing-section')).toBeNull()
  })

  test('Cost Tracking is not in nav until a real cost API exists', () => {
    const allIds = [...SECTION_IDS]
    expect(allIds.some((id) => /cost/i.test(id))).toBe(false)
    expect(
      SECTION_GROUPS.some((g) => g.sections.some((s) => /cost/i.test(s.label))),
    ).toBe(false)
  })
})
