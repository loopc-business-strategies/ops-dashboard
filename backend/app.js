require('dotenv').config()

const path = require('path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')

const authRoutes = require('./routes/auth')
const employeeRoutes = require('./routes/employees')
const taskRoutes = require('./routes/tasks')
const erpRoutes = require('./routes/erp')
const erpAccountingRoutes = require('./routes/erp-accounting')
const attendanceRoutes = require('./routes/attendance')
const messageRoutes = require('./routes/messages')

function createApp() {
  const app = express()
  const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '100kb'

  app.set('trust proxy', 1)

  const apiLimiter = rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 400),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many requests. Please try again shortly.' },
  })

  const authLimiter = rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 25),
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
  })

  app.use(helmet())
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  }))
  app.use(express.json({ limit: REQUEST_BODY_LIMIT }))
  app.use(express.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }))

  app.use('/api', apiLimiter)
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/setup', authLimiter)

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running!', time: new Date() })
  })

  app.use('/api/auth', authRoutes)
  app.use('/api/hr/employees', employeeRoutes)
  app.use('/api/tasks', taskRoutes)
  app.use('/api/erp', erpRoutes)
  app.use('/api/erp-accounting', erpAccountingRoutes)
  app.use('/api/attendance', attendanceRoutes)
  app.use('/api/messages', messageRoutes)

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../frontend/dist')))
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
    })
  }

  app.use('*', (req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` })
  })

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err)
    res.status(500).json({ success: false, message: 'Something went wrong.' })
  })

  return app
}

module.exports = createApp
