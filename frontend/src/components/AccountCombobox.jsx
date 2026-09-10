import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react'
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

function makeTabNavEvent(target) {
  return {
    key: 'Tab',
    shiftKey: false,
    target,
    preventDefault: () => {},
    stopPropagation: () => {},
  }
}

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
  const [highlightIndex, setHighlightIndex] = useState(0)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listScrollRef = useRef(null)
  const skipBlurCommitRef = useRef(false)

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

  const optionEntries = useMemo(
    () => flatRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => row.type === 'opt'),
    [flatRows],
  )

  const useVirtual = flatRows.length > VIRTUALIZE_THRESHOLD
  const optionCount = optionEntries.length
  const highlighted = optionEntries[Math.min(highlightIndex, Math.max(optionCount - 1, 0))]
  const highlightedOpt = highlighted?.row?.opt || null
  const highlightedFlatIndex = highlighted?.index ?? -1

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, open])

  useEffect(() => {
    if (useVirtual || highlightedFlatIndex < 0) return
    const node = listScrollRef.current?.querySelector(`[data-combobox-flat-index="${highlightedFlatIndex}"]`)
    node?.scrollIntoView?.({ block: 'nearest' })
  }, [highlightedFlatIndex, useVirtual, open])

  const handleSelect = useCallback((opt) => {
    if (!opt) return
    skipBlurCommitRef.current = true
    setInputVal(opt.label)
    setQuery('')
    setOpen(false)
    onChange(opt.value, opt.label)
  }, [onChange])

  const handleInput = (e) => {
    const q = e.target.value
    setInputVal(q)
    setQuery(q)
    setOpen(true)
    if (!q.trim()) {
      onChange('', '')
    }
  }

  const handleFocus = () => {
    setQuery('')
    setOpen(true)
  }

  const handleBlur = () => {
    setTimeout(() => {
      if (skipBlurCommitRef.current) {
        skipBlurCommitRef.current = false
        setOpen(false)
        return
      }
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

  const commitHighlighted = () => {
    if (!open || !highlightedOpt) return false
    handleSelect(highlightedOpt)
    return true
  }

  const handleInputKeyDown = (e) => {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!optionCount) return
      setHighlightIndex((prev) => (prev + 1) % optionCount)
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!optionCount) return
      setHighlightIndex((prev) => (prev - 1 + optionCount) % optionCount)
      return
    }

    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        setOpen(false)
      }
      return
    }

    if (e.key === 'Enter') {
      if (open && highlightedOpt) {
        e.preventDefault()
        e.stopPropagation?.()
        const target = e.target
        handleSelect(highlightedOpt)
        window.setTimeout(() => {
          if (typeof onKeyDown === 'function') onKeyDown(makeTabNavEvent(target))
        }, 0)
        return
      }
      if (typeof onKeyDown === 'function') onKeyDown(e)
      return
    }

    if (e.key === 'Tab') {
      skipBlurCommitRef.current = true
      commitHighlighted()
      if (typeof onKeyDown === 'function') onKeyDown(e)
      return
    }

    if (typeof onKeyDown === 'function') onKeyDown(e)
  }

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

  const optionStyle = (active) => ({
    padding: '7px 14px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    background: active ? 'var(--brand-soft)' : '#fff',
    borderBottom: '1px solid #F3F4F6',
    color: '#1F2937',
  })

  const renderFlatRow = (index) => {
    const row = flatRows[index]
    if (!row) return null
    if (row.type === 'group') {
      return <div style={groupLabelStyle}>{row.label}</div>
    }
    return (
      <HoverOption
        opt={row.opt}
        highlighted={index === highlightedFlatIndex}
        onSelect={handleSelect}
        optionStyle={optionStyle}
        flatIndex={index}
      />
    )
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
        role="combobox"
        aria-expanded={open}
        aria-activedescendant={highlightedOpt ? `account-opt-${highlightedOpt.value}` : undefined}
      />
      {open && filteredGroups.length > 0 && (
        useVirtual ? (
          <div style={dropdownStyle}>
            <VirtualScrollList
              count={flatRows.length}
              estimateSize={(i) => (flatRows[i]?.type === 'group' ? 26 : 34)}
              maxHeight={300}
              scrollToIndex={highlightedFlatIndex}
              renderRow={renderFlatRow}
            />
          </div>
        ) : (
          <div ref={listScrollRef} style={dropdownStyle} role="listbox">
            {filteredGroups.map((group) => (
              <div key={group.label}>
                <div style={groupLabelStyle}>{group.label}</div>
                {group.options.map((opt) => {
                  const flatIndex = flatRows.findIndex((row) => row.type === 'opt' && row.opt.value === opt.value)
                  return (
                    <HoverOption
                      key={opt.value}
                      opt={opt}
                      highlighted={flatIndex === highlightedFlatIndex}
                      onSelect={handleSelect}
                      optionStyle={optionStyle}
                      flatIndex={flatIndex}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )
      )}
      {open && allOptions.length === 0 && (
        <div style={{ ...dropdownStyle, padding: '10px 14px', fontSize: '0.8rem', color: '#9CA3AF' }}>
          No accounts loaded
        </div>
      )}
      {open && allOptions.length > 0 && query.trim() && filteredGroups.length === 0 && (
        <div style={{ ...dropdownStyle, padding: '10px 14px', fontSize: '0.8rem', color: '#9CA3AF' }}>
          No accounts found
        </div>
      )}
    </div>
  )
})

export default AccountCombobox

function HoverOption({ opt, onSelect, optionStyle, highlighted = false, flatIndex = -1 }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      id={`account-opt-${opt.value}`}
      role="option"
      aria-selected={highlighted}
      data-combobox-flat-index={flatIndex}
      onMouseDown={() => onSelect(opt)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={optionStyle(highlighted || hovered)}
    >
      {opt.label}
    </div>
  )
}
