require('dotenv').config()
const mongoose = require('mongoose')

async function comprehensiveSearchAllTenants() {
  const tenants = ['mg', 'cg', 'loopc']
  
  console.log(`=== Comprehensive OOO/MARK Search Across All Tenants ===\n`)
  
  for (const tenant of tenants) {
    const envVar = `MONGO_URI_${tenant.toUpperCase()}`
    const mongoUri = process.env[envVar]
    
    if (!mongoUri) {
      console.log(`⚠ ${tenant.toUpperCase()}: Connection not configured`)
      continue
    }
    
    console.log(`\n[${tenant.toUpperCase()}] Searching...`)
    
    const connection = await mongoose.connect(mongoUri)
    const db = connection.connection.getClient().db()
    
    const collections = await db.listCollections().toArray()
    let found = 0
    
    for (const col of collections) {
      const collection = db.collection(col.name)
      
      const query = {
        $or: [
          { name: { $regex: /^ooo$/i } },
          { name: { $regex: /^mark$/i } },
          { customerName: { $regex: /^ooo$|^mark$/i } },
          { supplierName: { $regex: /^ooo$|^mark$/i } },
        ]
      }
      
      try {
        const count = await collection.countDocuments(query)
        if (count > 0) {
          const docs = await collection.find(query).toArray()
          console.log(`  Found ${count} in "${col.name}":`)
          docs.forEach(doc => {
            console.log(`    - ${doc.name || doc.customerName || doc.supplierName} (ID: ${doc._id})`)
          })
          found += count
        }
      } catch (error) {
        // Skip
      }
    }
    
    if (found === 0) {
      console.log(`  ✓ No OOO or MARK records found`)
    }
    
    await mongoose.disconnect()
  }
  
  console.log(`\n=== Search Complete ===\n`)
}

comprehensiveSearchAllTenants().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
