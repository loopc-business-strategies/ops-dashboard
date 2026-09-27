const os = require('os')
const path = require('path')

process.env.MG_FLOOR_CAPTURE_UPLOAD_DIR = path.join(os.tmpdir(), `mg-floor-captures-test-${process.pid}`)

const request = require('supertest')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const {
  startMongoMemoryServer,
  isMongooseConnected,
  disconnectMongooseIfConnected,
} = require('./mongoMemoryTestServer')

const createApp = require('../app')
const User = require('../models/User')

let mongo
let app

const HOST = 'api.loopcstrategies.com'
const tokenFor = (user, tenant) => jwt.sign({ id: user._id.toString(), company: tenant }, process.env.JWT_SECRET)

function withDbName(uri, dbName) {
  const parsed = new URL(uri)
  parsed.pathname = `/${dbName}`
  return parsed.toString()
}

let userSeq = 0
const createTenantUser = async (tenant, overrides = {}) => {
  const TenantUser = await User.getTenantModel(tenant)
  userSeq += 1
  const now = `${Date.now().toString(36)}${userSeq}`
  return TenantUser.create({
    name: `${tenant}-capture-${now}`,
    email: `${tenant}-capture-${now}@example.com`,
    password: 'password123',
    role: 'super_admin',
    department: 'production',
    productionRole: 'production_manager',
    ...overrides,
  })
}

const mgHeaders = (user) => ({
  Host: HOST,
  'x-tenant': 'mg',
  Authorization: `Bearer ${tokenFor(user, 'mg')}`,
})

// Smallest byte sequence that passes the JPEG signature check.
const TINY_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0xff, 0xd9])

let captureSeq = 0
const newCaptureId = () => {
  captureSeq += 1
  return `cap_test_${Date.now()}_${captureSeq}`
}

async function createCameraScale(user, overrides = {}) {
  const res = await request(app)
    .post('/api/mg-floor/scales')
    .set(mgHeaders(user))
    .send({
      scaleId: 'MG-SCALE-GJ-TEST',
      name: 'GJ-2000 test',
      manufacturer: 'Shinko Denshi',
      model: 'GJ-2000',
      captureMethods: ['CAMERA_OCR'],
      capacity: 2200,
      resolution: 0.01,
      unit: 'g',
      department: 'melting',
      ...overrides,
    })
  return res
}

function cameraCapture(overrides = {}) {
  return {
    captureId: newCaptureId(),
    scaleId: 'MG-SCALE-GJ-TEST',
    weight: 1250.35,
    unit: 'g',
    captureMethod: 'CAMERA_OCR',
    ocrConfidence: 0.98,
    ocrRawText: '1250.35',
    crossCheckAgreed: true,
    stable: true,
    stableFrames: 5,
    deviceId: 'MG-FLOOR-TABLET-001',
    capturedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = 'loopc'
  delete process.env.MG_FLOOR_SEED_DEFAULT_SCALES

  mongo = await startMongoMemoryServer()
  const baseUri = mongo.getUri()
  process.env.MONGO_URI = withDbName(baseUri, 'default')
  process.env.MONGO_URI_LOOPC = withDbName(baseUri, 'loopc')
  process.env.MONGO_URI_MG = withDbName(baseUri, 'mg')
  process.env.MONGO_URI_CG = withDbName(baseUri, 'cg')
  process.env.MONGO_URI_VB = withDbName(baseUri, 'vb')

  await mongoose.connect(process.env.MONGO_URI_MG)
  app = createApp()
  process.env.NODE_ENV = 'test'
  delete process.env.MG_FLOOR_SEED_DEFAULT_SCALES
}, 120000)

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  const Scale = require('../models/Scale')
  const FloorWeightCapture = require('../models/FloorWeightCapture')
  const ScaleMg = await Scale.getTenantModel('mg')
  const CaptureMg = await FloorWeightCapture.getTenantModel('mg')
  await Promise.all([
    ScaleMg.deleteMany({}),
    CaptureMg.deleteMany({}),
    (await User.getTenantModel('mg')).deleteMany({}),
    (await User.getTenantModel('cg')).deleteMany({}),
  ])
}, 60000)

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
}, 60000)

