require('dotenv').config()
const mongoose = require('mongoose')

async function checkCGCurrentState() {
  const mongoUri = process.env.MONGO_URI_CG
  console.log(`\n=== CG Database Current State ===\n`)
  
  await mongoose.connect(mongoUri)
  const db = mongoose.connection.getClient().db()
  
  // Check customers
  const customersCol = db.collection('customers')
  const customerCount = await customersCol.countDocuments()
  console.log(`Customers: ${customerCount}`)
  if (customerCount > 0) {
    const customers = await customersCol.find({}).toArray()
    customers.forEach(c => console.log(`  - ${c.name} (ID: ${c._id})`))
  }
  
  // Check vendors
  const vendorsCol = db.collection('vendors')
  const vendorCount = await vendorsCol.countDocuments()
  console.log(`\nVendors: ${vendorCount}`)
  if (vendorCount > 0) {
    const vendors = await vendorsCol.find({}).toArray()
    vendors.forEach(v => console.log(`  - ${v.name} (Code: ${v.vendorCode}, ID: ${v._id})`))
  }
  
  // Check for any test/ooo/mark records
  console.log(`\nSearching for test/ooo/mark accounts...`)
  
  const allCollections = await db.listCollections().toArray()
  let found = 0
  
  for (const col of allCollections) {
    const collection = db.collection(col.name)
    const query = {
      $or: [
        { name: { $regex: /test|ooo|mark/i } },
        { customerName: { $regex: /test|ooo|mark/i } },
        { supplierName: { $regex: /test|ooo|mark/i } },
      ]
    }
    
    try {
      const count = await collection.countDocuments(query)
      if (count > 0) {
        console.log(`\n  Found ${count} in "${col.name}":`)
        const docs = await collection.find(query).toArray()
        docs.forEach(doc => {
          const name = doc.name || doc.customerName || doc.supplierName || '(no name)'
          console.log(`    - ${name} (Type: ${col.name})`)
        })
        found += count
      }
    } catch (error) {
      // Skip
    }
  }
  
  if (found === 0) {
    console.log(`  No test/ooo/mark records found`)
  }
  
  await mongoose.disconnect()
  console.log(`\n=== End of Report ===\n`)
}

checkCGCurrentState().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
