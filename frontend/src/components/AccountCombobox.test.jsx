// @vitest-environment jsdom
import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import AccountCombobox from './AccountCombobox'

vi.mock('./VirtualScrollList', () => ({
  VirtualScrollList: () => null,
  default: () => null,
}))

const groups = [
  {
    label: 'Asset',
    options: [
      { value: '1000', label: '1000 - Cash on Hand' },
      { value: '100001', label: '100001 - cash-soms' },
      { value: '101001', label: '101001 - NATIONAL BANK OF UZBEKISTAN-USD' },
    ],
  },
]

describe('AccountCombobox keyboard', () => {
  test('ArrowDown/ArrowUp highlight options and Enter commits then notifies parent', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <AccountCombobox
        groups={groups}
        value=""
        onChange={onChange}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('100001', '100001 - cash-soms')
    vi.advanceTimersByTime(0)
    expect(onKeyDown).toHaveBeenCalled()
    expect(onKeyDown.mock.calls[0][0].key).toBe('Tab')
    vi.useRealTimers()
  })

  test('Enter still replaces the current account with the highlighted row', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <AccountCombobox
        groups={groups}
        value="1000"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('1000', '1000 - Cash on Hand')
    vi.advanceTimersByTime(0)
    expect(onKeyDown.mock.calls[0][0].key).toBe('Tab')
    vi.useRealTimers()
  })

  test('Tab keeps the current account when the list was only opened', () => {
    const onChange = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <AccountCombobox
        groups={groups}
        value="1000"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(onChange).not.toHaveBeenCalled()
    expect(onKeyDown).toHaveBeenCalled()
    expect(onKeyDown.mock.calls[0][0].key).toBe('Tab')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input.value).toBe('1000 - Cash on Hand')
  })

  test('Tab after ArrowDown commits the highlighted account', () => {
    const onChange = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <AccountCombobox
        groups={groups}
        value="1000"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(onChange).toHaveBeenCalledWith('100001', '100001 - cash-soms')
    expect(onKeyDown.mock.calls[0][0].key).toBe('Tab')
  })

  test('Tab commits the first matching account', () => {
    const onChange = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <AccountCombobox
        groups={groups}
        value=""
        onChange={onChange}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '1000 -' } })
    fireEvent.keyDown(input, { key: 'Tab' })
    expect(onChange).toHaveBeenCalledWith('1000', '1000 - Cash on Hand')
    expect(onKeyDown).toHaveBeenCalled()
    expect(onKeyDown.mock.calls[0][0].key).toBe('Tab')
  })

  test('blur after Enter does not restore the previous account', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <AccountCombobox
        groups={groups}
        value="1000"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('100001', '100001 - cash-soms')
    fireEvent.blur(input)
    vi.advanceTimersByTime(200)
    expect(onChange.mock.calls.some(([value]) => value === '1000')).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith('100001', '100001 - cash-soms')
    vi.useRealTimers()
  })

  test('a click selects that account and asks the parent to move on', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    const onKeyDown = vi.fn()
    render(
      <AccountCombobox
        groups={groups}
        value="1000"
        onChange={onChange}
        onKeyDown={onKeyDown}
      />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.mouseDown(screen.getByRole('option', { name: '100001 - cash-soms' }))
    expect(onChange).toHaveBeenCalledWith('100001', '100001 - cash-soms')
    vi.advanceTimersByTime(0)
    expect(onKeyDown).toHaveBeenCalled()
    expect(onKeyDown.mock.calls[0][0].key).toBe('Tab')
    vi.useRealTimers()
  })

  test('Escape closes the list without selecting', () => {
    const onChange = vi.fn()
    render(
      <AccountCombobox groups={groups} value="" onChange={onChange} />,
    )
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: '10' } })
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
