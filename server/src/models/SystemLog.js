const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'security'],
    default: 'info',
    index: true,
  },
  isError: {
    type: Boolean,
    default: false,
    index: true,
  },
  module: {
    type: String,
    enum: ['auth', 'user_management', 'system', 'excel_import', 'profile', 'admin'],
    default: 'system',
    index: true,
  },
  action: {
    type: String,
    required: true,
    index: true,
  },
  message: {
    type: String,
    required: true,
  },
  performedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: 'System' },
    email: { type: String, default: '' },
    role: { type: String, default: 'system' },
  },
  targetUser: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    role: { type: String, default: '' },
  },
  ipAddress: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  errorDetails: {
    message: { type: String, default: '' },
    stack: { type: String, default: '' },
    code: { type: String, default: '' },
  },
}, {
  timestamps: true,
});

// Compound indexes for fast admin search and filtering
systemLogSchema.index({ timestamp: -1, isError: 1 });
systemLogSchema.index({ module: 1, action: 1 });

module.exports = mongoose.model('SystemLog', systemLogSchema);
