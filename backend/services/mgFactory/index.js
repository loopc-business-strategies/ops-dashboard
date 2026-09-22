const jwt = require('jsonwebtoken')
const User = require('../../models/User')
const FactoryDepartmentCredential = require('../../models/FactoryDepartmentCredential')
const ProductionPass = require('../../models/ProductionPass')
const ProductionBatch = require('../../models/ProductionBatch')
const { DEFAULT_FLOW_STAGES } = require('../productionControl/constants')
const { flowConfigService, passService, machineAlertService, floorSessionService } = require('../productionControl')
const { resolveProductionRole, hasProductionPermission } = require('../productionControl/permissions')
const { ProductionError } = require('../productionControl/batchService')
const { departmentsMatch } = require('../productionControl/statusTransitions')

const DEPT_TOKEN_TYP = 'mgf_dept'
const EMP_TOKEN_TYP = 'mgf_emp'
const DEPT_TOKEN_TTL = process.env.MG_FACTORY_DEPT_TOKEN_TTL || '12h'
const EMP_TOKEN_TTL = process.env.MG_FACTORY_EMP_TOKEN_TTL || process.env.JWT_EXPIRES_IN || '8h'

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Strict 24-hex ObjectId check (avoids mongoose treating short strings as valid). */
function isMongoObjectId(value) {
  return /^[a-fA-F0-9]{24}$/.test(String(value || '').trim())
}

async function resolvePassByIdOrNumber(passIdOrNumber) {
  const raw = String(passIdOrNumber || '').trim()
  if (!raw) return null
  if (isMongoObjectId(raw)) {
    const byId = await ProductionPass.findById(raw).lean()
    if (byId) return byId
  }
  return ProductionPass.findOne({
    passNumber: { $regex: new RegExp(`^${escapeRegex(raw)}$`, 'i') },
  }).lean()
}

async function resolveBatchByIdOrNumber(batchIdOrNumber) {
  const raw = String(batchIdOrNumber || '').trim()
  if (!raw) return null
  if (isMongoObjectId(raw)) {
    const byId = await ProductionBatch.findById(raw).lean()
    if (byId) return byId
  }
  return ProductionBatch.findOne({
    batchNumber: { $regex: new RegExp(`^${escapeRegex(raw)}$`, 'i') },
  }).lean()
}

function signDepartmentToken(departmentKey, label) {
  return jwt.sign(
    {
      typ: DEPT_TOKEN_TYP,
      company: 'mg',
      departmentKey: String(departmentKey).toLowerCase(),
      departmentLabel: label || departmentKey,
    },
    process.env.JWT_SECRET,
    { expiresIn: DEPT_TOKEN_TTL, algorithm: 'HS256' },
  )
}

function signEmployeeToken(userId, departmentKey, label) {
  return jwt.sign(
    {
      id: String(userId),
      company: 'mg',
      typ: EMP_TOKEN_TYP,
      departmentKey: String(departmentKey).toLowerCase(),
      departmentLabel: label || departmentKey,
    },
    process.env.JWT_SECRET,
    { expiresIn: EMP_TOKEN_TTL, algorithm: 'HS256' },
  )
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })
}

function readBearer(req) {
  const header = String(req.headers.authorization || '')
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim()
  return null
}

async function resolveDepartmentLabel(departmentKey) {
  const key = String(departmentKey || '').toLowerCase()
  try {
    const flow = await flowConfigService.getActiveFlowConfig()
    const stage = (flow?.stages || []).find((s) => String(s.key).toLowerCase() === key)
    if (stage) return stage.label || stage.key
  } catch {
    // fall through
  }
  const def = DEFAULT_FLOW_STAGES.find((s) => s.key === key)
  return def?.label || key
}

async function departmentLogin({ departmentKey, password }) {
  const key = String(departmentKey || '').trim().toLowerCase()
  if (!key || !password) throw new ProductionError('Department and password are required', 400)

  const Cred = await FactoryDepartmentCredential.getTenantModel('mg')
  const cred = await Cred.findOne({ departmentKey: key, active: true }).select('+passwordHash')
  if (!cred || !(await cred.comparePassword(password))) {
    throw new ProductionError('Invalid department credentials', 401)
  }

  const label = cred.label || (await resolveDepartmentLabel(key))
  const departmentToken = signDepartmentToken(key, label)
  return {
    departmentToken,
    department: { key, label },
  }
}

