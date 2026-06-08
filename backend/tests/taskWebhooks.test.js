describe('taskWebhooks emitTaskWebhook', () => {
  afterEach(() => {
    delete process.env.TASK_WEBHOOK_URLS
    delete process.env.TASK_WEBHOOK_SECRET
    delete process.env.TASK_WEBHOOK_ENABLED
    jest.resetModules()
    jest.restoreAllMocks()
  })

  test('does not POST when TASK_WEBHOOK_ENABLED is not true', async () => {
    process.env.TASK_WEBHOOK_URLS = 'http://127.0.0.1:9/nowhere'
    process.env.TASK_WEBHOOK_ENABLED = 'false'
    const { emitTaskWebhook } = require('../utils/taskWebhooks')
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true })
    emitTaskWebhook('task.test', { x: 1 })
    await new Promise((r) => setImmediate(r))
    expect(spy).not.toHaveBeenCalled()
  })

  test('POSTs when TASK_WEBHOOK_ENABLED=true and URLs are set', async () => {
    process.env.TASK_WEBHOOK_URLS = 'http://127.0.0.1:9/nowhere'
    process.env.TASK_WEBHOOK_ENABLED = 'true'
    const { emitTaskWebhook } = require('../utils/taskWebhooks')
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true })
    emitTaskWebhook('task.test', { x: 1 })
    await new Promise((r) => setImmediate(r))
    expect(spy).toHaveBeenCalled()
    const [url, init] = spy.mock.calls[0]
    expect(String(url)).toContain('127.0.0.1')
    expect(init.method).toBe('POST')
    expect(init.headers['Content-Type']).toBe('application/json')
    const parsed = JSON.parse(init.body)
    expect(parsed.webhookDeliveryId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(parsed.event).toBe('task.test')
  })
})
