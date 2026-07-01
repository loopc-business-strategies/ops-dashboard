import React from 'react'
import { SALES_AI_THEME } from './salesAiTheme'

function parseInline(text, keyPrefix = 'i', parseOpts = {}) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let match
  let idx = 0
  const str = String(text || '')

  while ((match = re.exec(str)) !== null) {
    if (match.index > last) parts.push(str.slice(last, match.index))
    const token = match[0]
    const k = `${keyPrefix}-${idx++}`

    if (token.startsWith('**')) {
      parts.push(<strong key={k}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('_')) {
      parts.push(<em key={k} style={{ opacity: 0.88 }}>{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`')) {
      parts.push(
        <code key={k} style={parseOpts.inlineCodeStyle}>{token.slice(1, -1)}</code>,
      )
    } else if (token.startsWith('[')) {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (m) {
        parts.push(
          <a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" style={parseOpts.linkStyle}>
            {m[1]}
          </a>,
        )
      } else {
        parts.push(token)
      }
    } else {
      parts.push(token)
    }
    last = match.index + token.length
  }

  if (last < str.length) parts.push(str.slice(last))
  return parts.length ? parts : [str]
}

function isTableRow(line) {
  const t = String(line || '').trim()
  return t.includes('|') && t.replace(/[|\-\s:]/g, '').length > 0
}

function isTableSep(line) {
  return /^\|?[\s\-:|]+\|?$/.test(String(line || '').trim())
}

function parseTableRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

function renderTable(rows, key, tableStyles) {
  if (!rows.length) return null
  const [header, ...body] = rows
  return (
    <div key={key} style={{ overflowX: 'auto', margin: '8px 0' }}>
      <table style={tableStyles.tableStyle}>
        <thead>
          <tr>
            {header.map((cell, ci) => (
              <th key={ci} style={tableStyles.thStyle}>{parseInline(cell, `${key}-h-${ci}`, tableStyles)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={tableStyles.tdStyle}>{parseInline(cell, `${key}-${ri}-${ci}`, tableStyles)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function buildVariantStyles(theme, variant) {
  const isUser = variant === 'user'
  return {
    headingColor: isUser ? theme.userText : theme.textPrimary,
    mutedColor: isUser ? 'rgba(255,255,255,0.82)' : theme.textSecondary,
    hrColor: isUser ? 'rgba(255,255,255,0.22)' : theme.cardBorder,
    linkStyle: {
      color: isUser ? theme.userText : theme.link,
      textDecoration: 'underline',
      textUnderlineOffset: 2,
    },
    inlineCodeStyle: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.92em',
      padding: '1px 5px',
      borderRadius: 4,
      background: isUser ? 'rgba(255,255,255,0.16)' : theme.codeBg,
      color: isUser ? theme.userText : theme.codeText,
    },
    tableStyle: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 11,
      color: isUser ? theme.userText : theme.textPrimary,
    },
    thStyle: {
      textAlign: 'left',
      padding: '5px 6px',
      borderBottom: `1px solid ${isUser ? 'rgba(255,255,255,0.22)' : theme.cardBorder}`,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      color: isUser ? theme.userText : theme.textPrimary,
    },
    tdStyle: {
      padding: '5px 6px',
      borderBottom: `1px solid ${isUser ? 'rgba(255,255,255,0.12)' : theme.cardBorder}`,
      verticalAlign: 'top',
      color: isUser ? theme.userText : theme.textSecondary,
    },
    listStyle: {
      margin: '4px 0 8px',
      paddingLeft: 18,
      color: isUser ? theme.userText : theme.textPrimary,
    },
    codeBlockStyle: {
      margin: '8px 0',
      padding: '8px 10px',
      borderRadius: 8,
      fontSize: 11,
      lineHeight: 1.4,
      overflowX: 'auto',
      whiteSpace: 'pre-wrap',
      background: isUser ? 'rgba(255,255,255,0.16)' : theme.codeBg,
      color: isUser ? theme.userText : theme.codeText,
    },
  }
}

export default function SalesMessageContent({ content, variant = 'assistant', theme = SALES_AI_THEME }) {
  const text = String(content || '')
  const lines = text.split('\n')
  const blocks = []
  let i = 0
  let blockKey = 0

  const v = buildVariantStyles(theme, variant)
  const { headingColor, mutedColor, hrColor, listStyle, codeBlockStyle } = v
  const parseOpts = { linkStyle: v.linkStyle, inlineCodeStyle: v.inlineCodeStyle }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      i += 1
      continue
    }

    if (/^```/.test(trimmed)) {
      const codeLines = []
      i += 1
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i])
        i += 1
      }
      i += 1
      blocks.push(
        <pre key={`b-${blockKey++}`} style={codeBlockStyle}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      continue
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const tableRows = [parseTableRow(trimmed)]
      i += 2
      while (i < lines.length && isTableRow(lines[i])) {
        tableRows.push(parseTableRow(lines[i]))
        i += 1
      }
      blocks.push(renderTable(tableRows, `b-${blockKey++}`, v))
      continue
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)[0].length
      const title = trimmed.replace(/^#+\s*/, '')
      const sizes = { 1: 15, 2: 14, 3: 13 }
      blocks.push(
        <div
          key={`b-${blockKey++}`}
          style={{
            fontWeight: 700,
            fontSize: sizes[level] || 13,
            color: headingColor,
            margin: blockKey === 1 ? '0 0 6px' : '10px 0 4px',
            lineHeight: 1.3,
          }}
        >
          {parseInline(title, `h-${blockKey}`, parseOpts)}
        </div>,
      )
      i += 1
      continue
    }

    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr key={`b-${blockKey++}`} style={{ border: 'none', borderTop: `1px solid ${hrColor}`, margin: '10px 0' }} />)
      i += 1
      continue
    }

    if (/^[-*]\s/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s*/, ''))
        i += 1
      }
      blocks.push(
        <ul key={`b-${blockKey++}`} style={listStyle}>
          {items.map((item, li) => (
            <li key={li} style={{ marginBottom: 4 }}>{parseInline(item, `ul-${blockKey}-${li}`, parseOpts)}</li>
          ))}
        </ul>,
      )
      continue
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s*/, ''))
        i += 1
      }
      blocks.push(
        <ol key={`b-${blockKey++}`} style={listStyle}>
          {items.map((item, li) => (
            <li key={li} style={{ marginBottom: 4 }}>{parseInline(item, `ol-${blockKey}-${li}`, parseOpts)}</li>
          ))}
        </ol>,
      )
      continue
    }

    const paraLines = [line]
    i += 1
    while (i < lines.length) {
      const next = lines[i].trim()
      if (!next || /^#{1,3}\s/.test(next) || /^[-*]\s/.test(next) || /^\d+\.\s/.test(next) || isTableRow(next) || /^```/.test(next) || /^---+$/.test(next)) break
      paraLines.push(lines[i])
      i += 1
    }

    const para = paraLines.join('\n').trim()
    const isMuted = para.startsWith('_') && para.endsWith('_')
    blocks.push(
      <p
        key={`b-${blockKey++}`}
        style={{
          margin: '0 0 8px',
          color: isMuted ? mutedColor : 'inherit',
          fontSize: isMuted ? 11 : 'inherit',
        }}
      >
        {isMuted ? parseInline(para.slice(1, -1), `p-${blockKey}`, parseOpts) : parseInline(para, `p-${blockKey}`, parseOpts)}
      </p>,
    )
  }

  return (
    <div style={{ wordBreak: 'break-word', color: variant === 'user' ? theme.userText : theme.textPrimary }}>
      {blocks}
    </div>
  )
}
