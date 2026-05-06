require('dotenv').config()
const mongoose = require('mongoose')
const dns = require('dns')

const dnsServers = (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

if (dnsServers.length) {
  dns.setServers(dnsServers)
}

async function searchCGForOOOMark() {
  const mongoUri = process.env.MONGO_URI_CG
  console.log(`Searching CG database for "ooo" and "mark"...`)
  
  const connection = await mongoose.connect(mongoUri)
  const db = connection.connection.getClient().db()
  
  const collections = await db.listCollections().toArray()
  
  console.log(`\n=== Searching ${collections.length} collections ===\n`)
  
  let totalFound = 0
  
  for (const col of collections) {
    const collection = db.collection(col.name)
    
    // Search for "ooo" or "mark" in name or similar fields
    const query = {
      $or: [
        { name: { $regex: /ooo/i } },
        { name: { $regex: /mark/i } },
        { customerName: { $regex: /ooo|mark/i } },
        { supplierName: { $regex: /ooo|mark/i } },
      ]
    }
    
    try {
      const count = await collection.countDocuments(query)
      if (count > 0) {
        const docs = await collection.find(query).toArray()
        console.log(`📍 Found ${count} in "${col.name}":`)
        docs.forEach(doc => {
          console.log(`   ID: ${doc._id}`)
          console.log(`   Name: ${doc.name || doc.customerName || doc.supplierName || '(no name field)'}`)
          console.log(`   Fields: ${Object.keys(doc).join(', ')}`)
        })
        console.log()
        totalFound += count
      }
    } catch (error) {
      // Skip collections that don't support the query
    }
  }
  
  if (totalFound === 0) {
    console.log('✓ No "ooo" or "mark" documents found in any CG collection')
  } else {
    console.log(`\n⚠ Total found across CG: ${totalFound}`)
  }
  
  await mongoose.disconnect()
}

searchCGForOOOMark().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
