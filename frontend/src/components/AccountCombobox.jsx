import React, { useState, useEffect, useRef } from 'react'

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
 */
export default function AccountCombobox({ groups = [], value = '', onChange, placeholder = 'Type or select account…', style = {}, disabled = false }) {
  const allOptions = groups.flatMap((g) => g.options)
  const labelFor = (val) => allOptions.find((o) => o.value === val)?.label || ''

  const [inputVal, setInputVal] = useState(labelFor(value))
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  // Keep input text in sync if value changes externally
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
    // Delay so mousedown on option fires first
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.matches(':focus-within')) {
        setOpen(false)
        // If typed text doesn't match a known option, try exact match; else restore
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

  // Close on outside click
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
    right: 0,
    background: '#fff',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
    maxHeight: '300px',
    overflowY: 'auto',
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

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        value={inputVal}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        style={style}
        disabled={disabled}
        autoComplete="off"
      />
      {open && filteredGroups.length > 0 && (
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
      )}
      {open && query.trim() && filteredGroups.length === 0 && (
        <div style={{ ...dropdownStyle, padding: '10px 14px', fontSize: '0.8rem', color: '#9CA3AF' }}>
          No accounts found
        </div>
      )}
    </div>
  )
}

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
