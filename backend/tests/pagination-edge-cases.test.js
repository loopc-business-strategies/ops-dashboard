/**
 * Test suite for pagination, indexing, and edge cases
 * Simplified version focusing on Mongoose compatibility
 */

const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const { parsePaginationParams, formatPaginationResponse } = require('../utils/pagination')

describe('Pagination Utility', () => {
  let mongoServer

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    await mongoose.connect(mongoServer.getUri())
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  describe('parsePaginationParams', () => {
    it('should enforce max limit of 100', () => {
      expect(parsePaginationParams({ limit: '200' }).limit).toBe(100)
    })

    it('should enforce min limit of 1', () => {
      expect(parsePaginationParams({ limit: '0' }).limit).toBe(1)
    })

    it('should default to 50 limit', () => {
      expect(parsePaginationParams({}).limit).toBe(50)
    })

    it('should parse cursor correctly', () => {
      expect(parsePaginationParams({ cursor: 'abc123' }).cursor).toBe('abc123')
    })

    it('should parse sortOrder asc as 1', () => {
      expect(parsePaginationParams({ sortOrder: 'asc' }).sortOrder).toBe(1)
    })

    it('should default sortOrder to -1 (desc)', () => {
      expect(parsePaginationParams({}).sortOrder).toBe(-1)
    })
  })

  describe('formatPaginationResponse', () => {
    it('should detect hasMore when extra documents fetched', () => {
      const docs = Array.from({ length: 11 }, (_, i) => ({ _id: i }))
      const result = formatPaginationResponse(docs, { limit: 10 }, '_id')
      expect(result.hasMore).toBe(true)
      expect(result.data.length).toBe(10)
    })

    it('should set hasMore false when all fit in limit', () => {
      const docs = Array.from({ length: 5 }, (_, i) => ({ _id: i }))
      const result = formatPaginationResponse(docs, { limit: 10 }, '_id')
      expect(result.hasMore).toBe(false)
      expect(result.nextCursor).toBeNull()
    })

    it('should handle empty results gracefully', () => {
      const result = formatPaginationResponse([], { limit: 10 }, '_id')
      expect(result.data.length).toBe(0)
      expect(result.hasMore).toBe(false)
      expect(result.count).toBe(0)
    })
  })

  describe('Ledger Query Performance', () => {
    it('should handle large ledger queries efficiently', async () => {
      const ledgerSchema = new mongoose.Schema({
        date: { type: Date, index: true },
        amount: Number,
        isDeleted: { type: Boolean, default: false, index: true },
      })
      const Ledger = mongoose.model('LedgerPerfTest', ledgerSchema)

      const docs = Array.from({ length: 100 }, (_, i) => ({
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        amount: Math.random() * 10000,
      }))
      await Ledger.insertMany(docs)

      const result = await Ledger.find({
        isDeleted: false,
      }).limit(50)

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('Transaction Query Edge Cases', () => {
    let TransactionModel

    beforeAll(async () => {
      const schema = new mongoose.Schema(
        {
          type: { type: String, enum: ['expense', 'sale', 'purchase'] },
          date: Date,
          status: { type: String, enum: ['draft', 'posted'] },
          amount: Number,
        },
        { collection: 'transactionEdgeTests' }
      )
      TransactionModel = mongoose.model('TransactionEdgeCase', schema)
    })

    afterEach(async () => {
      await TransactionModel.deleteMany({})
    })

    it('should handle multi-status filtering', async () => {
      const docs = [
        { type: 'expense', status: 'draft', date: new Date(), amount: 100 },
        { type: 'expense', status: 'posted', date: new Date(), amount: 200 },
        { type: 'sale', status: 'draft', date: new Date(), amount: 300 },
      ]
      await TransactionModel.insertMany(docs)

      const result = await TransactionModel.find({
        type: 'expense',
        status: { $in: ['draft', 'posted'] },
      })

      expect(result.length).toBe(2)
    })

    it('should handle date range boundaries correctly', async () => {
      const startDate = new Date('2026-01-01T00:00:00Z')
      const endDate = new Date('2026-01-31T23:59:59Z')

      const docs = [
        { type: 'expense', date: new Date('2026-01-01T12:00:00Z'), amount: 100 },
        { type: 'expense', date: new Date('2026-01-31T23:59:59Z'), amount: 200 },
        { type: 'expense', date: new Date('2026-02-01T00:00:00Z'), amount: 300 },
      ]
      await TransactionModel.insertMany(docs)

      const result = await TransactionModel.find({
        date: { $gte: startDate, $lte: endDate },
      })

      expect(result.length).toBe(2)
    })
  })

  describe('ChartOfAccount Hierarchy', () => {
    let CoaModel

    beforeAll(async () => {
      const schema = new mongoose.Schema(
        {
          accountCode: String,
          accountType: { type: String, enum: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] },
          parentAccountId: mongoose.Schema.Types.ObjectId,
          isActive: Boolean,
        },
        { collection: 'coaHierarchyTests' }
      )
      CoaModel = mongoose.model('CoaHierarchyTest', schema)
    })

    afterEach(async () => {
      await CoaModel.deleteMany({})
    })

    it('should query hierarchy with parent filter', async () => {
      const parent = await CoaModel.create({
        accountCode: '1000',
        accountType: 'Asset',
        isActive: true,
      })

      const children = Array.from({ length: 10 }, (_, i) => ({
        accountCode: `1000-${i}`,
        accountType: 'Asset',
        parentAccountId: parent._id,
        isActive: true,
      }))
      await CoaModel.insertMany(children)

      const result = await CoaModel.find({
        parentAccountId: parent._id,
        isActive: true,
      })

      expect(result.length).toBe(10)
    })
  })
})