describe('MG Floor scale registry (fresh start)', () => {
  test('no default scales are seeded when MG_FLOOR_SEED_DEFAULT_SCALES is off', async () => {
    const user = await createTenantUser('mg')
    const res = await request(app).get('/api/mg-floor/scales').set(mgHeaders(user))
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(0)
  })

  test('camera-only scale needs no gateway and gets no invented RS-232 settings', async () => {
    const user = await createTenantUser('mg')
    const res = await createCameraScale(user)
    expect(res.status).toBe(201)
    expect(res.body.scale.connectionType).toBe('CAMERA')
    expect(res.body.scale.captureMethods).toEqual(['CAMERA_OCR'])
    expect(res.body.scale.baudRate).toBeNull()
    expect(res.body.scale.gatewayId).toBe('')
    expect(res.body.scale.cameraOcr.minConfidence).toBe(0.9)

    const digitalNoGateway = await request(app)
      .post('/api/mg-floor/scales')
      .set(mgHeaders(user))
      .send({ scaleId: 'MG-SCALE-RS-NOGW' })
    expect(digitalNoGateway.status).toBe(400)
  })

  test('archive hides a scale, rejects capture, and re-adding restores it', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user)

    const noReason = await request(app)
      .post('/api/mg-floor/scales/MG-SCALE-GJ-TEST/archive')
      .set(mgHeaders(user))
      .send({})
    expect(noReason.status).toBe(400)

    const archived = await request(app)
      .post('/api/mg-floor/scales/MG-SCALE-GJ-TEST/archive')
      .set(mgHeaders(user))
      .send({ reason: 'Fresh registry before commissioning' })
    expect(archived.status).toBe(200)
    expect(archived.body.scale.archived).toBe(true)

    const list = await request(app).get('/api/mg-floor/scales').set(mgHeaders(user))
    expect(list.body.total).toBe(0)

    const capture = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(user))
      .send(cameraCapture())
    expect(capture.status).toBe(404)

    const restored = await createCameraScale(user, { department: 'casting' })
    expect(restored.status).toBe(201)
    expect(restored.body.scale.archived).toBe(false)
    expect(restored.body.scale.department).toBe('casting')
  })

  test('camera OCR settings are validated on patch', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user)
    const bad = await request(app)
      .patch('/api/mg-floor/scales/MG-SCALE-GJ-TEST')
      .set(mgHeaders(user))
      .send({ cameraOcr: { minConfidence: 2 } })
    expect(bad.status).toBe(400)

    // Disagreeing OCR engines score ≤ 0.5, so thresholds at or below that are refused.
    const tooLow = await request(app)
      .patch('/api/mg-floor/scales/MG-SCALE-GJ-TEST')
      .set(mgHeaders(user))
      .send({ cameraOcr: { minConfidence: 0.5 } })
    expect(tooLow.status).toBe(400)

    const ok = await request(app)
      .patch('/api/mg-floor/scales/MG-SCALE-GJ-TEST')
      .set(mgHeaders(user))
      .send({ cameraOcr: { minConfidence: 0.95, consecutiveFrames: 6, overCapacityPolicy: 'review' } })
    expect(ok.status).toBe(200)
    expect(ok.body.scale.cameraOcr.minConfidence).toBe(0.95)
    expect(ok.body.scale.cameraOcr.consecutiveFrames).toBe(6)
    expect(ok.body.scale.cameraOcr.overCapacityPolicy).toBe('REVIEW')
    expect(ok.body.scale.cameraOcr.stableDurationMs).toBe(1500)
    expect(ok.body.scale.cameraOcr.segmentThreshold).toBe(0.3)
  })

  test('decoder tuning settings are bounded and persisted', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user)
    const patch = (cameraOcr) => request(app)
      .patch('/api/mg-floor/scales/MG-SCALE-GJ-TEST')
      .set(mgHeaders(user))
      .send({ cameraOcr })

    expect((await patch({ segmentThreshold: 0.1 })).status).toBe(400)
    expect((await patch({ guideBoxAspect: 7 })).status).toBe(400)
    expect((await patch({ guideBoxWidth: 0.95 })).status).toBe(400)

    const ok = await patch({ segmentThreshold: 0.35, guideBoxAspect: 4, guideBoxWidth: 0.8 })
    expect(ok.status).toBe(200)
    expect(ok.body.scale.cameraOcr).toMatchObject({
      segmentThreshold: 0.35,
      guideBoxAspect: 4,
      guideBoxWidth: 0.8,
      minConfidence: 0.9,
    })
  })
})

