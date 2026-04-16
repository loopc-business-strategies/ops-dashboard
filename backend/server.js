// ==========================================
// FILE: backend/server.js
// WHAT THIS DOES:
//   This is the starting point of the backend.
//   It creates the Express server, connects to MongoDB,
//   and registers all route files.
// ==========================================

require('dotenv').config() // load .env variables FIRST

const express  = require('express')
const mongoose = require('mongoose')
const cors     = require('cors')

const authRoutes     = require('./routes/auth')
const employeeRoutes = require('./routes/employees')
const taskRoutes     = require('./routes/tasks')

const app = express()

// ── Middleware (runs on every request) ──────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Routes ──────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running!', time: new Date() })
})

app.use('/api/auth',         authRoutes)
app.use('/api/hr/employees', employeeRoutes)
app.use('/api/tasks',        taskRoutes)

// 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Something went wrong.' })
})

// ── Connect to MongoDB then start server ────────
const PORT      = process.env.PORT      || 5000
const MONGO_URI = process.env.MONGO_URI

if (!MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env file!')
  process.exit(1)
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB')
    app.listen(PORT, () => {
      console.log(`✅ Server running at http://localhost:${PORT}`)
      console.log(`   Health check: http://localhost:${PORT}/api/health`)
    })
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message)
    process.exit(1)
  })
