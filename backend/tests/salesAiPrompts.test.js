const {
  classifyEmailIntent,
  classifyQuestion,
  isEmailOnlyQuestion,
} = require('../services/salesAi/salesAiPrompts')

describe('salesAiPrompts email intent', () => {
  test('classifyEmailIntent matches plural emails and analyze all', () => {
    expect(classifyEmailIntent('analyze my all emails')).toBe(true)
    expect(classifyEmailIntent('summarize my inbox')).toBe(true)
    expect(classifyEmailIntent('check my email')).toBe(true)
    expect(classifyEmailIntent('everything in my inbox')).toBe(true)
    expect(classifyEmailIntent('scan all my emails')).toBe(true)
  })

  test('classifyEmailIntent rejects unrelated questions', () => {
    expect(classifyEmailIntent('UAE gold market outlook')).toBe(false)
    expect(classifyEmailIntent('Analyze our pipeline')).toBe(false)
  })

  test('classifyQuestion returns email for inbox-only questions', () => {
    expect(classifyQuestion('analyze my all emails')).toBe('email')
    expect(isEmailOnlyQuestion('analyze my all emails')).toBe(true)
  })

  test('classifyQuestion returns market when email and market topics combined', () => {
    expect(classifyQuestion('check email and gold market trends')).toBe('market')
    expect(isEmailOnlyQuestion('check email and gold market trends')).toBe(false)
  })
})