describe('MG Floor scale camera captures', () => {
  test('valid capture is created once; replay is idempotent; conflicting reuse is rejected', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user)
    const body = cameraCapture()

    const first = await request(app).post('/api/mg-floor/scale-camera-captures').set(mgHeaders(user)).send(body)
    expect(first.status).toBe(201)
    expect(first.body.capture.captureMethod).toBe('CAMERA_OCR')
    expect(first.body.capture.weight).toBe(1250.35)
    expect(first.body.capture.scaleModel).toBe('GJ-2000')
    expect(first.body.capture.deviceId).toBe('MG-FLOOR-TABLET-001')
    expect(first.body.capture.status).toBe('CONFIRMED')

    const replay = await request(app).post('/api/mg-floor/scale-camera-captures').set(mgHeaders(user)).send(body)
    expect(replay.status).toBe(200)
    expect(replay.body.reused).toBe(true)

    const conflict = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(user))
      .send({ ...body, weight: 999.99 })
    expect(conflict.status).toBe(409)
  })

  test.each([100.0, 500.0, 999.99, 1250.35, 1500.25, 2200.0])('accepts %p g', async (weight) => {
    const user = await createTenantUser('mg')
    await createCameraScale(user)
    const res = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(user))
      .send(cameraCapture({ weight }))
    expect(res.status).toBe(201)
  })

  test('rejects low confidence, unstable, off-resolution and out-of-range readings', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user)
    const post = (overrides) => request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(user))
      .send(cameraCapture(overrides))

    const low = await post({ ocrConfidence: 0.5 })
    expect(low.status).toBe(400)
    expect(low.body.code).toBe('LOW_OCR_CONFIDENCE')

    expect((await post({ stable: false })).status).toBe(400)
    expect((await post({ weight: 1250.355 })).status).toBe(400)

    const over = await post({ weight: 2200.01 })
    expect(over.status).toBe(400)
    expect(over.body.code).toBe('WEIGHT_OUT_OF_RANGE')
    expect((await post({ weight: 2500 })).status).toBe(400)
    expect((await post({ unit: 'ct' })).status).toBe(400)
  })

  test('REVIEW policy needs acknowledgement just over capacity and still rejects impossible values', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user, { cameraOcr: { overCapacityPolicy: 'REVIEW' } })
    const post = (overrides) => request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(user))
      .send(cameraCapture(overrides))

    const needsReview = await post({ weight: 2200.01 })
    expect(needsReview.status).toBe(400)
    expect(needsReview.body.code).toBe('WEIGHT_REVIEW_REQUIRED')

    const acknowledged = await post({ weight: 2200.01, reviewAcknowledged: true })
    expect(acknowledged.status).toBe(201)
    expect(acknowledged.body.capture.overCapacityReview).toBe(true)

    expect((await post({ weight: 2500, reviewAcknowledged: true })).status).toBe(400)
  })

  test('scale without CAMERA_OCR rejects camera captures', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user, { captureMethods: ['DIGITAL_RS232'], gatewayId: 'MG-GATEWAY-001' })
    const res = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(user))
      .send(cameraCapture())
    expect(res.status).toBe(403)
  })

  test('operator from another department cannot capture on an assigned scale', async () => {
    const admin = await createTenantUser('mg')
    await createCameraScale(admin)
    const operator = await createTenantUser('mg', {
      role: 'department_user',
      department: 'production',
      productionRole: 'operator',
    })
    const res = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(operator))
      .send(cameraCapture())
    expect(res.status).toBe(403)
  })

  test('manual entry requires adjustWeight permission and a reason', async () => {
    const admin = await createTenantUser('mg')
    await createCameraScale(admin, { department: '' })
    const operator = await createTenantUser('mg', {
      role: 'department_user',
      department: 'production',
      productionRole: 'operator',
    })
    const manual = (user, overrides = {}) => request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(user))
      .send({
        captureId: newCaptureId(),
        scaleId: 'MG-SCALE-GJ-TEST',
        weight: 812.4,
        captureMethod: 'MANUAL',
        manualReason: 'Display glare — OCR failed repeatedly',
        hasPhoto: false,
        ...overrides,
      })

    expect((await manual(operator)).status).toBe(403)
    expect((await manual(admin, { manualReason: '' })).status).toBe(400)
    const ok = await manual(admin)
    expect(ok.status).toBe(201)
    expect(ok.body.capture.captureMethod).toBe('MANUAL')
    expect(ok.body.capture.manualReason).toMatch(/glare/)
    expect(ok.body.capture.photo.status).toBe('NONE')
  })

  test('other tenants cannot create or read MG captures', async () => {
    const mgUser = await createTenantUser('mg')
    await createCameraScale(mgUser)
    const body = cameraCapture()
    await request(app).post('/api/mg-floor/scale-camera-captures').set(mgHeaders(mgUser)).send(body)

    const cgUser = await createTenantUser('cg')
    const cgHeaders = { Host: HOST, 'x-tenant': 'cg', Authorization: `Bearer ${tokenFor(cgUser, 'cg')}` }
    const create = await request(app).post('/api/mg-floor/scale-camera-captures').set(cgHeaders).send(cameraCapture())
    expect(create.status).toBe(403)
    const read = await request(app).get(`/api/mg-floor/scale-camera-captures/${body.captureId}`).set(cgHeaders)
    expect(read.status).toBe(403)
  })

  test('photo upload is stored once and can be viewed', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user)
    const body = cameraCapture()
    await request(app).post('/api/mg-floor/scale-camera-captures').set(mgHeaders(user)).send(body)

    const upload = await request(app)
      .post(`/api/mg-floor/scale-camera-captures/${body.captureId}/photo`)
      .set(mgHeaders(user))
      .attach('photo', TINY_JPEG, { filename: 'scale.jpg', contentType: 'image/jpeg' })
    expect(upload.status).toBe(201)
    expect(upload.body.photo.status).toBe('UPLOADED')

    const again = await request(app)
      .post(`/api/mg-floor/scale-camera-captures/${body.captureId}/photo`)
      .set(mgHeaders(user))
      .attach('photo', TINY_JPEG, { filename: 'scale.jpg', contentType: 'image/jpeg' })
    expect(again.status).toBe(200)
    expect(again.body.reused).toBe(true)

    const notJpeg = await request(app)
      .post(`/api/mg-floor/scale-camera-captures/${body.captureId}/photo`)
      .set(mgHeaders(user))
      .attach('photo', Buffer.from('hello'), { filename: 'x.txt', contentType: 'text/plain' })
    expect(notJpeg.status).toBe(400)

    const photo = await request(app)
      .get(`/api/mg-floor/scale-camera-captures/${body.captureId}/photo`)
      .set(mgHeaders(user))
      .buffer(true)
      .parse((res, cb) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => cb(null, Buffer.concat(chunks)))
      })
    expect(photo.status).toBe(200)
    expect(Buffer.compare(photo.body, TINY_JPEG)).toBe(0)
  })
})

