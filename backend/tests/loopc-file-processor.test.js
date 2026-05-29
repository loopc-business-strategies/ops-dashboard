const { classifyFile, processUploadedFile } = require('../services/loopcFileProcessor')

describe('loopcFileProcessor', () => {
  test('classifyFile detects image and pdf', () => {
    expect(classifyFile('image/png', 'photo.png')).toBe('image')
    expect(classifyFile('application/pdf', 'invoice.pdf')).toBe('pdf')
    expect(classifyFile('audio/webm', 'voice.webm')).toBe('audio')
  })

  test('processUploadedFile extracts csv preview', async () => {
    const csv = 'name,amount\nGold,100\nSilver,50'
    const result = await processUploadedFile({
      originalname: 'rates.csv',
      mimetype: 'text/csv',
      size: csv.length,
      buffer: Buffer.from(csv, 'utf8'),
    })
    expect(result.kind).toBe('document')
    expect(result.stats.rows).toBe(2)
    expect(result.textExcerpt).toMatch(/Gold/)
  })

  test('processUploadedFile handles images as base64', async () => {
    const buf = Buffer.from('fake-image-bytes')
    const result = await processUploadedFile({
      originalname: 'chart.png',
      mimetype: 'image/png',
      size: buf.length,
      buffer: buf,
    })
    expect(result.kind).toBe('image')
    expect(result.imageBase64).toBeTruthy()
  })
})
