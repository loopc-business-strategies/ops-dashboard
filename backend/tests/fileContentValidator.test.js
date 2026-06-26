const fs = require('fs')
const os = require('os')
const path = require('path')
const { validateFileContent } = require('../utils/fileContentValidator')

describe('fileContentValidator', () => {
  test('accepts PNG content with image/png MIME', () => {
    const filePath = path.join(os.tmpdir(), `upload-test-${Date.now()}.png`)
    fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const result = validateFileContent(filePath, 'image/png')
    fs.unlinkSync(filePath)
    expect(result.ok).toBe(true)
  })

  test('rejects executable content declared as PDF', () => {
    const filePath = path.join(os.tmpdir(), `upload-test-${Date.now()}.pdf`)
    fs.writeFileSync(filePath, Buffer.from([0x4d, 0x5a, 0x90, 0x00]))
    const result = validateFileContent(filePath, 'application/pdf')
    fs.unlinkSync(filePath)
    expect(result.ok).toBe(false)
  })
})
