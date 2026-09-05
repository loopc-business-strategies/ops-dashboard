import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo } from 'react'
import { VirtualScrollList } from './VirtualScrollList'

/**
 * AccountCombobox – type-to-filter + grouped dropdown picker.
 *
 * Props:
 *   groups    : [{ label: string, options: [{ value: string, label: string }] }]
 *   value     : string  – currently selected option value
 *   onChange  : (value: string, label: string) => void
 *   placeholder: string
 *   style     : object  – applied to the <input>
 *   disabled  : bool
 *   onKeyDown : (event) => void
 */
const VIRTUALIZE_THRESHOLD = 80

const AccountCombobox = forwardRef(function AccountCombobox({
  groups = [],
  value = '',
  onChange,
  placeholder = 'Type or select account…',
  style = {},
  disabled = false,
  onKeyDown = null,
}, ref) {
  const allOptions = groups.flatMap((g) => g.options)
  const labelFor = (val) => allOptions.find((o) => o.value === val)?.label || ''

  const [inputVal, setInputVal] = useState(labelFor(value))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)
  const inputRef = useRef(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    select: () => inputRef.current?.select?.(),
    blur: () => inputRef.current?.blur?.(),
    get input() { return inputRef.current },
    contains: (node) => containerRef.current?.contains(node) || false,
  }), [])

  useEffect(() => {
    setInputVal(labelFor(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const filteredGroups = query.trim()
    ? groups
        .map((g) => ({
          ...g,
          options: g.options.filter((o) =>
            o.label.toLowerCase().includes(query.toLowerCase())
          ),
        }))
        .filter((g) => g.options.length > 0)
    : groups

  const flatRows = useMemo(() => {
    const rows = []
    filteredGroups.forEach((group) => {
      rows.push({ type: 'group', label: group.label })
      group.options.forEach((opt) => {
        rows.push({ type: 'opt', opt })
      })
    })
    return rows
  }, [filteredGroups])

  const useVirtual = flatRows.length > VIRTUALIZE_THRESHOLD

  const handleInput = (e) => {
    const q = e.target.value
    setInputVal(q)
    setQuery(q)
    setOpen(true)
    if (!q.trim()) {
      onChange('', '')
    }
  }

  const handleSelect = (opt) => {
    setInputVal(opt.label)
    setQuery('')
    setOpen(false)
    onChange(opt.value, opt.label)
  }

  const handleFocus = () => {
    setQuery('')
    setOpen(true)
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.matches(':focus-within')) {
        setOpen(false)
        const matched = allOptions.find((o) =>
          o.label.toLowerCase() === inputVal.toLowerCase()
        )
        if (matched) {
          setInputVal(matched.label)
          onChange(matched.value, matched.label)
        } else if (!value) {
          setInputVal('')
        } else {
          setInputVal(labelFor(value))
        }
      }
    }, 150)
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'Tab') {
      setOpen(false)
    }
    if (typeof onKeyDown === 'function') {
      onKeyDown(e)
    }
  }

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const dropdownStyle = {
    position: 'absolute',
    zIndex: 99999,
    top: '100%',
    left: 0,
    minWidth: '100%',
    width: 'max-content',
    maxWidth: '480px',
    background: '#fff',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
    maxHeight: '300px',
    overflowY: useVirtual ? 'hidden' : 'auto',
    marginTop: '3px',
  }

  const groupLabelStyle = {
    padding: '4px 10px',
    fontSize: '0.62rem',
    fontWeight: '700',
    color: '#9CA3AF',
    background: '#F9FAFB',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    borderBottom: '1px solid #E5E7EB',
    position: 'sticky',
    top: 0,
  }

  const optionStyle = (hovered) => ({
    padding: '7px 14px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    background: hovered ? '#EFF6FF' : '#fff',
    borderBottom: '1px solid #F3F4F6',
    color: '#1F2937',
  })

  const renderFlatRow = (index) => {
    const row = flatRows[index]
    if (!row) return null
    if (row.type === 'group') {
      return <div style={groupLabelStyle}>{row.label}</div>
    }
    return <HoverOption opt={row.opt} onSelect={handleSelect} optionStyle={optionStyle} />
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        type="text"
        data-vk-focus-target="true"
        value={inputVal}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        style={style}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filteredGroups.length > 0 && (
        useVirtual ? (
          <div style={dropdownStyle}>
            <VirtualScrollList
              count={flatRows.length}
              estimateSize={(i) => (flatRows[i]?.type === 'group' ? 26 : 34)}
              maxHeight={300}
              renderRow={renderFlatRow}
            />
          </div>
        ) : (
          <div style={dropdownStyle}>
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <div style={groupLabelStyle}>{group.label}</div>
                {group.options.map((opt) => (
                  <HoverOption key={opt.value} opt={opt} onSelect={handleSelect} optionStyle={optionStyle} />
                ))}
              </div>
            ))}
          </div>
        )
      )}
      {open && query.trim() && filteredGroups.length === 0 && (
        <div style={{ ...dropdownStyle, padding: '10px 14px', fontSize: '0.8rem', color: '#9CA3AF' }}>
          No accounts found
        </div>
      )}
    </div>
  )
})

export default AccountCombobox

function HoverOption({ opt, onSelect, optionStyle }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseDown={() => onSelect(opt)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={optionStyle(hovered)}
    >
      {opt.label}
    </div>
  )
}
