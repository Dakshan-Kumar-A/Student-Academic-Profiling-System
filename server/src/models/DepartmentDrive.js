const mongoose = require('mongoose');

const customFieldSchema = new mongoose.Schema({
  fieldLabel: { type: String, required: true, trim: true },
  fieldType: { type: String, enum: ['text', 'number', 'link', 'textarea'], default: 'text' },
  isRequired: { type: Boolean, default: false },
});

const jobRoleSchema = new mongoose.Schema({
  roleName: { type: String, required: true, trim: true },
  ctc: { type: String, required: true, trim: true }, // e.g. "7 LPA"
  minCGPA: { type: Number, required: true, default: 0 },
  // Separate Entities: Standing Arrears vs History Arrears
  standingArrearsAllowed: { type: Boolean, default: false },
  maxStandingArrears: { type: Number, default: 0 },
  historyArrearsAllowed: { type: Boolean, default: false },
  maxHistoryArrears: { type: Number, default: 0 },
  // Backward compatibility fallback
  arrearsAllowed: { type: Boolean, default: false },
  maxArrearsAllowed: { type: Number, default: 0 },
  roleDescription: { type: String, default: '' },
  roleDuties: { type: String, default: '' },
  roleRequirements: { type: String, default: '' },
  otherDetails: { type: String, default: '' },
  fileAttachment: { type: String, default: '' },
});

const optInRecordSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rollNumber: { type: String, default: '' },
  studentName: { type: String, default: '' },
  email: { type: String, default: '' },
  department: { type: String, default: '' },
  section: { type: String, default: 'A' },
  currentCGPA: { type: Number, default: 0 },
  standingArrearsCount: { type: Number, default: 0 },
  historyArrearsCount: { type: Number, default: 0 },
  clearedArrearsCount: { type: Number, default: 0 },
  selectedRoles: { type: [String], default: [] },
  customFormResponses: { type: Map, of: String, default: {} },
  status: { type: String, enum: ['Opted-In', 'Opted-Out'], default: 'Opted-In' },
  optedAt: { type: Date, default: Date.now },
});

const roundItemSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true },
  roundName: { type: String, required: true, trim: true },
});

const studentRoundProgressSchema = new mongoose.Schema({
  roundNumber: { type: Number, required: true },
  roundName: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Passed', 'Failed', 'Absent', '-'],
    default: 'Failed', // Default status per student per round is Failed until updated
  },
  remarks: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

const roundEvaluationSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rollNumber: { type: String, default: '' },
  studentName: { type: String, default: '' },
  department: { type: String, default: '' },
  rounds: [studentRoundProgressSchema],
  finalStatus: {
    type: String,
    enum: ['Not Placed', 'Placed', 'In Progress'],
    default: 'Not Placed',
  },
  placedRole: { type: String, default: '' },
  placedCTC: { type: String, default: '' },
  absentCount: { type: Number, default: 0 },
});

const departmentDriveSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    jobLocation: {
      type: String,
      required: [true, 'Job location is required'],
      trim: true,
    },
    companyDescription: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      required: true,
      index: true,
    },
    // Scope: 'department' (Coordinator drive) or 'college_wide' (Placement Officer drive)
    driveScope: {
      type: String,
      enum: ['department', 'college_wide'],
      default: 'department',
      index: true,
    },
    // Offer Type configuration
    offerType: {
      type: String,
      enum: ['Full Time', 'Intern', 'Intern + Full Time', 'Intern + Conversion Based on Performance'],
      default: 'Full Time',
    },
    internshipDurationMonths: {
      type: Number,
      default: 0,
    },
    stipend: {
      type: String,
      default: '', // e.g. "₹25,000 / month"
    },
    eligibleDepartments: {
      type: [String],
      default: [], // e.g. ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS']
    },
    minCGPA: {
      type: Number,
      default: 0,
    },
    standingArrearsAllowed: {
      type: Boolean,
      default: false,
    },
    maxStandingArrears: {
      type: Number,
      default: 0,
    },
    historyArrearsAllowed: {
      type: Boolean,
      default: false,
    },
    maxHistoryArrears: {
      type: Number,
      default: 0,
    },
    // Rounds defined for the drive
    rounds: {
      type: [roundItemSchema],
      default: [
        { roundNumber: 1, roundName: 'Aptitude Assessment' },
        { roundNumber: 2, roundName: 'Coding Assessment' },
        { roundNumber: 3, roundName: 'Technical Interview' },
        { roundNumber: 4, roundName: 'HR Interview' },
      ],
    },
    // Student round-level evaluations
    roundEvaluations: [roundEvaluationSchema],
    // Special Flag: Hidden from placement officers, visible only to dept coordinator, mentors, and students
    isDepartmentSpecific: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Limit to allow students to choose that many roles before opting-in
    maxRoleChoicesAllowed: {
      type: Number,
      required: true,
      default: 1,
    },
    // Time limit after which students cannot opt-in
    optInDeadline: {
      type: Date,
      required: [true, 'Opt-in deadline is required'],
    },
    // Dynamic custom fields defined by coordinator / placement officer
    customFormFields: [customFieldSchema],
    // Distinct job roles for this drive
    roles: [jobRoleSchema],
    // Student opt-in and opt-out submissions
    optIns: [optInRecordSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Archived'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

// Backward-compatible virtuals for existing code
departmentDriveSchema.virtual('location').get(function () {
  return this.jobLocation;
});
departmentDriveSchema.virtual('aboutCompany').get(function () {
  return this.companyDescription;
});

module.exports = mongoose.model('DepartmentDrive', departmentDriveSchema);
