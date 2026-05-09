const https = require('https')

const makeRequest = (method, path, data = null) => new Promise((resolve, reject) => {
  const url = new URL('https://api.loopcstrategies.com' + path)
  const options = {
    method,
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-ID': 'mg',
    },
  }
  const req = https.request(options, (res) => {
    let body = ''
    res.on('data', (chunk) => (body += chunk))
    res.on('end', () => {
      try {
        resolve({ status: res.statusCode, data: JSON.parse(body) })
      } catch (e) {
        resolve({ status: res.statusCode, data: body })
      }
    })
  })
  req.on('error', reject)
  if (data) req.write(JSON.stringify(data))
  req.end()
})

;(async () => {
  try {
    let loginRes = await makeRequest('POST', '/api/auth/login', { name: 'Nan', password: '123456' })
    console.log('Login Response:')
    console.log(JSON.stringify(loginRes, null, 2))
  } catch (e) {
    console.error(e.message)
  }
})()
