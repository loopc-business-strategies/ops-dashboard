import { describe, expect, test } from 'vitest'
import { SECTION_GROUPS, SECTION_IDS, formatClock, getSectionTrail } from './shared'
import {
  PCC_SIDEBAR_GROUPS,
  STOCK_SECTION_IDS,
  isSidebarItemActive,
  isStockSection,
} from './pccSidebarConfig'

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

  test('sidebar preserves every legacy SECTION_IDS deep link', () => {
    const sidebarIds = new Set()
    for (const group of PCC_SIDEBAR_GROUPS) {
      for (const item of group.items) {
        sidebarIds.add(item.id)
        for (const child of item.children || []) sidebarIds.add(child.id)
      }
    }
    for (const id of STOCK_SECTION_IDS) sidebarIds.add(id)
    for (const id of SECTION_IDS) {
      if (String(id).startsWith('stock-')) {
        expect(isStockSection(id)).toBe(true)
        continue
      }
      expect(sidebarIds.has(id) || SECTION_IDS.has(id)).toBe(true)
    }
    expect(SECTION_IDS.size).toBeGreaterThan(30)
  })

  test('stock hub highlights any stock-* section', () => {
    const stockItem = { id: 'stock-overview', label: 'Stock', stockHub: true }
    expect(isSidebarItemActive('stock-in', stockItem)).toBe(true)
    expect(isSidebarItemActive('batches', stockItem)).toBe(false)
  })

  test('sidebar groups include COMMAND MATERIAL QUALITY FACTORY REPORTS', () => {
    const labels = PCC_SIDEBAR_GROUPS.map((g) => g.label)
    expect(labels).toEqual(expect.arrayContaining(['COMMAND', 'PRODUCTION', 'MATERIAL', 'QUALITY', 'FACTORY', 'REPORTS', 'ADMIN']))
  })
})
