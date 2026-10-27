const mongoose = require('mongoose');

const placementPolicySchema = new mongoose.Schema(
  {
    batch: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      default: '2023-2027',
    },
    // Multiplier for placed students: e.g. 2 means next job must offer >= 2x current CTC
    ctcMultiplier: {
      type: Number,
      default: 2,
    },
    // Minimum absolute CTC increase required (in LPA)
    minCtcIncreaseLpa: {
      type: Number,
      default: 3,
    },
    // Dream company tier threshold (e.g. 10 LPA and above can apply regardless)
    dreamTierThresholdLpa: {
      type: Number,
      default: 10,
    },
    allowDreamUpgrade: {
      type: Boolean,
      default: true,
    },
    maxOffersAllowed: {
      type: Number,
      default: 2,
    },
    policyDescription: {
      type: String,
      default: 'Placed students can only apply for dream company drives offering at least 2x their current placed CTC or >= 10 LPA.',
    },
    isConfigured: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PlacementPolicy', placementPolicySchema);
