const net = require('net')
const { spawn } = require('child_process')

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()

    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })

    // Probe on any host to mirror how backend binds (e.g. :::5000 on Windows)
    server.listen(port)
  })
}

async function findFreePort(startPort, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const port = startPort + i
    // eslint-disable-next-line no-await-in-loop
    const free = await isPortFree(port)
    if (free) return port
  }
  throw new Error(`No free port found in range ${startPort}-${startPort + attempts - 1}`)
}

function startProcess(commandLine, extraEnv) {
  return spawn(commandLine, {
    cwd: process.cwd(),
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv,
    },
  })
}

async function main() {
  const backendPort = await findFreePort(5000)
  const frontendPort = await findFreePort(5173)

  if (backendPort !== 5000) {
    console.log(`[dev] Port 5000 is busy. Using backend port ${backendPort}.`)
  }
  if (frontendPort !== 5173) {
    console.log(`[dev] Port 5173 is busy. Using frontend port ${frontendPort}.`)
  }

  const apiBase = `http://localhost:${backendPort}`
  console.log(`[dev] API base for frontend: ${apiBase}`)

  const backend = startProcess('npm --prefix backend run dev', {
    PORT: String(backendPort),
  })

  const frontend = startProcess(`npm --prefix frontend run dev -- --port ${frontendPort}`, {
    VITE_API_BASE_URL: apiBase,
    VITE_API_URL: apiBase,
  })

  let shuttingDown = false
  const shutdown = () => {
    if (shuttingDown) return
    shuttingDown = true
    backend.kill()
    frontend.kill()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  backend.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev] Backend exited with code ${code}. Stopping frontend.`)
      shutdown()
      process.exitCode = code || 1
    }
  })

  frontend.on('exit', (code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`[dev] Frontend exited with code ${code}. Stopping backend.`)
      shutdown()
      process.exitCode = code || 1
    }
  })
}

main().catch((error) => {
  console.error('[dev] Failed to start dev orchestrator:', error.message)
  process.exit(1)
})
