const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('./models/User')
require('dotenv').config()

async function reset() {
  const mongoUri = process.env.MONGO_URI_CG
  const adminName = process.env.ADMIN_USERNAME
  const targetPassword = process.env.TARGET_PASSWORD

  if (!mongoUri || !adminName || !targetPassword) {
    console.error('Missing env vars. Required: MONGO_URI_CG, ADMIN_USERNAME, TARGET_PASSWORD')
    process.exit(1)
  }

  await mongoose.connect(mongoUri)
  const hashedPassword = await bcrypt.hash(targetPassword, 12)
  const result = await User.updateOne({ name: adminName }, { password: hashedPassword })

  if (result.matchedCount === 0) {
    console.error(`No user found with name: ${adminName}`)
    process.exit(1)
  }

  console.log(`Password reset for user: ${adminName}`)
  process.exit(0)
}

reset().catch((err) => {
  console.error('Password reset failed:', err.message)
  process.exit(1)
})
