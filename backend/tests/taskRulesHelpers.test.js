const { applyAutomationDerivedFields, DEFAULT_AUTO_ARCHIVE_MS } = require('../utils/taskRulesHelpers')

describe('applyAutomationDerivedFields', () => {
  const baseTask = { status: 'todo', dueDate: new Date('2026-06-01') }

  test('schedules autoArchiveAt when transitioning to done', () => {
    const now = 1_700_000_000_000
    const out = applyAutomationDerivedFields({ status: 'done' }, baseTask, {
      now,
      env: { TASK_RULE_AUTO_ARCHIVE_MS: String(86_400_000) },
    })
    expect(out.status).toBe('done')
    expect(out.autoArchiveAt).toEqual(new Date(now + 86_400_000))
  })

  test('uses default 7d delay when env unset', () => {
    const now = 1_000_000
    const out = applyAutomationDerivedFields({ status: 'cancelled' }, { ...baseTask, status: 'in-progress' }, { now, env: {} })
    expect(out.autoArchiveAt).toEqual(new Date(now + DEFAULT_AUTO_ARCHIVE_MS))
  })

  test('clears autoArchiveAt when reopening from done', () => {
    const out = applyAutomationDerivedFields({ status: 'todo' }, { ...baseTask, status: 'done' }, { now: 1, env: {} })
    expect(out.autoArchiveAt).toBeNull()
  })

  test('clears due proximity marker when dueDate changes', () => {
    const out = applyAutomationDerivedFields(
      { dueDate: new Date('2026-07-01') },
      { ...baseTask, dueDate: new Date('2026-06-01'), dueProximityNotifiedForDue: new Date('2026-06-01') },
      { now: 1, env: {} }
    )
    expect(out.dueProximityNotifiedForDue).toBeNull()
  })

  test('does not set autoArchiveAt when status unchanged in patch', () => {
    const out = applyAutomationDerivedFields({ title: 'x' }, { ...baseTask, status: 'done' }, { now: 1, env: {} })
    expect(out.autoArchiveAt).toBeUndefined()
  })
})
