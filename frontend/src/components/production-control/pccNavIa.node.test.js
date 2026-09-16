import { describe, expect, test } from 'vitest'
import {
  SECTION_GROUPS,
  SECTION_IDS,
  SECTION_ALIASES,
  formatClock,
  getSectionTrail,
  resolveSectionId,
} from './shared'
import {
  PCC_SIDEBAR_GROUPS,
  STOCK_SECTION_IDS,
  METAL_SECTION_IDS,
  isSidebarItemActive,
  isStockSection,
  isMetalSection,
} from './pccSidebarConfig'

describe('PCC nav IA', () => {
  test('PRODUCTION group includes journey, department flow and planning', () => {
    const production = SECTION_GROUPS.find((g) => g.id === 'production')
    expect(production?.label).toBe('PRODUCTION')
    expect(production?.sections.some((s) => s.id === 'dept-flow')).toBe(true)
    expect(production?.sections.some((s) => s.id === 'planning')).toBe(true)
    expect(production?.sections.some((s) => s.id === 'journey')).toBe(true)
    expect(SECTION_IDS.has('dept-flow')).toBe(true)
    expect(SECTION_IDS.has('planning')).toBe(true)
    expect(SECTION_IDS.has('journey')).toBe(true)
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
    for (const id of METAL_SECTION_IDS) sidebarIds.add(id)
    for (const id of SECTION_IDS) {
      if (String(id).startsWith('stock-')) {
        expect(isStockSection(id)).toBe(true)
        continue
      }
      if (METAL_SECTION_IDS.includes(id)) {
        expect(isMetalSection(id)).toBe(true)
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

  test('metal hub highlights custody movements and passes', () => {
    const metalItem = { id: 'metal-custody', label: 'Metal Control', metalHub: true }
    expect(isSidebarItemActive('movements', metalItem)).toBe(true)
    expect(isSidebarItemActive('passes', metalItem)).toBe(true)
    expect(isSidebarItemActive('metal-custody', metalItem)).toBe(true)
    expect(isSidebarItemActive('batches', metalItem)).toBe(false)
  })

  test('section aliases resolve to canonical ids', () => {
    expect(resolveSectionId('stock')).toBe('stock-overview')
    expect(resolveSectionId('stock-available')).toBe('stock-selection')
    expect(resolveSectionId('custody')).toBe('metal-custody')
    expect(resolveSectionId('delays')).toBe('delay-monitor')
    expect(resolveSectionId('metal-control')).toBe('metal-custody')
    expect(resolveSectionId('live')).toBe('live')
    expect(resolveSectionId('journey')).toBe('journey')
    expect(resolveSectionId('nope')).toBe('live')
    expect(SECTION_ALIASES.stock).toBe('stock-overview')
  })

  test('sidebar groups include COMMAND MATERIAL QUALITY FACTORY REPORTS', () => {
    const labels = PCC_SIDEBAR_GROUPS.map((g) => g.label)
    expect(labels).toEqual(expect.arrayContaining(['COMMAND', 'PRODUCTION', 'MATERIAL', 'QUALITY', 'FACTORY', 'REPORTS', 'ADMIN']))
  })

  test('sidebar PRODUCTION includes Production Journey', () => {
    const production = PCC_SIDEBAR_GROUPS.find((g) => g.id === 'production')
    expect(production?.items.some((i) => i.id === 'journey' && i.label === 'Production Journey')).toBe(true)
  })
})
