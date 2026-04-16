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

function buildMongoUri() {
  if (MONGO_URI) return MONGO_URI

  const DB_USER = process.env.DB_USER
  const DB_PASS = process.env.DB_PASS
  const DB_CLUSTER = process.env.DB_CLUSTER
  const DB_NAME = process.env.DB_NAME || 'ops-dashboard'
  const DB_PARAMS = process.env.DB_PARAMS || 'retryWrites=true&w=majority'

  if (!DB_USER || !DB_PASS || !DB_CLUSTER) {
    return null
  }

  const encodedPass = encodeURIComponent(DB_PASS)
  return `mongodb+srv://${DB_USER}:${encodedPass}@${DB_CLUSTER}/${DB_NAME}?${DB_PARAMS}`
}

function getMongoConfigInfo() {
  const usingUri = Boolean(MONGO_URI)
  const dbName = process.env.DB_NAME || 'ops-dashboard'

  if (usingUri) {
    return {
      mode: 'MONGO_URI',
      target: dbName,
    }
  }

  return {
    mode: 'DB_USER/DB_PASS/DB_CLUSTER',
    target: `${process.env.DB_CLUSTER || 'unknown-cluster'}/${dbName}`,
  }
}

const mongoUri = buildMongoUri()
const mongoInfo = getMongoConfigInfo()
const hasSplitDbVars = Boolean(process.env.DB_USER || process.env.DB_PASS || process.env.DB_CLUSTER)

if (!mongoUri) {
  console.error('Mongo config missing. Set MONGO_URI or DB_USER/DB_PASS/DB_CLUSTER in .env.')
  process.exit(1)
}

if (MONGO_URI && hasSplitDbVars) {
  console.warn('Mongo warning: MONGO_URI is set, so DB_USER/DB_PASS/DB_CLUSTER values are ignored.')
}

console.log(`Mongo config mode: ${mongoInfo.mode}`)
console.log(`Mongo target: ${mongoInfo.target}`)

mongoose.connect(mongoUri)
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
