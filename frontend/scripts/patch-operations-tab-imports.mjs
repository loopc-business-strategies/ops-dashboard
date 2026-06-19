import fs from 'node:fs'

const p = 'frontend/src/components/tabs/OperationsTab.jsx'
let s = fs.readFileSync(p, 'utf8')
const start = s.indexOf('// ─── Design tokens')
const end = s.indexOf('const LEGAL_DOC_ACCEPT')
const imports = `import {
  getOpsTabs,
  opsPct,
  INIT_SUPPLIERS,
  INIT_GOLD,
  INIT_ROUTES,
  INIT_SEC_VENDORS,
  INIT_INCIDENTS,
  INIT_VENDORS,
  INIT_INVENTORY,
  INIT_CHECKLIST,
  INIT_NOTIFS,
} from './operations/operationsSeedData'
import { OPS_C as C } from './operations/operationsTabTokens'
import {
  B,
  stars,
  Badge,
  ProgBar,
  ProgRow,
  StatCard,
  Card,
  CardTitle,
  TableWrap,
  TableHead,
  SH,
  Restrict,
  ML,
  MI,
  MS,
  MTA,
  Modal,
  Toast,
  TH,
  TD,
  IS,
} from './operations/operationsTabUI'

const pct = opsPct

`
s = s.slice(0, start) + imports + s.slice(end)
fs.writeFileSync(p, s)
console.log('patched OperationsTab.jsx')
