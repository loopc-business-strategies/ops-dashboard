/**
 * Static theme / contrast audit for frontend/src.
 * No new dependencies — Node built-ins only.
 *
 * Usage: node ./scripts/theme-contrast-audit.mjs
 * Exit 1 if critical contrast / invisible-text issues remain.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '../src')
const REPORT_DIR = path.resolve(__dirname, '../reports')
const REPORT_MD = path.join(REPORT_DIR, 'theme-contrast-audit.md')
const REPORT_JSON = path.join(REPORT_DIR, 'theme-contrast-audit.json')

const EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.css'])

const TENANT_HEX = new Set([
  '#EA580C', '#C2410C', '#FB923C', '#9A3412', '#F97316', '#FFF7ED', '#FED7AA', '#431407', '#7C2D12',
  '#16A34A', '#15803D', '#4ADE80', '#166534', '#22C55E', '#F0FDF4', '#BBF7D0', '#052E16', '#14532D',
  '#2563EB', '#1D4ED8', '#60A5FA', '#1E3A8A', '#3B82F6', '#EFF6FF', '#BFDBFE', '#172554',
])

const SEMANTIC_HEX = new Set([
  '#DC2626', '#EF4444', '#B91C1C', '#FF4757', '#F87171',
  '#D97706', '#F59E0B', '#FFD600', '#FBBF24', '#92400E',
  '#059669', '#047857', '#10B981', '#00C896', '#22C55E',
  '#0284C7', '#0EA5E9', '#00B4D8', '#3B82F6',
  '#6B7280', '#9CA3AF', '#374151', '#111827', '#1F2937', '#4B5563',
  '#FFFFFF', '#FFF', '#000000', '#000', '#F8F9FA', '#E5E7EB', '#F3F4F6',
])

const HEX_RE = /#(?:[0-9a-fA-F]{3,8})\b/g
const RGB_RE = /rgba?\(\s*[^)]+\)/gi
const TRANSPARENT_RE = /(?:^|[;{\s])(?:-webkit-text-fill-)?color\s*:\s*transparent\b/gi
const LOW_OPACITY_TEXT_RE = /(?:color\s*:[^;]{0,80}opacity\s*:\s*0(?:\.\d+)?|opacity\s*:\s*0(?:\.0+)?\s*;[^}]{0,40}color\s*:)/gi

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name === 'dist' || name.name === 'reports') continue
    const p = path.join(dir, name.name)
    if (name.isDirectory()) walk(p, files)
    else if (EXT.has(path.extname(name.name))) files.push(p)
  }
  return files
}

function rel(p) {
  return path.relative(path.resolve(__dirname, '..'), p).replace(/\\/g, '/')
}

function normalizeHex(h) {
  let x = h.toUpperCase()
  if (x.length === 4) x = `#${x[1]}${x[1]}${x[2]}${x[2]}${x[3]}${x[3]}`
  return x.slice(0, 7)
}

function luminance(hex) {
  const h = normalizeHex(hex).slice(1)
  const rgb = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

function contrastRatio(fg, bg) {
  const L1 = luminance(fg)
  const L2 = luminance(bg)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

function classifyHex(hex, fileRel, lineText) {
  const n = normalizeHex(hex)
  const lower = fileRel.toLowerCase()
  const line = lineText.toLowerCase()

  if (lower.includes('.test.') || lower.includes('.spec.') || lower.includes('fixture')) return 'TEST_FIXTURE'
  if (line.includes('var(--') || line.includes('brand-') || line.includes('--purple')) return 'TENANT_VARIABLE'
  if (TENANT_HEX.has(n) && (lower.includes('tenantbranding') || lower.includes('design-system') || lower.includes('mglogin'))) {
    return 'TENANT_VARIABLE'
  }
  if (SEMANTIC_HEX.has(n) || /danger|error|success|warning|overdue|debit|credit|loss|profit/.test(line)) {
    return 'SEMANTIC'
  }
  if (/chart|series|palette|legend|recharts|stroke|fill\s*:/.test(line) || lower.includes('chart')) {
    return 'CHART/DATA'
  }
  if (/focus|outline|a11y|accessibility|contrast/.test(line)) return 'ACCESSIBILITY'
  if (TENANT_HEX.has(n) && !lower.includes('tenantbranding')) return 'NEEDS_REVIEW'
  return 'COMPONENT_SPECIFIC'
}

function lineNumber(content, index) {
  return content.slice(0, index).split(/\r?\n/).length
}

function lineAt(content, index) {
  const start = content.lastIndexOf('\n', index - 1) + 1
  const end = content.indexOf('\n', index)
  return content.slice(start, end === -1 ? undefined : end).trim()
}

// Known AA pairs we require
const CTA_PAIRS = [
  { tenant: 'mg', bg: '#9A3412', fg: '#FFFFFF', min: 4.5, label: 'MG button bg + white' },
  { tenant: 'mg', bg: '#7C2D12', fg: '#FFFFFF', min: 4.5, label: 'MG button hover + white' },
  { tenant: 'cg', bg: '#166534', fg: '#FFFFFF', min: 4.5, label: 'CG button bg + white' },
  { tenant: 'cg', bg: '#14532D', fg: '#FFFFFF', min: 4.5, label: 'CG button hover + white' },
  { tenant: 'loopc', bg: '#1E3A8A', fg: '#FFFFFF', min: 4.5, label: 'LoopC button bg + white' },
  { tenant: 'loopc', bg: '#172554', fg: '#FFFFFF', min: 4.5, label: 'LoopC button hover + white' },
  { tenant: 'mg', bg: '#FFFFFF', fg: '#9A3412', min: 4.5, label: 'MG dark text on white' },
  { tenant: 'cg', bg: '#FFFFFF', fg: '#166534', min: 4.5, label: 'CG dark text on white' },
  { tenant: 'loopc', bg: '#FFFFFF', fg: '#1E3A8A', min: 4.5, label: 'LoopC dark text on white' },
]

// Identity primary + white (expected FAIL for MG/CG — must NOT be used for normal CTA text)
const IDENTITY_WHITE = [
  { tenant: 'mg', bg: '#EA580C', fg: '#FFFFFF', label: 'MG primary + white (identity; not for normal CTA text)' },
  { tenant: 'cg', bg: '#16A34A', fg: '#FFFFFF', label: 'CG primary + white (identity; not for normal CTA text)' },
  { tenant: 'loopc', bg: '#2563EB', fg: '#FFFFFF', label: 'LoopC primary + white' },
]

function main() {
  const files = walk(SRC)
  const hits = []
  let invisible = []

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    const fileRel = rel(file)

    for (const m of content.matchAll(HEX_RE)) {
      const hex = m[0]
      const ln = lineNumber(content, m.index)
      const text = lineAt(content, m.index)
      hits.push({
        type: 'hex',
        value: normalizeHex(hex),
        file: fileRel,
        line: ln,
        snippet: text.slice(0, 160),
        category: classifyHex(hex, fileRel, text),
      })
    }

    for (const m of content.matchAll(RGB_RE)) {
      const ln = lineNumber(content, m.index)
      const text = lineAt(content, m.index)
      hits.push({
        type: 'rgb',
        value: m[0].replace(/\s+/g, ''),
        file: fileRel,
        line: ln,
        snippet: text.slice(0, 160),
        category: /var\(--/.test(text) ? 'TENANT_VARIABLE' : 'COMPONENT_SPECIFIC',
      })
    }

    for (const m of content.matchAll(TRANSPARENT_RE)) {
      const ln = lineNumber(content, m.index)
      const text = lineAt(content, m.index)
      // Allow gradient text-clip technique and intentional MG art-only cases if any remain
      const ok = /-webkit-background-clip\s*:\s*text|text-gradient|background-clip:\s*text/.test(content.slice(Math.max(0, m.index - 120), m.index + 80))
      invisible.push({
        severity: ok ? 'info' : 'critical',
        file: fileRel,
        line: ln,
        snippet: text.slice(0, 160),
        reason: ok ? 'gradient text-fill (decorative)' : 'transparent text color',
      })
    }
  }

  const categoryCounts = {}
  for (const h of hits) categoryCounts[h.category] = (categoryCounts[h.category] || 0) + 1

  const contrastResults = CTA_PAIRS.map((p) => {
    const ratio = contrastRatio(p.fg, p.bg)
    return { ...p, ratio: Number(ratio.toFixed(2)), pass: ratio >= p.min }
  })

  const identityNote = IDENTITY_WHITE.map((p) => {
    const ratio = contrastRatio(p.fg, p.bg)
    return { ...p, ratio: Number(ratio.toFixed(2)), passAaNormal: ratio >= 4.5 }
  })

  const brandingSrc = fs.readFileSync(path.join(SRC, 'config/tenantBranding.js'), 'utf8')
  const hasButtonTokens = /brandButtonBg|--brand-button-bg/.test(brandingSrc)
  const ctaUsesDark =
    /gradBrand:\s*`linear-gradient\([^`]*\$\{brandButtonBg\}/.test(brandingSrc) ||
    /gradBrand:.*brandButtonBg/.test(brandingSrc)

  const criticalInvisible = invisible.filter((i) => i.severity === 'critical')
  const failedPairs = contrastResults.filter((c) => !c.pass)
  const needsReview = hits.filter((h) => h.category === 'NEEDS_REVIEW')

  const critical = []
  if (!hasButtonTokens) critical.push('Missing brandButtonBg / --brand-button-bg in tenantBranding.js')
  if (!ctaUsesDark) critical.push('CTA gradients do not appear to use brandButtonBg (still primary→light risk)')
  for (const f of failedPairs) critical.push(`Contrast fail: ${f.label} (${f.ratio}:1)`)
  for (const i of criticalInvisible.slice(0, 25)) {
    critical.push(`Invisible text risk: ${i.file}:${i.line} — ${i.snippet}`)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    filesAudited: files.length,
    colorHits: hits.length,
    categoryCounts,
    contrastSafeCtaPairs: contrastResults,
    identityPrimaryWhiteNote: identityNote,
    invisibleText: invisible,
    needsReviewSample: needsReview.slice(0, 40),
    needsReviewCount: needsReview.length,
    critical,
    pass: critical.length === 0,
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true })
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2))

  const md = [
    '# Theme contrast audit',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `**Result:** ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    `Files audited: **${report.filesAudited}**`,
    `Color literals found: **${report.colorHits}**`,
    '',
    '## Category counts',
    '',
    ...Object.entries(categoryCounts).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Contrast-safe CTA pairs (must pass AA 4.5:1)',
    '',
    ...contrastResults.map((c) => `- ${c.pass ? 'PASS' : 'FAIL'} ${c.label}: **${c.ratio}:1**`),
    '',
    '## Identity primary + white (informational)',
    '',
    'These identity colors may fail AA for normal text; CTAs must use button-dark tokens instead.',
    '',
    ...identityNote.map((c) => `- ${c.label}: **${c.ratio}:1** (AA normal: ${c.passAaNormal ? 'pass' : 'fail'})`),
    '',
    `## Invisible-text findings: ${invisible.length} (critical: ${criticalInvisible.length})`,
    '',
    ...criticalInvisible.slice(0, 20).map((i) => `- CRITICAL ${i.file}:${i.line} — ${i.snippet}`),
    '',
    `## NEEDS_REVIEW tenant-like literals: ${needsReview.length}`,
    '',
    ...needsReview.slice(0, 20).map((h) => `- ${h.file}:${h.line} \`${h.value}\` — ${h.snippet}`),
    '',
    '## Critical blockers',
    '',
    ...(critical.length ? critical.map((c) => `- ${c}`) : ['- none']),
    '',
  ].join('\n')

  fs.writeFileSync(REPORT_MD, md)
  console.log(md)
  console.log(`\nWrote ${rel(REPORT_MD)} and ${rel(REPORT_JSON)}`)

  if (!report.pass) {
    process.exitCode = 1
  }
}

main()
