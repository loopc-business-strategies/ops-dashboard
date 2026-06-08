const { dependsOnReachesTask } = require('../utils/taskDependencyValidation')

const ID = {
  a: '64a1a1a1a1a1a1a1a1a1a1a1',
  b: '64b2b2b2b2b2b2b2b2b2b2b2',
  c: '64c3c3c3c3c3c3c3c3c3c3c3',
  d: '64d4d4d4d4d4d4d4d4d4d4d4',
}

/** a <- b <- c ; d isolated */
const graph = {
  [ID.a]: [],
  [ID.b]: [ID.a],
  [ID.c]: [ID.b],
  [ID.d]: [],
}

function mockTaskModel() {
  return {
    findById(id) {
      return {
        select() {
          return {
            lean: async () => {
              const key = String(id)
              const deps = graph[key] || []
              return { dependsOn: deps.map((d) => ({ toString: () => d })) }
            },
          }
        },
      }
    },
  }
}

describe('dependsOnReachesTask', () => {
  test('returns false when target is not reachable from start ids', async () => {
    const Task = mockTaskModel()
    const hit = await dependsOnReachesTask(Task, [ID.c], ID.d)
    expect(hit).toBe(false)
  })

  test('returns true when a dependency chain reaches target', async () => {
    const Task = mockTaskModel()
    const hit = await dependsOnReachesTask(Task, [ID.b], ID.a)
    expect(hit).toBe(true)
  })

  test('returns false for empty start ids', async () => {
    const Task = mockTaskModel()
    const hit = await dependsOnReachesTask(Task, [], ID.a)
    expect(hit).toBe(false)
  })
})
