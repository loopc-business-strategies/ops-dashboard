const fs = require('fs')
const os = require('os')
const path = require('path')
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
const Message = require('../models/Message')
const ChatGroup = require('../models/ChatGroup')

jest.setTimeout(120000)

let mongo
let app
let uploadDir

const TEST_TENANT = 'loopc'
const tokenFor = (user) => jwt.sign({ id: user._id.toString(), company: TEST_TENANT }, process.env.JWT_SECRET)

const createUser = async (overrides = {}) => {
  const now = Date.now().toString(36)
  return User.create({
    name: `user-${now}`,
    email: `user-${now}@example.com`,
    password: 'password123',
    role: 'department_user',
    department: 'operations',
    ...overrides,
  })
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret'
  process.env.RATE_LIMIT_MAX = '100000'
  process.env.AUTH_RATE_LIMIT_MAX = '100000'
  process.env.DEFAULT_TENANT = TEST_TENANT
  uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-upload-'))
  process.env.CHAT_UPLOAD_DIR = uploadDir

  mongo = await startMongoMemoryServer()
  const mongoUri = mongo.getUri()
  process.env.MONGO_URI = mongoUri
  process.env.MONGO_URI_LOOPC = mongoUri
  await mongoose.connect(mongoUri)
  app = createApp()
})

afterEach(async () => {
  if (!isMongooseConnected(mongoose)) return
  await Promise.all([
    User.deleteMany({}),
    Message.deleteMany({}),
    ChatGroup.deleteMany({}),
  ])
  fs.readdirSync(uploadDir).forEach((file) => {
    fs.unlinkSync(path.join(uploadDir, file))
  })
})

afterAll(async () => {
  await disconnectMongooseIfConnected(mongoose)
  if (mongo) await mongo.stop()
  if (uploadDir && fs.existsSync(uploadDir)) fs.rmSync(uploadDir, { recursive: true, force: true })
})

describe('chat messages API', () => {
  test('department head can create a group and post a message to it', async () => {
    const head = await createUser({ role: 'department_head', department: 'operations', name: 'Ops Head' })
    const member = await createUser({ name: 'Ops Member' })

    const groupRes = await request(app)
      .post('/api/messages/groups')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .send({
        name: 'Ops Updates',
        department: 'operations',
        memberIds: [member._id.toString()],
      })

    expect(groupRes.status).toBe(201)
    expect(groupRes.body.success).toBe(true)
    expect(groupRes.body.group.name).toBe('Ops Updates')

    const messageRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .send({
        type: 'group',
        groupId: groupRes.body.group._id,
        text: 'Shift handover complete',
      })

    expect(messageRes.status).toBe(201)
    expect(messageRes.body.message.text).toBe('Shift handover complete')
    expect(String(messageRes.body.message.groupId)).toBe(String(groupRes.body.group._id))
  })

  test('regular user cannot create groups', async () => {
    const user = await createUser()
    const res = await request(app)
      .post('/api/messages/groups')
      .set('Authorization', `Bearer ${tokenFor(user)}`)
      .send({ name: 'Blocked Group' })

    expect(res.status).toBe(403)
  })

  test('multipart upload creates attachment-only message', async () => {
    const admin = await createUser({ role: 'super_admin', name: 'Chat Admin' })
    const buffer = Buffer.from('%PDF-1.4 test attachment')

    const res = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)
      .field('type', 'group')
      .field('room', 'General')
      .attach('file', buffer, { filename: 'note.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(201)
    expect(res.body.message.attachments).toHaveLength(1)
    expect(res.body.message.attachments[0].originalName).toBe('note.pdf')

    const fileName = res.body.message.attachments[0].fileName
    const download = await request(app)
      .get(`/api/messages/attachments/${fileName}`)
      .set('Authorization', `Bearer ${tokenFor(admin)}`)

    expect(download.status).toBe(200)
    expect(download.headers['content-type']).toMatch(/pdf/)
  })

  test('user not in chat group does not see group messages in /latest', async () => {
    const head = await createUser({ role: 'department_head', department: 'operations', name: 'Head' })
    const member = await createUser({ name: 'Member' })
    const outsider = await createUser({ name: 'Outsider' })

    const groupRes = await request(app)
      .post('/api/messages/groups')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .send({
        name: 'Private Ops',
        department: 'operations',
        memberIds: [member._id.toString()],
      })

    expect(groupRes.status).toBe(201)
    const gid = groupRes.body.group._id

    const postRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .send({
        type: 'group',
        groupId: gid,
        text: 'Members-only note',
      })
    expect(postRes.status).toBe(201)

    const memberLatest = await request(app)
      .get('/api/messages/latest?limit=50')
      .set('Authorization', `Bearer ${tokenFor(member)}`)

    expect(memberLatest.status).toBe(200)
    expect(memberLatest.body.messages.some((m) => m.text === 'Members-only note')).toBe(true)

    const outsiderLatest = await request(app)
      .get('/api/messages/latest?limit=50')
      .set('Authorization', `Bearer ${tokenFor(outsider)}`)

    expect(outsiderLatest.status).toBe(200)
    expect(outsiderLatest.body.messages.some((m) => m.text === 'Members-only note')).toBe(false)
  })

  test('super_admin not in a group does not see that group in /groups', async () => {
    const head = await createUser({ role: 'department_head', department: 'operations' })
    const member = await createUser({ name: 'OnlyMember' })

    const groupRes = await request(app)
      .post('/api/messages/groups')
      .set('Authorization', `Bearer ${tokenFor(head)}`)
      .send({
        name: 'Team Alpha',
        memberIds: [member._id.toString()],
      })
    expect(groupRes.status).toBe(201)

    const admin = await createUser({ role: 'super_admin', name: 'Solo Admin' })

    const groups = await request(app)
      .get('/api/messages/groups')
      .set('Authorization', `Bearer ${tokenFor(admin)}`)

    expect(groups.status).toBe(200)
    const names = (groups.body.groups || []).map((g) => g.name)
    expect(names).not.toContain('Team Alpha')
  })

  test('DM only visible to participants', async () => {
    const alice = await createUser({ name: 'Alice DM' })
    const bob = await createUser({ name: 'Bob DM' })
    const eve = await createUser({ name: 'Eve' })

    const dmRes = await request(app)
      .post('/api/messages')
      .set('Authorization', `Bearer ${tokenFor(alice)}`)
      .send({
        type: 'dm',
        recipientIds: [bob._id.toString()],
        text: 'Secret handshake',
      })
    expect(dmRes.status).toBe(201)

    const bobLatest = await request(app)
      .get('/api/messages/latest?limit=20&type=dm')
      .set('Authorization', `Bearer ${tokenFor(bob)}`)
    expect(bobLatest.status).toBe(200)
    expect(bobLatest.body.messages.some((m) => m.text === 'Secret handshake')).toBe(true)

    const eveLatest = await request(app)
      .get('/api/messages/latest?limit=20&type=dm')
      .set('Authorization', `Bearer ${tokenFor(eve)}`)
    expect(eveLatest.status).toBe(200)
    expect(eveLatest.body.messages.some((m) => m.text === 'Secret handshake')).toBe(false)
  })
})
