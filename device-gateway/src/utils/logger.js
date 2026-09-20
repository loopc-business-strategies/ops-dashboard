function createLogger(scope = 'gateway') {
  const prefix = `[mg-device-gateway:${scope}]`
  return {
    info: (msg, meta) => console.info(prefix, msg, meta || ''),
    warn: (msg, meta) => console.warn(prefix, msg, meta || ''),
    error: (msg, meta) => console.error(prefix, msg, meta || ''),
  }
}

module.exports = { createLogger }
