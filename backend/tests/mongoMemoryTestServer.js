const { MongoMemoryReplSet } = require('mongodb-memory-server')

const WINDOWS_MONGO_HINT = `
[Windows / MongoDB Memory Server]
Embedded mongod failed to start (often exit code 3221225781 = missing MSVC runtime).

Fix one of:
  • Install **Visual C++ Redistributable (x64)**:
    https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist
  • Or run MongoDB locally / in Docker and set **MONGO_TEST_URI**, e.g.:
      set MONGO_TEST_URI=mongodb://127.0.0.1:27017/ops_dashboard_jest
    (then: docker run -d --name mongo-jest -p 27017:27017 mongo:7)
See docs/WINDOWS-DEV.md
`.trim()

/**
 * Start MongoDB for Jest: either `MONGO_TEST_URI` (real server) or mongodb-memory-server.
 * Returned value matches MongoMemoryServer’s `getUri()` / `stop()` API.
 *
 * @returns {Promise<{ getUri: () => string, stop: () => Promise<void> }>}
 */
async function startMongoMemoryServer() {
  const external = String(process.env.MONGO_TEST_URI || '').trim()
  if (external) {
    return {
      getUri: () => external,
      stop: async () => {},
    }
  }

  try {
    const replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    })
    await replSet.waitUntilRunning()
    return replSet
  } catch (err) {
    const text = String(err?.message || err)
    const looksLikeWindowsBinaryFailure = process.platform === 'win32'
      && (text.includes('3221225781') || /vc_redist|UnexpectedCloseError/i.test(text))
    const hint = looksLikeWindowsBinaryFailure ? `\n\n${WINDOWS_MONGO_HINT}\n` : ''
    const wrapped = new Error(`${text}${hint}`)
    wrapped.cause = err
    throw wrapped
  }
}

/** @param {import('mongoose').Mongoose} mongoose */
function isMongooseConnected(mongoose) {
  return mongoose.connection.readyState === 1
}

/**
 * Disconnect only when connected (avoids errors after a failed `beforeAll`).
 * @param {import('mongoose').Mongoose} mongoose
 */
async function disconnectMongooseIfConnected(mongoose) {
  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect()
  }
}

module.exports = {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
}