describe('MG Floor Metal OUT / IN with a camera capture', () => {
  async function setupBatch(user) {
    const InventoryItem = await require('../models/InventoryItem').getTenantModel('mg')
    const item = await InventoryItem.create({
      name: 'Gold 22K Bar',
      type: 'raw_material',
      quantity: 10000,
      unit: 'g',
      weight: 10000,
    })
    const created = await request(app)
      .post('/api/erp/production-control/batches')
      .set(mgHeaders(user))
      .send({
        metalType: 'Gold',
        purity: '22K',
        initialWeight: 3000,
        purpose: 'Camera capture test',
        inventoryItemId: String(item._id),
        idempotencyKey: `cam-batch-${Date.now()}`,
      })
    expect(created.status).toBe(201)
    const batchId = created.body.batch._id
    const issued = await request(app)
      .post(`/api/erp/production-control/batches/${batchId}/issue-from-vault`)
      .set(mgHeaders(user))
      .send({ inventoryItemId: String(item._id), weight: 3000 })
    expect(issued.status).toBe(200)
    return { batchId, fromDepartment: issued.body.batch.currentDepartment || 'vault' }
  }

  test('metal out then metal in use confirmed captures; a capture cannot be reused', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user, { department: '' })
    const { batchId, fromDepartment } = await setupBatch(user)

    const outCapture = cameraCapture({ weight: 1250.35, batchId })
    expect((await request(app).post('/api/mg-floor/scale-camera-captures').set(mgHeaders(user)).send(outCapture)).status).toBe(201)

    const out = await request(app)
      .post('/api/mg-floor/metal/out')
      .set(mgHeaders(user))
      .send({
        batchId,
        fromDepartment,
        toDepartment: 'melting',
        scaleId: 'MG-SCALE-GJ-TEST',
        weightCaptureId: outCapture.captureId,
        weight: 1250.35,
        operationId: `op_out_${Date.now()}`,
        deviceId: 'MG-FLOOR-TABLET-001',
      })
    expect(out.status).toBe(201)
    expect(out.body.weight).toBe(1250.35)
    expect(out.body.scale.weightCaptureId).toBe(outCapture.captureId)
    expect(out.body.scale.captureMethod).toBe('CAMERA_OCR')
    const passId = out.body.pass._id

    const ProductionPass = await require('../models/ProductionPass').getTenantModel('mg')
    const storedPass = await ProductionPass.findById(passId).lean()
    expect(storedPass.issueWeightCapture.method).toBe('CAMERA_OCR')
    expect(storedPass.issueWeightCapture.weightCaptureId).toBe(outCapture.captureId)

    const reuse = await request(app)
      .post('/api/mg-floor/metal/out')
      .set(mgHeaders(user))
      .send({
        batchId,
        fromDepartment,
        toDepartment: 'melting',
        scaleId: 'MG-SCALE-GJ-TEST',
        weightCaptureId: outCapture.captureId,
        weight: 1250.35,
        operationId: `op_out_other_${Date.now()}`,
      })
    expect(reuse.status).toBe(409)

    const inCapture = cameraCapture({ weight: 1250.35, passId })
    const inOpId = `op_in_${Date.now()}`
    // Offline path: capture + Metal IN arrive together through /sync, capture first.
    const sync = await request(app)
      .post('/api/mg-floor/sync')
      .set(mgHeaders(user))
      .send({
        operations: [
          { operationId: `wc_${inCapture.captureId}`, operationType: 'weight_capture', payload: inCapture },
          {
            operationId: inOpId,
            operationType: 'metal_in',
            payload: {
              passId,
              scaleId: 'MG-SCALE-GJ-TEST',
              weightCaptureId: inCapture.captureId,
              receivedWeight: 1250.35,
            },
          },
        ],
      })
    expect(sync.status).toBe(200)
    expect(sync.body.results.map((r) => r.syncStatus)).toEqual(['SYNCED', 'SYNCED'])

    const received = await ProductionPass.findById(passId).lean()
    expect(received.status).toMatch(/RECEIVED|COMPLETED/)
    expect(received.receiveWeightCapture.weightCaptureId).toBe(inCapture.captureId)

    const FloorWeightCapture = await require('../models/FloorWeightCapture').getTenantModel('mg')
    const consumed = await FloorWeightCapture.findOne({ captureId: inCapture.captureId }).lean()
    expect(consumed.status).toBe('CONSUMED')
    expect(String(consumed.consumedBy.passId)).toBe(String(passId))
  })

  test('failed metal IN releases the capture so it can be used again', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user, { department: '' })
    const capture = cameraCapture()
    await request(app).post('/api/mg-floor/scale-camera-captures').set(mgHeaders(user)).send(capture)

    const bad = await request(app)
      .post('/api/mg-floor/metal/in')
      .set(mgHeaders(user))
      .send({
        passId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        scaleId: 'MG-SCALE-GJ-TEST',
        weightCaptureId: capture.captureId,
        receivedWeight: 1250.35,
        operationId: `op_bad_${Date.now()}`,
      })
    expect(bad.status).toBe(404)

    const FloorWeightCapture = await require('../models/FloorWeightCapture').getTenantModel('mg')
    const row = await FloorWeightCapture.findOne({ captureId: capture.captureId }).lean()
    expect(row.status).toBe('CONFIRMED')
  })

  test('mismatched weight against the capture is rejected', async () => {
    const user = await createTenantUser('mg')
    await createCameraScale(user, { department: '' })
    const capture = cameraCapture()
    await request(app).post('/api/mg-floor/scale-camera-captures').set(mgHeaders(user)).send(capture)
    const res = await request(app)
      .post('/api/mg-floor/metal/in')
      .set(mgHeaders(user))
      .send({
        passId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        scaleId: 'MG-SCALE-GJ-TEST',
        weightCaptureId: capture.captureId,
        receivedWeight: 1300,
        operationId: `op_mismatch_${Date.now()}`,
      })
    expect(res.status).toBe(400)
  })
})

