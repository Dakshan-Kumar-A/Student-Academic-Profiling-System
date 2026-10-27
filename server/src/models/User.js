const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
  },
  role: {
    type: String,
    enum: ['admin', 'placement_officer', 'department_coordinator', 'mentor', 'student'],
    default: 'student',
  },
  rollNumber: {
    type: String,
    trim: true,
    default: '',
  },
  department: {
    type: String,
    trim: true,
    default: '',
  },
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  // Must the user change password on next login? (e.g. after temp password issue)
  mustChangePassword: {
    type: Boolean,
    default: false,
  },
  // Temporary single-use password metadata
  tempPassword: {
    codeHash: { type: String, default: null },
    createdAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    isUsed: { type: Boolean, default: false },
    purpose: {
      type: String,
      enum: ['account_creation', 'forgot_password', 'none'],
      default: 'none',
    },
  },
  // Account deletion request approval workflow
  deletionRequest: {
    isPending: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    requestedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['none', 'pending', 'approved', 'rejected'],
      default: 'none',
    },
    requestedToRole: {
      type: String,
      enum: ['admin', 'department_coordinator', 'none'],
      default: 'none',
    },
    responseRemarks: { type: String, default: '' },
    respondedAt: { type: Date, default: null },
  },
  lastLogin: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

// Compare hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if a temporary password is valid and not expired/used
userSchema.methods.validateTempPassword = async function (enteredTempPassword) {
  if (!this.tempPassword || !this.tempPassword.codeHash) {
    return { valid: false, reason: 'No temporary password requested or available' };
  }
  if (this.tempPassword.isUsed) {
    return { valid: false, reason: 'This temporary password has already been used' };
  }
  if (new Date() > new Date(this.tempPassword.expiresAt)) {
    return { valid: false, reason: 'Temporary password has expired (valid for 24 hours only)' };
  }
  const isMatch = await bcrypt.compare(enteredTempPassword, this.tempPassword.codeHash);
  if (!isMatch) {
    return { valid: false, reason: 'Incorrect temporary password' };
  }
  return { valid: true };
};

module.exports = mongoose.model('User', userSchema);
