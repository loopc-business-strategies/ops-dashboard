const { createMakeRequest, assertLoginConfigured, loginPayloadForApi } = require('./_opsMiscEnv')

const makeRequest = createMakeRequest()

;(async () => {
  try {
    assertLoginConfigured()
    const loginRes = await makeRequest('POST', '/api/auth/login', loginPayloadForApi())
    console.log('Login Response:')
    console.log(JSON.stringify(loginRes, null, 2))
  } catch (e) {
    console.error(e.message)
  }
})()
