import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import LoopCMessageContent from '../components/LoopCMessageContent'

describe('LoopCMessageContent', () => {
  it('renders headings and tables without raw markdown markers', () => {
    const content = [
      '# Title',
      '## Section',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '- bullet **bold**',
    ].join('\n')

    render(<LoopCMessageContent content={content} />)
    expect(screen.getByText('Title')).toBeTruthy()
    expect(screen.getByText('Section')).toBeTruthy()
    expect(screen.getByText('bold')).toBeTruthy()
    expect(screen.queryByText('# Title')).toBeNull()
    expect(screen.queryByText('| A | B |')).toBeNull()
  })
})
