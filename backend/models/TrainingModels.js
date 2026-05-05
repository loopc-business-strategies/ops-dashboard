const mongoose = require('mongoose')
const { createTenantModel } = require('../db/tenantModelProxy')

const sessionSchema = new mongoose.Schema(
  {
    title:   { type: String, trim: true },
    prog:    { type: String, trim: true },
    date:    { type: String, trim: true },
    day:     { type: Number, default: 1 },
    time:    { type: String, trim: true, default: '09:00' },
    trainer: { type: String, trim: true, default: 'TBD' },
    batch:   { type: String, trim: true },
    venue:   { type: String, trim: true },
    st:      { type: String, trim: true, default: 'Scheduled' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const batchSchema = new mongoose.Schema(
  {
    name:       { type: String, trim: true },
    prog:       { type: String, trim: true },
    start:      { type: String, trim: true },
    end:        { type: String, trim: true },
    trainer:    { type: String, trim: true, default: 'TBD' },
    trainees:   { type: Number, default: 0 },
    st:         { type: String, trim: true, default: 'Active' },
    completion: { type: Number, default: 0 },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const attendanceSchema = new mongoose.Schema(
  {
    sess:    { type: String, trim: true },
    date:    { type: String, trim: true },
    batch:   { type: String, trim: true },
    present: { type: Number, default: 0 },
    absent:  { type: Number, default: 0 },
    late:    { type: Number, default: 0 },
    total:   { type: Number, default: 0 },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const resourceSchema = new mongoose.Schema(
  {
    name:  { type: String, trim: true },
    prog:  { type: String, trim: true },
    type:  { type: String, trim: true, default: 'PDF' },
    by:    { type: String, trim: true },
    date:  { type: String, trim: true },
    views: { type: Number, default: 0 },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const assessmentSchema = new mongoose.Schema(
  {
    trainee: { type: String, trim: true },
    prog:    { type: String, trim: true },
    score:   { type: Number, default: 0 },
    pass:    { type: Boolean, default: false },
    date:    { type: String, trim: true },
    attempt: { type: Number, default: 1 },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const certSchema = new mongoose.Schema(
  {
    trainee: { type: String, trim: true },
    cert:    { type: String, trim: true },
    issued:  { type: String, trim: true, default: '—' },
    expiry:  { type: String, trim: true, default: '—' },
    st:      { type: String, trim: true, default: 'Pending' },
    doc:     { type: String, trim: true, default: '—' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const feedbackSchema = new mongoose.Schema(
  {
    trainee: { type: String, trim: true },
    prog:    { type: String, trim: true },
    rating:  { type: Number, default: 5 },
    comment: { type: String, trim: true, default: '' },
    date:    { type: String, trim: true },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

const traineeSchema = new mongoose.Schema(
  {
    name:        { type: String, trim: true },
    dept:        { type: String, trim: true },
    role:        { type: String, trim: true },
    enrolled:    { type: Number, default: 0 },
    completed:   { type: Number, default: 0 },
    avgScore:    { type: Number, default: 0 },
    certs:       { type: Number, default: 0 },
    status:      { type: String, trim: true, default: 'Active' },
    createdById: { type: mongoose.Schema.Types.ObjectId },
    createdByName: { type: String, trim: true },
  },
  { timestamps: true }
)

module.exports = {
  TrainingSession:    createTenantModel('TrainingSession',    sessionSchema),
  TrainingBatch:      createTenantModel('TrainingBatch',      batchSchema),
  TrainingAttendance: createTenantModel('TrainingAttendance', attendanceSchema),
  TrainingResource:   createTenantModel('TrainingResource',   resourceSchema),
  TrainingAssessment: createTenantModel('TrainingAssessment', assessmentSchema),
  TrainingCert:       createTenantModel('TrainingCert',       certSchema),
  TrainingFeedback:   createTenantModel('TrainingFeedback',   feedbackSchema),
  TrainingTrainee:    createTenantModel('TrainingTrainee',    traineeSchema),
}
