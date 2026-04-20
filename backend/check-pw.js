const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const User = require('./models/User')
require('dotenv').config()

async function check() {
  const mongoUri = process.env.MONGO_URI
  const probePassword = process.env.PROBE_PASSWORD

  if (!mongoUri || !probePassword) {
    console.error('Missing env vars. Required: MONGO_URI, PROBE_PASSWORD')
    process.exit(1)
  }

  await mongoose.connect(mongoUri)
  const users = await User.find({}).select('+password')

  for (const user of users) {
    const isMatch = await bcrypt.compare(probePassword, user.password)
    console.log(`User: ${user.name}, Match: ${isMatch}`)
  }

  process.exit(0)
}

check().catch((err) => {
  console.error('Password check failed:', err.message)
  process.exit(1)
})
