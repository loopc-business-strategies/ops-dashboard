import { describe, expect, it } from 'vitest'
import {
  addAuthorizedPerson,
  parseAuthorizedPersons,
  removeAuthorizedPersonAt,
  serializeAuthorizedPersons,
} from './authorizedPersons'

describe('authorizedPersons', () => {
  it('parses comma-separated legacy strings', () => {
    expect(parseAuthorizedPersons('mark, jane; bob')).toEqual(['mark', 'jane', 'bob'])
  })

  it('serializes a list for storage', () => {
    expect(serializeAuthorizedPersons(['mark', 'jane'])).toBe('mark, jane')
  })

  it('adds one name at a time without duplicates', () => {
    expect(addAuthorizedPerson(['mark'], 'Jane')).toEqual(['mark', 'Jane'])
    expect(addAuthorizedPerson(['mark'], 'MARK')).toEqual(['mark'])
    expect(addAuthorizedPerson(['mark'], '  ')).toEqual(['mark'])
  })

  it('removes by index', () => {
    expect(removeAuthorizedPersonAt(['mark', 'jane'], 0)).toEqual(['jane'])
  })
})
