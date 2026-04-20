const mongoose = require('mongoose')
const User = require('./models/User')
require('dotenv').config()

async function listUsers() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    console.error('Missing env var: MONGO_URI')
    process.exit(1)
  }

  try {
    await mongoose.connect(mongoUri)
    console.log('Connected to MongoDB')

    const users = await User.find({}, 'name email role isActive department')
    console.log(`Users (${users.length}):`)
    console.log(JSON.stringify(users, null, 2))

    await mongoose.connection.close()
  } catch (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }
}

listUsers()
