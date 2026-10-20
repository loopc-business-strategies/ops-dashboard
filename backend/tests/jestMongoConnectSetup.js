/**
 * Jest setup: patch mongoose.connect so mongodb driver 7.6+ builds client metadata
 * under Jest (avoids "Missing required sub-document 'driver'").
 */
const mongoose = require('mongoose')
const os = require('os')

const originalConnect = mongoose.connect.bind(mongoose)

mongoose.connect = function connectWithJestRuntimeAdapters(uri, options = {}, ...rest) {
  const nextOptions = {
    ...options,
    runtimeAdapters: {
      os,
      ...(options.runtimeAdapters || {}),
    },
  }
  return originalConnect(uri, nextOptions, ...rest)
}
