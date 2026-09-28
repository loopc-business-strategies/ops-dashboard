import React from 'react'
import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import HeaderBar from './HeaderBar'

const chip = (text) => screen.getByText(text).closest('.pd-conn')

describe('HeaderBar connection chips', () => {
  test('uses the dashboard model instead of always showing not connected', () => {
    render(<HeaderBar header={{}} hasLiveProduction vaultConnected onRefresh={() => {}} />)
    expect(chip('Vault connected').className).toContain('pd-conn--ok')
    expect(chip('Production connected').className).toContain('pd-conn--ok')
  })

  test('shows not connected when there is no vault or production data', () => {
    render(<HeaderBar header={{}} onRefresh={() => {}} />)
    expect(chip('Vault not connected').className).toContain('pd-conn--bad')
    expect(chip('Production not connected').className).toContain('pd-conn--bad')
  })

  test('MG: the production chip names the MG Floor workbook, or stays neutral with no batches', () => {
    const { rerender } = render(
      <HeaderBar header={{}} productionStatus={{ label: 'MG Floor workbook', tone: 'ok' }} onRefresh={() => {}} />,
    )
    expect(chip('MG Floor workbook').className).toContain('pd-conn--ok')
    expect(screen.queryByText('Production not connected')).toBeNull()

    rerender(
      <HeaderBar header={{}} productionStatus={{ label: 'MG Floor: no batches today', tone: 'muted' }} onRefresh={() => {}} />,
    )
    const neutral = chip('MG Floor: no batches today').className
    expect(neutral).not.toContain('pd-conn--bad')
    expect(neutral).not.toContain('pd-conn--ok')
  })
})
