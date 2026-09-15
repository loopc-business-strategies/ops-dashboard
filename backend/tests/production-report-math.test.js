const { departmentRowsFromRuns, dailySummaryFromRuns } = require('../services/productionControl/reportMath')

describe('production report math goldens', () => {
  const stages = [
    { key: 'melting', label: 'Melting', process: 'Melt' },
    { key: 'casting', label: 'Casting', process: 'Cast' },
  ]

  const t0 = new Date('2026-09-01T10:00:00Z')
  const t1 = new Date('2026-09-01T11:00:00Z')

  const runs = [
    {
      department: 'melting',
      process: 'Melt',
      status: 'COMPLETED',
      startTime: t0,
      endTime: t1,
      inputWeight: 100,
      outputWeight: 95,
      scrap: 3,
      loss: 2,
    },
    {
      department: 'melting',
      process: 'Melt',
      status: 'IN_PROGRESS',
      startTime: t0,
      endTime: null,
      inputWeight: 50,
      outputWeight: 0,
      scrap: 0,
      loss: 0,
    },
    {
      department: 'casting',
      process: 'Cast',
      status: 'COMPLETED',
      startTime: t0,
      endTime: new Date('2026-09-01T10:30:00Z'),
      inputWeight: 95,
      outputWeight: 90,
      scrap: 4,
      loss: 1,
    },
    {
      department: 'other',
      process: 'Cast',
      status: 'PENDING',
      startTime: null,
      endTime: null,
      inputWeight: 10,
      outputWeight: 0,
      scrap: 0,
      loss: 0,
    },
  ]

  it('department performance matches legacy stage filter math', () => {
    const rows = departmentRowsFromRuns(stages, runs)
    expect(rows).toEqual([
      {
        department: 'Melting',
        key: 'melting',
        jobs: 2,
        completed: 1,
        pending: 1,
        weight: 95,
        scrap: 3,
        loss: 2,
        averageProcessingMinutes: 60,
      },
      {
        department: 'Casting',
        key: 'casting',
        jobs: 2,
        completed: 1,
        pending: 1,
        weight: 90,
        scrap: 4,
        loss: 1,
        averageProcessingMinutes: 30,
      },
    ])
  })

  it('daily summary matches legacy JS totals', () => {
    const result = dailySummaryFromRuns(runs)
    expect(result.summary).toEqual({
      jobs: 4,
      completed: 2,
      pending: 2,
      weightIn: 195,
      weightOut: 185,
      scrap: 7,
      loss: 3,
    })
    expect(result.byDepartment).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ department: 'melting', jobs: 2, completed: 1, pending: 1 }),
        expect.objectContaining({ department: 'casting', jobs: 1, completed: 1 }),
        expect.objectContaining({ department: 'other', jobs: 1, pending: 1 }),
      ]),
    )
  })
})
