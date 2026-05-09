require('dotenv').config()
const mongoose = require('mongoose')

async function main() {
  const apply = process.argv.includes('--apply')
  const uri = process.env.MONGO_URI_MG

  if (!uri) {
    throw new Error('Missing MONGO_URI_MG in environment')
  }

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const now = new Date()

    const filter = {
      isDeleted: { $ne: true },
      referenceType: 'journal',
      description: { $regex: /^JV-/i },
    }

    const [candidateCount, sampleDocs] = await Promise.all([
      db.collection('ledgers').countDocuments(filter),
      db.collection('ledgers')
        .find(filter)
        .project({ _id: 1, date: 1, description: 1, amount: 1, referenceType: 1 })
        .sort({ date: -1 })
        .limit(10)
        .toArray(),
    ])

    const preview = {
      generatedAt: now.toISOString(),
      tenant: 'mg',
      dryRun: !apply,
      criteria: {
        isDeleted: { $ne: true },
        referenceType: 'journal',
        descriptionStartsWith: 'JV-',
      },
      candidates: candidateCount,
      sample: sampleDocs,
    }

    if (!apply) {
      console.log(JSON.stringify({
        ...preview,
        message: 'Dry run complete. Re-run with --apply to soft-delete matching MG JV entries.',
      }, null, 2))
      return
    }

    const result = await db.collection('ledgers').updateMany(
      filter,
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          updatedAt: now,
        },
      },
    )

    const remaining = await db.collection('ledgers').countDocuments(filter)

    console.log(JSON.stringify({
      ...preview,
      dryRun: false,
      executed: {
        matched: result.matchedCount || 0,
        modified: result.modifiedCount || 0,
      },
      remaining,
    }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
