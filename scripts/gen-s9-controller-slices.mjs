import fs from 'fs'
import path from 'path'

function adjustImportsForSlice(imports) {
  return imports
    .replace(/from '\.\.\/\.\.\/\.\.\//g, "from '../../../../")
    .replace(/from '\.\.\/(?!\.\.)/g, "from '../../")
    .replace(/from '\.\//g, "from '../")
}

const srcPath = 'frontend/src/components/tabs/erp/useErpTabController.js'
const src = fs.readFileSync(srcPath, 'utf8')
const lines = src.split('\n')

const importEnd = lines.findIndex((l) => l.startsWith('export function useErpTabController'))
const imports = adjustImportsForSlice(lines.slice(0, importEnd).join('\n'))

const bodyStart = lines.findIndex((l, i) => i > importEnd && l.trim() === '}) {') + 1
const bindingsStart = lines.findIndex((l) => l.includes('const { panelProps, modalProps } = useErpTabBindings'))

const bodyLines = lines.slice(bodyStart, bindingsStart)

function collectUsedScopeKeys(sliceLines, availableKeys) {
  const bodyText = sliceLines.join('\n')
  return availableKeys.filter((key) => new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(bodyText))
}

const propsKeys = [
  'focusTab',
  'onNavigateMain',
  'onErpSubTabChange',
  'jumpToTransactionId',
  'onJumpToTransactionConsumed',
  'jumpToVoucher',
  'onJumpToVoucherConsumed',
  'jumpToEnquiryAccountCode',
  'onJumpToEnquiryConsumed',
]

const slices = [
  { name: 'useErpTabCoreSlice', start: 0, end: 411 },
  { name: 'useErpTabCatalogSlice', start: 411, end: 809 },
  { name: 'useErpTabDomainActionsSlice', start: 809, end: 1195 },
  { name: 'useErpTabPresentationSlice', start: 1195, end: bodyLines.length },
]

const sliceDir = 'frontend/src/components/tabs/erp/controllerSlices'
fs.mkdirSync(sliceDir, { recursive: true })

function collectReturnEntries(sliceLines) {
  const entries = new Map()
  const text = sliceLines.join('\n')

  for (const line of sliceLines) {
    const arr = line.match(/^  const \[([^\]]+)\]/)
    if (arr) {
      arr[1].split(',').forEach((part) => {
        const name = part.trim().split(':')[0].trim()
        if (name && !name.startsWith('_')) entries.set(name, name)
      })
      continue
    }
    const plain = line.match(/^  const ([A-Za-z_$][\w$]*) =/)
    if (plain && !plain[1].startsWith('_')) entries.set(plain[1], plain[1])
  }

  const destructureRe = /^  const\s*\{([^}]+)\}\s*=/gm
  let match
  while ((match = destructureRe.exec(text))) {
    match[1].split(',').forEach((part) => {
      const bit = part.trim()
      if (!bit) return
      const alias = bit.match(/^([\w$]+)\s*:\s*([\w$]+)$/)
      if (alias) {
        if (!alias[1].startsWith('_')) entries.set(alias[1], alias[2])
        if (!alias[2].startsWith('_') && alias[1] !== alias[2]) entries.set(alias[2], alias[2])
        return
      }
      const plainName = bit.match(/^([\w$]+)$/)
      if (plainName && !plainName[1].startsWith('_')) entries.set(plainName[1], plainName[1])
    })
  }

  return [...entries.entries()].sort(([a], [b]) => a.localeCompare(b))
}

let accumulated = []
const sliceMeta = []

for (const slice of slices) {
  const sliceLines = bodyLines.slice(slice.start, slice.end)
  const returnEntries = collectReturnEntries(sliceLines)
  if (slice.name === 'useErpTabCoreSlice') {
    for (const key of propsKeys) {
      if (!returnEntries.some(([k]) => k === key)) {
        returnEntries.push([key, key])
      }
    }
    returnEntries.sort(([a], [b]) => a.localeCompare(b))
  }
  sliceMeta.push({ ...slice, bindings: returnEntries.map(([k]) => k), lineCount: sliceLines.length })

  const scopeKeys = slice.name === 'useErpTabCoreSlice'
    ? propsKeys
    : collectUsedScopeKeys(sliceLines, accumulated)
  const scopeDestruct = slice.name === 'useErpTabCoreSlice'
    ? `  const {\n${scopeKeys.map((k) => `    ${k},`).join('\n')}\n  } = props\n`
    : scopeKeys.length
      ? `  const {\n${scopeKeys.map((k) => `    ${k},`).join('\n')}\n  } = scope\n`
      : ''

  const file = `${imports}

export function ${slice.name}(${slice.name === 'useErpTabCoreSlice' ? 'props' : 'scope'}) {
${scopeDestruct}
${sliceLines.join('\n')}

  return {
${returnEntries.map(([key, value]) => (key === value ? `    ${key},` : `    ${key}: ${value},`)).join('\n')}
  }
}
`
  fs.writeFileSync(path.join(sliceDir, `${slice.name}.js`), file)
  accumulated = [...new Set([
    ...accumulated,
    ...returnEntries.flatMap(([key, value]) => (value !== key && !value.startsWith('_') ? [key, value] : [key])),
  ])]
}

const controllerImports = lines.slice(0, importEnd).join('\n')
const controller = `${controllerImports.replace(
  "import { useErpTabBindings } from './useErpTabBindings'",
  `import { useErpTabBindings } from './useErpTabBindings'
import { useErpTabCoreSlice } from './controllerSlices/useErpTabCoreSlice'
import { useErpTabCatalogSlice } from './controllerSlices/useErpTabCatalogSlice'
import { useErpTabDomainActionsSlice } from './controllerSlices/useErpTabDomainActionsSlice'
import { useErpTabPresentationSlice } from './controllerSlices/useErpTabPresentationSlice'`,
)}

export function useErpTabController({
  focusTab,
  onNavigateMain,
  onErpSubTabChange,
  jumpToTransactionId = null,
  onJumpToTransactionConsumed,
  jumpToVoucher = null,
  onJumpToVoucherConsumed,
  jumpToEnquiryAccountCode = null,
  onJumpToEnquiryConsumed,
}) {
  const core = useErpTabCoreSlice({
    focusTab,
    onNavigateMain,
    onErpSubTabChange,
    jumpToTransactionId,
    onJumpToTransactionConsumed,
    jumpToVoucher,
    onJumpToVoucherConsumed,
    jumpToEnquiryAccountCode,
    onJumpToEnquiryConsumed,
  })
  const catalog = useErpTabCatalogSlice(core)
  const domain = useErpTabDomainActionsSlice({ ...core, ...catalog })
  const presentation = useErpTabPresentationSlice({ ...core, ...catalog, ...domain })
  const scope = { ...core, ...catalog, ...domain, ...presentation }
  const { panelProps, modalProps } = useErpTabBindings(scope)

  return {
    panelProps,
    modalProps,
    canAccessERP: scope.canAccessERP,
    canViewCurrentErpSubTab: scope.canViewCurrentErpSubTab,
    token: scope.token,
    error: scope.error,
    success: scope.success,
    C: scope.C,
  }
}
`

fs.writeFileSync(srcPath, controller)

console.log('slices:')
for (const s of sliceMeta) {
  console.log(`  ${s.name}: ${s.lineCount} lines, ${s.bindings.length} exports`)
}
console.log('controller:', controller.split('\n').length, 'lines')
