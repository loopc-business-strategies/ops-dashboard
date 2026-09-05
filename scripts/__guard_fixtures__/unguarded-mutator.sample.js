/**
 * INTENTIONAL unguarded mutator sample for unit tests only.
 * Excluded from production CI scan (scripts/__guard_fixtures__).
 * Do not copy this pattern into real scripts.
 */
async function fakeMutate(collection) {
  await collection.deleteMany({ _fixture: true })
}

module.exports = { fakeMutate }
