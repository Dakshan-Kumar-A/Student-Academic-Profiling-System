const mongoose = require('mongoose');

const semesterRecordSchema = new mongoose.Schema({
  semesterNumber: { type: Number, required: true },
  sgpa: { type: Number, default: 0 },
  cgpa: { type: Number, default: 0 },
  attendancePercentage: { type: Number, default: 0 },
  arrearStatus: { type: String, enum: ['Yes', 'No'], default: 'No' },
  numberOfArrears: { type: Number, default: 0 },
  academicAchievements: { type: String, default: '' },
  strongSubjects: { type: String, default: '' },
});

const arrearRecordSchema = new mongoose.Schema({
  semesterOccurred: { type: Number, required: true },
  subjectCode: { type: String, required: true, trim: true },
  subjectName: { type: String, required: true, trim: true },
  numberOfAttempts: { type: Number, default: 1 },
  currentStatus: { type: String, enum: ['Pending', 'Cleared'], default: 'Pending' },
  clearedSemester: { type: Number, default: null },
  gradeAfterClearing: { type: String, default: '' },
  reasonForDifficulty: { type: String, default: '' },
  remedialSupportRequired: { type: String, enum: ['Yes', 'No'], default: 'No' },
});

const studentProfileSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  rollNumber: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  department: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  section: {
    type: String,
    default: 'A',
    trim: true,
  },
  batch: {
    type: String,
    default: '2023-2027',
  },
  dob: { type: Date, default: null },
  gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
  mobileNumber: { type: String, default: '' },
  personalEmail: { type: String, default: '' },
  residentialAddress: { type: String, default: '' },
  studentCategory: {
    type: String,
    enum: ['Hosteller', 'Day Scholar', ''],
    default: 'Day Scholar',
  },
  hostelName: { type: String, default: '' },
  distanceFromCollege: { type: Number, default: 0 },

  // Assigned Mentor
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },

  // Parent & Family Details (Sensitive - Excluded from plain exports)
  parentDetails: {
    fatherName: { type: String, default: '' },
    fatherOccupation: { type: String, default: '' },
    fatherIncomeRange: { type: String, default: '' }, // range e.g. "Below 2 Lakhs", "2-5 Lakhs"
    fatherMobile: { type: String, default: '' },
    motherName: { type: String, default: '' },
    motherOccupation: { type: String, default: '' },
    motherIncomeRange: { type: String, default: '' },
    motherMobile: { type: String, default: '' },
    guardianName: { type: String, default: '' },
    emergencyContact: { type: String, default: '' },
    firstGenerationGraduate: { type: String, enum: ['Yes', 'No', ''], default: 'No' },
    scholarshipReceived: { type: String, enum: ['Yes', 'No', ''], default: 'No' },
    financialGuidanceRequired: { type: String, enum: ['Yes', 'No', ''], default: 'No' },
  },

  // Semester Academic Performance
  semesters: [semesterRecordSchema],
  currentCGPA: { type: Number, default: 0, index: true },

  // Arrear History - Standing and History Arrears tracked as separate entities
  arrears: [arrearRecordSchema],
  standingArrearsCount: { type: Number, default: 0, index: true },
  historyArrearsCount: { type: Number, default: 0, index: true },
  clearedArrearsCount: { type: Number, default: 0, index: true },

  // Technical and Professional Profile
  technicalProfile: {
    programmingLanguages: { type: [String], default: [] },
    domainInterest: { type: String, default: '', index: true },
    certifications: { type: [String], default: [] },
    projects: [
      {
        title: { type: String, default: '' },
        githubLink: { type: String, default: '' },
        description: { type: String, default: '' },
      },
    ],
    hackathons: { type: [String], default: [] },
    internshipExperience: { type: String, default: '' },
    profileLinks: {
      github: { type: String, default: '' },
      linkedin: { type: String, default: '' },
      hackerRank: { type: String, default: '' },
      codechef: { type: String, default: '' },
    },
    communicationSkillLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', ''], default: 'Intermediate' },
    aptitudeSkillLevel: { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', ''], default: 'Intermediate' },
  },

  // Strengths & Improvement Analysis
  selfEvaluation: {
    academicStrengths: { type: String, default: '' },
    technicalStrengths: { type: String, default: '' },
    communicationStrengths: { type: String, default: '' },
    leadershipQualities: { type: String, default: '' },
    areasRequiringImprovement: { type: String, default: '' },
    subjectsRequiringSupport: { type: String, default: '' },
    mentorSupportExpected: { type: String, default: '' },
    shortTermGoal: { type: String, default: '' },
    longTermGoal: { type: String, default: '' },
  },

  // Career Goal (Placement, Higher Studies, Entrepreneurship)
  careerGoal: {
    primaryGoal: {
      type: String,
      enum: ['Placement', 'Higher Studies', 'Entrepreneurship', 'Undecided'],
      default: 'Undecided',
      index: true,
    },
    placement: {
      preferredRole: { type: String, default: '' },
      technicalDomain: { type: String, default: '' },
      companyType: { type: String, default: 'Product' }, // Product, Service, Core, Startup
      expectedSalaryRange: { type: String, default: '' },
      preferredLocation: { type: String, default: '' },
      targetCompanies: { type: String, default: '' },
      skillsToImprove: { type: String, default: '' },
    },
    higherStudies: {
      preferredProgramme: { type: String, default: '' },
      specialization: { type: String, default: '' },
      studyLocation: { type: String, enum: ['India', 'Abroad', ''], default: 'India', index: true },
      preferredCountry: { type: String, default: '' },
      targetInstitutions: { type: String, default: '' },
      plannedExams: { type: [String], default: [] }, // GATE, GRE, IELTS, TOEFL, CAT
      expectedAdmissionYear: { type: Number, default: null },
      guidanceRequired: { type: String, default: '' },
    },
    entrepreneurship: {
      startupIdea: { type: String, default: '' },
      problemAddressed: { type: String, default: '' },
      proposedSolution: { type: String, default: '' },
      targetCustomers: { type: String, default: '' },
      currentStage: { type: String, enum: ['Idea', 'Prototype', 'MVP', 'Revenue', ''], default: 'Idea' },
      supportRequired: { type: String, default: '' },
      expectedLaunchYear: { type: Number, default: null },
    },
  },

  // Placement Status
  placementStatus: {
    isPlaced: { type: Boolean, default: false, index: true },
    placementType: { type: String, enum: ['On-Campus', 'Off-Campus', 'None'], default: 'None', index: true },
    companyName: { type: String, default: '' },
    packageCTC: { type: Number, default: 0 }, // In Lakhs per Annum (LPA)
    jobRole: { type: String, default: '' },
    offerLetterUrl: { type: String, default: '' },
  },
}, {
  timestamps: true,
});

// Update standingArrearsCount, historyArrearsCount, clearedArrearsCount and currentCGPA whenever updated
studentProfileSchema.pre('save', function (next) {
  if (this.arrears && this.arrears.length > 0) {
    this.standingArrearsCount = this.arrears.filter(a => a.currentStatus === 'Pending').length;
    this.clearedArrearsCount = this.arrears.filter(a => a.currentStatus === 'Cleared').length;
    this.historyArrearsCount = this.arrears.length;
  } else {
    this.standingArrearsCount = 0;
    this.clearedArrearsCount = 0;
    this.historyArrearsCount = 0;
  }

  if (this.semesters && this.semesters.length > 0) {
    const latestSem = [...this.semesters].sort((a, b) => b.semesterNumber - a.semesterNumber)[0];
    this.currentCGPA = latestSem.cgpa || 0;
  }
  next();
});

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
