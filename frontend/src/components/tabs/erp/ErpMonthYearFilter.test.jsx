import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErpMonthYearFilter from './ErpMonthYearFilter'

describe('ErpMonthYearFilter', () => {
  it('keeps month dropdown disabled until year is selected', () => {
    render(
      <ErpMonthYearFilter
        year=""
        months={[]}
        onYearChange={vi.fn()}
        onMonthsChange={vi.fn()}
        inputStyle={{}}
      />,
    )

    const trigger = screen.getByRole('button', { name: /all months/i })
    expect(trigger.disabled).toBe(true)
  })

  it('supports multi-select and select all inside dropdown', () => {
    const onMonthsChange = vi.fn()
    render(
      <ErpMonthYearFilter
        year="2026"
        months={[7]}
        onYearChange={vi.fn()}
        onMonthsChange={onMonthsChange}
        inputStyle={{}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /jul/i }))
    fireEvent.click(screen.getByLabelText('Aug'))
    expect(onMonthsChange).toHaveBeenCalledWith([7, 8])

    fireEvent.click(screen.getByRole('button', { name: /select all/i }))
    expect(onMonthsChange).toHaveBeenCalledWith([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })
})
