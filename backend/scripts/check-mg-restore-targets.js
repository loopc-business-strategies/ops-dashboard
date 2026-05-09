require('dotenv').config()
const mongoose = require('mongoose')

async function main() {
  if (!process.env.MONGO_URI_MG) throw new Error('Missing MONGO_URI_MG')

  await mongoose.connect(process.env.MONGO_URI_MG, { serverSelectionTimeoutMS: 15000 })
  const db = mongoose.connection.getClient().db()

  const ids = [
    '69fd987de64bd5786abaa86e',
    '69f9a01f682467dc3f029cf8',
    '69f758bc4a1d787152d020a1',
    '69f753128d8e200d82a60766',
  ].map((id) => new mongoose.Types.ObjectId(id))

  const docs = await db.collection('transactions')
    .find({ _id: { $in: ids } })
    .project({ _id: 1, type: 1, status: 1, isDeleted: 1, deletedAt: 1, journalEntryId: 1, 'voucherMeta.vocNo': 1 })
    .toArray()

  console.log(JSON.stringify({ count: docs.length, docs }, null, 2))

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