async function employeeLogin(req, { name, password }) {
  const decoded = req.mgFactoryDepartment
  if (!decoded?.departmentKey) throw new ProductionError('Department session required', 401)

  const safeName = escapeRegex(String(name || '').trim())
  if (!safeName || !password) throw new ProductionError('Username and password are required', 400)

  const TenantUser = await User.getTenantModel('mg')
  const user = await TenantUser.findOne({
    name: { $regex: new RegExp(`^${safeName}$`, 'i') },
    isDeleted: { $ne: true },
  }).select('+password')

  if (!user || !(await user.comparePassword(password))) {
    throw new ProductionError('Invalid credentials', 401)
  }
  if (!user.isActive) throw new ProductionError('Account deactivated. Contact your admin.', 401)

  user.lastLogin = new Date()
  await user.save({ validateBeforeSave: false })

  const departmentKey = decoded.departmentKey
  const departmentLabel = decoded.departmentLabel || (await resolveDepartmentLabel(departmentKey))
  const token = signEmployeeToken(user._id, departmentKey, departmentLabel)

  const productionRole = resolveProductionRole(user)
  return {
    token,
    department: { key: departmentKey, label: departmentLabel },
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
      department: user.department,
      productionRole,
    },
    permissions: {
      metalIn: hasProductionPermission(user, 'receivePass'),
      metalOut: hasProductionPermission(user, 'createPass'),
      callManager: true,
      view: hasProductionPermission(user, 'view'),
    },
  }
}

async function issueBiometricToken(req) {
  if (!req.user?._id || !req.mgFactoryDepartment?.departmentKey) {
    throw new ProductionError('Employee session required', 401)
  }
  const { departmentKey, departmentLabel } = req.mgFactoryDepartment
  const token = signEmployeeToken(req.user._id, departmentKey, departmentLabel)
  return { token }
}

async function getMe(req) {
  const dept = req.mgFactoryDepartment || {}
  const productionRole = resolveProductionRole(req.user)
  return {
    tenant: 'mg',
    department: {
      key: dept.departmentKey,
      label: dept.departmentLabel || (await resolveDepartmentLabel(dept.departmentKey)),
    },
    user: {
      id: req.user._id,
      name: req.user.name,
      role: req.user.role,
      department: req.user.department,
      productionRole,
    },
    permissions: {
      metalIn: hasProductionPermission(req.user, 'receivePass'),
      metalOut: hasProductionPermission(req.user, 'createPass'),
      callManager: true,
      view: hasProductionPermission(req.user, 'view'),
    },
  }
}

async function listDepartments() {
  const flow = await flowConfigService.getActiveFlowConfig()
  const stages = flow?.stages?.length ? flow.stages : DEFAULT_FLOW_STAGES
  return stages.map((s) => ({
    key: s.key,
    label: s.label || s.key,
    process: s.process || s.label,
    order: s.order,
  }))
}

