/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const sourcePath = path.join(repoRoot, 'shared', 'erp-access-matrix.json')
const targets = [
  path.join(repoRoot, 'backend', 'shared', 'erp-access-matrix.json'),
  path.join(repoRoot, 'frontend', 'src', 'generated', 'erp-access-matrix.json'),
]

function readCanonicalMatrix() {
  const raw = fs.readFileSync(sourcePath, 'utf8')
  const parsed = JSON.parse(raw)
  return `${JSON.stringify(parsed, null, 2)}\n`
}

function syncAccessPolicy() {
  const content = readCanonicalMatrix()
  for (const target of targets) {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
    console.log(`synced ${path.relative(repoRoot, target)}`)
  }
}

syncAccessPolicy()
