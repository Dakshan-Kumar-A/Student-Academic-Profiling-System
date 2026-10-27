const mongoose = require('mongoose');

const ticketReplySchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  content: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

const ticketSchema = new mongoose.Schema(
  {
    ticketNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    raisedBy: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: { type: String, required: true },
      email: { type: String, required: true },
      role: { type: String, required: true },
      department: { type: String, default: '' },
    },
    ticketType: {
      type: String,
      enum: ['problem_fix', 'feature_modification'],
      required: true,
      index: true,
      // problem_fix: all users
      // feature_modification: only placement_officer, department_coordinator, admin
    },
    category: {
      type: String,
      enum: ['UI/UX', 'Performance', 'Authentication', 'Analytics/Dashboard', 'Communication', 'Drive Management', 'Profile/Data', 'Other'],
      default: 'Other',
    },
    subject: {
      type: String,
      required: [true, 'Ticket subject is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Ticket description is required'],
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open',
      index: true,
    },
    adminNotes: {
      type: String,
      default: '',
    },
    replies: [ticketReplySchema],
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate human-friendly sequential ticket number if not provided
ticketSchema.pre('validate', async function (next) {
  if (!this.ticketNumber) {
    const count = await mongoose.model('Ticket').countDocuments();
    const prefix = this.ticketType === 'feature_modification' ? 'FMR' : 'FIX';
    this.ticketNumber = `${prefix}-${1000 + count + 1}`;
  }
  next();
});

module.exports = mongoose.model('Ticket', ticketSchema);