async function listJobs(req) {
  const departmentKey = req.mgFactoryDepartment?.departmentKey
  if (!departmentKey) throw new ProductionError('Department session required', 401)

  const [allInbound, allBatches] = await Promise.all([
    ProductionPass.find({
      status: { $in: ['ISSUED', 'IN_TRANSIT'] },
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean(),
    ProductionBatch.find({
      status: {
        $nin: ['CANCELLED', 'COMPLETED', 'RETURNED_TO_VAULT', 'SPLIT', 'MERGED'],
      },
    })
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean(),
  ])

  const inboundPasses = allInbound.filter((p) => departmentsMatch(p.toDepartment, departmentKey))
  const batches = allBatches.filter((b) =>
    departmentsMatch(b.currentDepartment || b.currentLocation || '', departmentKey),
  )

  return { inboundPasses, batches }
}

async function metalIn(req, body = {}) {
  const {
    passId,
    receivedWeight,
    varianceReason = '',
    operationId = null,
    expectedBatchVersion,
  } = body

  if (!passId) throw new ProductionError('passId is required for Metal IN')
  const weight = Number(receivedWeight)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ProductionError('receivedWeight must be a positive number')
  }

  if (!hasProductionPermission(req.user, 'receivePass')) {
    throw new ProductionError('Insufficient permission for Metal IN', 403)
  }

  const pass = await resolvePassByIdOrNumber(passId)
  if (!pass) throw new ProductionError('Pass not found', 404)
  const departmentKey = req.mgFactoryDepartment?.departmentKey
  if (departmentKey && !departmentsMatch(pass.toDepartment, departmentKey)) {
    throw new ProductionError(`Pass is destined for ${pass.toDepartment}, not ${departmentKey}`, 403)
  }

  const result = await passService.receivePass(req, pass._id, {
    receivedWeight: weight,
    expectedBatchVersion,
    receiveIdempotencyKey: operationId || null,
    varianceReason,
  })

  return {
    type: 'metal_in',
    pass: result.pass,
    batch: result.batch,
    reused: Boolean(result.reused),
    weight,
  }
}

async function metalOut(req, body = {}) {
  const {
    batchId,
    toDepartment,
    weight: clientWeight,
    purpose = '',
    operationId = null,
  } = body

  if (!batchId || !toDepartment) {
    throw new ProductionError('batchId and toDepartment are required for Metal OUT')
  }
  const weight = Number(clientWeight)
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new ProductionError('weight must be a positive number')
  }
  if (!hasProductionPermission(req.user, 'createPass')) {
    throw new ProductionError('Insufficient permission for Metal OUT', 403)
  }

  const departmentKey = req.mgFactoryDepartment?.departmentKey
  const batch = await resolveBatchByIdOrNumber(batchId)
  if (!batch) throw new ProductionError('Batch not found', 404)
  if (
    departmentKey
    && !departmentsMatch(batch.currentDepartment || batch.currentLocation || '', departmentKey)
  ) {
    throw new ProductionError(
      `Batch is in ${batch.currentDepartment || batch.currentLocation}, not ${departmentKey}`,
      403,
    )
  }

  const created = await passService.createPass(req, {
    batchId: batch._id,
    fromDepartment: departmentKey || batch.currentDepartment,
    toDepartment,
    weight,
    purpose: purpose || 'MG Factory Metal OUT',
    idempotencyKey: operationId || null,
  })

  let pass = created.pass
  let movement = null
  let reused = Boolean(created.reused)

  if (!reused || pass.status === 'REQUESTED' || pass.status === 'APPROVED') {
    try {
      // approvePass returns the pass document (not { pass })
      const approvedPass =
        pass.status === 'REQUESTED' ? await passService.approvePass(req, pass._id) : pass
      const issued = await passService.issuePass(req, approvedPass._id || pass._id, {
        idempotencyKey: operationId || null,
      })
      pass = issued.pass
      movement = issued.movement
      if (issued.reused) reused = true
    } catch (err) {
      if (!/already|status|permission|Insufficient/i.test(String(err.message || ''))) throw err
    }
  }

  return { type: 'metal_out', pass, movement, reused, weight }
}

async function callManager(req, body = {}) {
  const departmentKey = req.mgFactoryDepartment?.departmentKey || 'unknown'
  const departmentLabel =
    req.mgFactoryDepartment?.departmentLabel || (await resolveDepartmentLabel(departmentKey))
  const message =
    String(body.message || '').trim()
    || `${req.user?.name || 'Operator'} requested floor manager assistance in ${departmentLabel}`

  let openManagers = []
  try {
    openManagers = await floorSessionService.getOpenManagers()
  } catch {
    openManagers = []
  }

  const alert = await machineAlertService.raiseAlert(req, {
    category: 'department',
    code: 'CALL_FLOOR_MANAGER',
    title: `Floor manager call — ${departmentLabel}`,
    message,
    severity: 'critical',
    metadata: {
      source: 'mg-factory',
      departmentKey,
      departmentLabel,
      employeeId: req.user?._id || null,
      employeeName: req.user?.name || '',
      openManagerCount: openManagers.length,
      openManagers: openManagers.slice(0, 10).map((s) => ({
        name: s.name,
        userId: s.userId,
        loginAt: s.loginAt,
      })),
    },
  })

  return { alert }
}

async function setDepartmentPassword(req, { departmentKey, password, label }) {
  const key = String(departmentKey || '').trim().toLowerCase()
  if (!key || !password) throw new ProductionError('departmentKey and password are required', 400)
  if (String(password).length < 4) throw new ProductionError('Password must be at least 4 characters', 400)

  const passwordHash = await FactoryDepartmentCredential.hashPassword(password)
  const resolvedLabel = label || (await resolveDepartmentLabel(key))
  const Cred = await FactoryDepartmentCredential.getTenantModel('mg')
  const row = await Cred.findOneAndUpdate(
    { departmentKey: key },
    {
      departmentKey: key,
      label: resolvedLabel,
      passwordHash,
      active: true,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return { department: { key: row.departmentKey, label: row.label, active: row.active } }
}

module.exports = {
  DEPT_TOKEN_TYP,
  EMP_TOKEN_TYP,
  readBearer,
  verifyToken,
  signDepartmentToken,
  signEmployeeToken,
  departmentLogin,
  employeeLogin,
  issueBiometricToken,
  getMe,
  listDepartments,
  listJobs,
  metalIn,
  metalOut,
  callManager,
  setDepartmentPassword,
  ProductionError,
}
