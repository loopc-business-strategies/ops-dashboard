require('dotenv').config()
const mongoose = require('mongoose')

async function checkCGDatabase() {
  const mongoUri = process.env.MONGO_URI_CG
  console.log(`Connecting to CG database...`)
  
  const connection = await mongoose.connect(mongoUri)
  const db = connection.connection.getClient().db()
  
  // List all collections
  const collections = await db.listCollections().toArray()
  console.log(`\nCollections in CG database (${collections.length}):`)
  collections.forEach(c => console.log(`  - ${c.name}`))
  
  // Try to access customers directly
  const customersCollection = db.collection('customers')
  const count = await customersCollection.countDocuments()
  console.log(`\nDocuments in 'customers' collection: ${count}`)
  
  if (count > 0) {
    const all = await customersCollection.find({}).toArray()
    console.log(`\nAll customer documents:`)
    all.forEach(doc => console.log(`  - ${doc.name} (ID: ${doc._id})`))
  }
  
  await mongoose.disconnect()
}

checkCGDatabase().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
