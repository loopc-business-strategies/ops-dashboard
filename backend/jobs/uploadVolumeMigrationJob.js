const fs = require('fs')
const path = require('path')
const Message = require('../models/Message')
const Task = require('../models/Task')
const CrmContact = require('../models/CrmContact')
const OperationsLegalDocument = require('../models/OperationsLegalDocument')
const Ledger = require('../models/Ledger')
const Transaction = require('../models/Transaction')
const Vendor = require('../models/Vendor')
const { resolveUploadDir } = require('../services/erpAccounting/uploadMiddleware')
const { findUploadedFile, storeLocalFile } = require('../services/uploadFileStore')
const { forEachConfiguredTenantTaskDb } = require('./tenantTaskSweep')

const DEFAULT_START_DELAY_MS = 20 * 1000

const UPLOAD_FOLDER_DIR_ENV = {
  chat: 'CHAT_UPLOAD_DIR',
  'task-attachments': 'TASK_UPLOAD_DIR',
  'crm-contacts': 'CRM_CONTACT_UPLOAD_DIR',
  'operations-legal-docs': 'OPS_LEGAL_DOCUMENT_UPLOAD_DIR',
  'bank-slips': 'BANK_SLIP_UPLOAD_DIR',
  transactions: 'TRANSACTION_UPLOAD_DIR',
  'vendor-documents': 'VENDOR_DOCUMENT_UPLOAD_DIR',
}

const status = {
  state: 'idle',
  startedAt: null,
  finishedAt: null,
  error: '',
  tenants: {},
}

const isLocalStored = (entry) => String(entry?.storageDriver || 'local') !== 'gridfs'
const baseName = (value) => path.basename(String(value || '').trim())

/** Every file a tenant's records point at, grouped by upload folder. */
async function collectTenantUploadReferences() {
  const refs = Object.fromEntries(Object.keys(UPLOAD_FOLDER_DIR_ENV).map((folder) => [folder, new Map()]))
  const add = (folder, fileName, mimeType) => {
    const name = baseName(fileName)
    if (name && name !== '.' && name !== '..') refs[folder].set(name, mimeType || '')
  }

  const messages = await Message.find({ 'attachments.0': { $exists: true } }).select('attachments.fileName attachments.mimeType').lean()
  messages.forEach((m) => (m.attachments || []).forEach((a) => add('chat', a.fileName, a.mimeType)))

  const tasks = await Task.find({ 'attachments.0': { $exists: true } }).select('attachments.fileName attachments.mimeType').lean()
  tasks.forEach((t) => (t.attachments || []).forEach((a) => add('task-attachments', a.fileName, a.mimeType)))

  const contacts = await CrmContact.find({ 'kyc.documents.0': { $exists: true } }).select('kyc.documents.relativePath kyc.documents.mimeType').lean()
  contacts.forEach((c) => (c.kyc?.documents || []).forEach((d) => {
    if (String(d.relativePath || '').replace(/^\//, '').startsWith('uploads/crm-contacts/')) add('crm-contacts', d.relativePath, d.mimeType)
  }))

  const legalDocs = await OperationsLegalDocument.find({ isDeleted: { $ne: true } }).select('storedFileName mimeType').lean()
  legalDocs.forEach((d) => add('operations-legal-docs', d.storedFileName, d.mimeType))

  const slips = await Ledger.find({ attachmentUrl: /^\/uploads\/bank-slips\// }).select('attachmentUrl').lean()
  slips.forEach((l) => add('bank-slips', l.attachmentUrl, ''))

  const txs = await Transaction.find({ 'attachments.0': { $exists: true } }).select('attachments.fileName attachments.mimeType attachments.storageDriver').lean()
  txs.forEach((t) => (t.attachments || []).filter(isLocalStored).forEach((a) => add('transactions', a.fileName, a.mimeType)))

  const vendors = await Vendor.find({ 'documents.0': { $exists: true } }).select('documents.fileName documents.mimeType documents.storageDriver').lean()
  vendors.forEach((v) => (v.documents || []).filter(isLocalStored).forEach((d) => add('vendor-documents', d.fileName, d.mimeType)))

  return refs
}

async function copyTenantUploadsToDatabase(tenantKey) {
  const refs = await collectTenantUploadReferences()
  const summary = { copied: 0, copiedBytes: 0, alreadyStored: 0, missingOnDisk: 0, failed: 0 }

  for (const [folder, files] of Object.entries(refs)) {
    const dir = resolveUploadDir(UPLOAD_FOLDER_DIR_ENV[folder], folder)
    for (const [fileName, mimeType] of files) {
      try {
        if (await findUploadedFile({ folder, fileName })) {
          summary.alreadyStored += 1
          continue
        }
        const localPath = path.join(dir, fileName)
        if (!fs.existsSync(localPath)) {
          summary.missingOnDisk += 1
          continue
        }
        const { size } = fs.statSync(localPath)
        await storeLocalFile({ folder, fileName, localPath, mimeType, metadata: { migratedFromVolume: true } })
        summary.copied += 1
        summary.copiedBytes += size
      } catch (err) {
        summary.failed += 1
        console.warn(`[upload-migration] ${tenantKey} ${folder}/${fileName}: ${err.message}`)
      }
    }
  }

  status.tenants[tenantKey] = summary
  console.log(
    `[upload-migration] ${tenantKey}: copied ${summary.copied} (${(summary.copiedBytes / 1048576).toFixed(1)} MB), `
    + `already stored ${summary.alreadyStored}, missing on disk ${summary.missingOnDisk}, failed ${summary.failed}`,
  )
}

/** Copies upload files that still live only on the server disk into each tenant database. Never deletes disk files. */
async function migrateUploadVolumeOnce() {
  if (status.state === 'running') return status
  status.state = 'running'
  status.startedAt = new Date()
  status.finishedAt = null
  status.error = ''
  status.tenants = {}
  try {
    await forEachConfiguredTenantTaskDb((tenantKey) => copyTenantUploadsToDatabase(tenantKey))
    status.state = 'done'
  } catch (err) {
    status.state = 'failed'
    status.error = err.message
    console.warn('[upload-migration] failed:', err.message)
  } finally {
    status.finishedAt = new Date()
  }
  return status
}

function getUploadVolumeMigrationStatus() {
  return {
    state: status.state,
    startedAt: status.startedAt,
    finishedAt: status.finishedAt,
    error: status.error,
    tenants: { ...status.tenants },
  }
}

/** Disable with UPLOAD_VOLUME_MIGRATION=off. */
function startUploadVolumeMigrationJob() {
  if (String(process.env.UPLOAD_VOLUME_MIGRATION || '').trim().toLowerCase() === 'off') return () => {}
  const delay = Number(process.env.UPLOAD_VOLUME_MIGRATION_DELAY_MS)
  const id = setTimeout(() => {
    migrateUploadVolumeOnce().catch((e) => console.warn('[upload-migration]', e.message))
  }, Number.isFinite(delay) && delay >= 0 ? delay : DEFAULT_START_DELAY_MS)
  if (typeof id.unref === 'function') id.unref()
  return () => clearTimeout(id)
}

module.exports = {
  UPLOAD_FOLDER_DIR_ENV,
  collectTenantUploadReferences,
  migrateUploadVolumeOnce,
  getUploadVolumeMigrationStatus,
  startUploadVolumeMigrationJob,
}
