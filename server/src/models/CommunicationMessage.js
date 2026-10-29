const mongoose = require('mongoose');

const communicationMessageSchema = new mongoose.Schema({
  sender: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, required: true },
  },
  department: {
    type: String,
    required: true,
    index: true,
  },
  messageType: {
    type: String,
    enum: ['circular', 'message', 'enquiry', 'announcement', 'deletion_request', 'drive_thread'],
    default: 'message',
  },
  // Communication Channels
  channel: {
    type: String,
    enum: [
      'placement_announcements',
      'placement_queries',
      'department_channel',
      'mentorship_channel',
      'general_channel',
      'general',
      'drive_announcements',
      'drive_queries',
    ],
    default: 'general_channel',
    index: true,
  },
  driveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DepartmentDrive',
    default: null,
  },
  isReadOnly: {
    type: Boolean,
    default: false, // Drive announcements channel is read-only for students
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  priority: {
    type: String,
    enum: ['Normal', 'Important', 'Urgent'],
    default: 'Normal',
  },
  // Target Filtering & Audience Control
  targetGroup: {
    type: String,
    enum: [
      'all',
      'all_students',
      'all_mentors',
      'all_department',
      'all_mentees',
      'selected_students',
      'selected_mentors',
      'custom_selection',
      'individual',
      'direct_message',
      'admin',
    ],
    default: 'all',
  },
  targetSection: {
    type: String,
    default: 'all',
  },
  menteesOnly: {
    type: Boolean,
    default: false,
  },
  targetRole: {
    type: String,
    default: 'all',
  },
  targetDepartment: {
    type: String,
    default: 'all',
  },
  isDirectMessage: {
    type: Boolean,
    default: false,
  },
  directRecipient: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    role: { type: String, default: '' },
  },
  recipients: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      role: { type: String, default: '' },
      isRead: { type: Boolean, default: false },
      readAt: { type: Date, default: null },
    },
  ],
  replies: [
    {
      senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      senderName: { type: String, default: '' },
      senderRole: { type: String, default: '' },
      content: { type: String, required: true },
      sentAt: { type: Date, default: Date.now },
    },
  ],
}, {
  timestamps: true,
});

module.exports = mongoose.model('CommunicationMessage', communicationMessageSchema);