describe('MG Floor built-in camera scale (MG-CAMERA)', () => {
  const defaultCapture = (overrides = {}) => cameraCapture({ scaleId: 'MG-CAMERA', ...overrides })
  const operatorUser = () => createTenantUser('mg', {
    role: 'department_user',
    department: 'production',
    productionRole: 'operator',
  })

  test('first camera capture creates the camera-only scale; later captures reuse it', async () => {
    const operator = await operatorUser()
    const first = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(operator))
      .send(defaultCapture())
    expect(first.status).toBe(201)
    expect(first.body.capture.scaleId).toBe('MG-CAMERA')

    const ScaleMg = await require('../models/Scale').getTenantModel('mg')
    const scale = await ScaleMg.findOne({ scaleId: 'MG-CAMERA' }).lean()
    expect(scale.connectionType).toBe('CAMERA')
    expect(scale.captureMethods).toEqual(['CAMERA_OCR'])
    expect(scale.gatewayId).toBe('')
    expect(scale.baudRate).toBeNull()
    expect(scale.capacity).toBe(2200)
    expect(scale.resolution).toBe(0.01)
    expect(scale.department).toBe('')

    const second = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(operator))
      .send(defaultCapture({ weight: 640.12, ocrRawText: '640.12' }))
    expect(second.status).toBe(201)
    expect(await ScaleMg.countDocuments({ scaleId: 'MG-CAMERA' })).toBe(1)
  })

  test('existing safety checks still apply to the built-in scale', async () => {
    const operator = await operatorUser()
    const post = (body) => request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(operator))
      .send(body)
    expect((await post(defaultCapture({ stable: false }))).status).toBe(400)
    expect((await post(defaultCapture({ ocrConfidence: 0.3 }))).status).toBe(400)
    expect((await post(defaultCapture({ weight: 5000, ocrRawText: '5000.00' }))).status).toBe(400)
  })

  test('manual entry never provisions the built-in scale', async () => {
    const admin = await createTenantUser('mg')
    const res = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(admin))
      .send({
        captureId: newCaptureId(),
        scaleId: 'MG-CAMERA',
        weight: 812.4,
        captureMethod: 'MANUAL',
        manualReason: 'Display glare — OCR failed repeatedly',
        hasPhoto: false,
      })
    expect(res.status).toBe(404)
    const ScaleMg = await require('../models/Scale').getTenantModel('mg')
    expect(await ScaleMg.exists({ scaleId: 'MG-CAMERA' })).toBeNull()
  })

  test('a manager archiving the built-in scale is respected (not recreated)', async () => {
    const admin = await createTenantUser('mg')
    const operator = await operatorUser()
    const first = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(operator))
      .send(defaultCapture())
    expect(first.status).toBe(201)

    const archived = await request(app)
      .post('/api/mg-floor/scales/MG-CAMERA/archive')
      .set(mgHeaders(admin))
      .send({ reason: 'Tablet camera retired' })
    expect(archived.status).toBe(200)

    const after = await request(app)
      .post('/api/mg-floor/scale-camera-captures')
      .set(mgHeaders(operator))
      .send(defaultCapture())
    expect(after.status).toBe(404)
  })
})
