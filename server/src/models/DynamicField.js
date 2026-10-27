const mongoose = require('mongoose');

const dynamicFieldSchema = new mongoose.Schema(
  {
    fieldKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    fieldName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['student_profile', 'semester_academics', 'excel_export', 'placement_requirement', 'general'],
      default: 'student_profile',
      index: true,
    },
    fieldType: {
      type: String,
      enum: ['text', 'number', 'select', 'textarea', 'date', 'boolean', 'file'],
      default: 'text',
    },
    options: {
      type: [String],
      default: [],
    },
    semesterNumber: {
      type: Number,
      default: null, // e.g., 1..8 for semester SGPA slots
    },
    isRequired: {
      type: Boolean,
      default: false,
    },
    defaultValue: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('DynamicField', dynamicFieldSchema);
