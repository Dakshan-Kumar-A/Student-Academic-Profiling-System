const mongoose = require('mongoose');

const unwillingnessSubmissionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  rollNumber: { type: String, required: true, trim: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  department: { type: String, required: true, index: true },
  careerGoalChoice: {
    type: String,
    enum: ['Higher Studies', 'Entrepreneurship'],
    required: true,
  },
  // Details depending on choice
  higherStudiesDetails: {
    targetDegree: { type: String, default: '' },
    specialization: { type: String, default: '' },
    countryPreference: { type: String, default: '' },
    entranceExam: { type: String, default: '' },
    expectedAdmissionYear: { type: String, default: '' },
  },
  entrepreneurshipDetails: {
    startupName: { type: String, default: '' },
    industry: { type: String, default: '' },
    currentStage: { type: String, default: 'Idea' },
    summary: { type: String, default: '' },
  },
  reasonForUnwillingness: {
    type: String,
    required: true,
  },
  signedFormAttachment: {
    type: String,
    default: '',
  },
  parentAcknowledgmentAttached: {
    type: Boolean,
    default: true,
  },
  customResponses: {
    type: Map,
    of: String,
    default: {},
  },
  isLocked: {
    type: Boolean,
    default: true, // Cannot opt back into placement once submitted
  },
  allowPlacementSwitch: {
    type: Boolean,
    default: false, // Set to true only if Placement Officer explicitly permits
  },
  permittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  permittedAt: {
    type: Date,
    default: null,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
});

const placementUnwillingnessFormSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      default: 'Placement Unwillingness Undertaking & Documentation Form',
    },
    instructions: {
      type: String,
      default: 'Mandatory undertaking for students opting for Higher Studies or Entrepreneurship instead of campus placement. Upload your signed undertaking form.',
    },
    sampleDocumentUrl: {
      type: String,
      default: '',
    },
    deadline: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    customFields: [
      {
        fieldLabel: { type: String, required: true },
        fieldType: { type: String, enum: ['text', 'number', 'link', 'textarea', 'dropdown'], default: 'text' },
        isRequired: { type: Boolean, default: false },
        options: { type: [String], default: [] },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    submissions: [unwillingnessSubmissionSchema],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PlacementUnwillingness', placementUnwillingnessFormSchema);
