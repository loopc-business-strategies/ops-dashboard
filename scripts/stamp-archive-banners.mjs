import fs from 'node:fs'
import path from 'node:path'

const ARCHIVE_DIR = path.join(process.cwd(), 'docs', 'archive')
const STAMP_MARKER = 'ARCHIVED — do not use for current operations.'
const BANNER = `> **${STAMP_MARKER}**  
> This is a historical snapshot and may not match the codebase.  
> Canonical docs: [docs/DEPLOY.md](../DEPLOY.md) · [README.md](../../README.md)

`

const entries = fs.readdirSync(ARCHIVE_DIR, { withFileTypes: true })
let stamped = 0
let skipped = 0

for (const entry of entries) {
  if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name === 'README.md') {
    continue
  }

  const filePath = path.join(ARCHIVE_DIR, entry.name)
  const text = fs.readFileSync(filePath, 'utf8')

  if (text.includes(STAMP_MARKER)) {
    skipped += 1
    continue
  }

  fs.writeFileSync(filePath, `${BANNER}${text}`)
  stamped += 1
  console.log(`stamped: ${entry.name}`)
}

console.log(`Done. stamped=${stamped} skipped=${skipped}`)
