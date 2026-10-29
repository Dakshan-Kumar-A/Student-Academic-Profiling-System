const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DepartmentDrive = require('../models/DepartmentDrive');
const PlacementPolicy = require('../models/PlacementPolicy');
const PlacementUnwillingness = require('../models/PlacementUnwillingness');
const CommunicationMessage = require('../models/CommunicationMessage');
const Notification = require('../models/Notification');
const { protect, authorize } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const { sendPlacementRoundEmail } = require('../utils/mailer');
const { logSystemEvent } = require('../utils/logger');

// Placement Officer and Admin access (with specific read-only allowances for Coordinators)
router.use(protect);

// Helper to check if a placed student meets post-placement criteria for a new drive
const checkPostPlacementEligibility = (studentProfile, drive, policy) => {
  if (!studentProfile.placementStatus || !studentProfile.placementStatus.isPlaced) {
    return { eligible: true };
  }

  // If already placed, check policy
  if (!policy || !policy.isConfigured) {
    return { eligible: true };
  }

  const currentCtcLpa = Number(studentProfile.placementStatus.packageCTC) || 0;

  // Extract drive CTC number
  let driveCtcLpa = 0;
  if (drive.roles && drive.roles.length > 0) {
    const ctcValues = drive.roles.map((r) => {
      const match = (r.ctc || '').match(/([0-9]+(\.[0-9]+)?)/);
      return match ? parseFloat(match[1]) : 0;
    });
    driveCtcLpa = Math.max(...ctcValues);
  }

  // Check Dream Tier exception (e.g. >= 10 LPA)
  if (policy.allowDreamUpgrade && driveCtcLpa >= (policy.dreamTierThresholdLpa || 10)) {
    return { eligible: true, reason: 'Eligible under Dream Company tier' };
  }

  // Check multiplier (e.g. 2x placed CTC)
  const requiredCtc = currentCtcLpa * (policy.ctcMultiplier || 2);
  if (driveCtcLpa >= requiredCtc) {
    return { eligible: true, reason: `Eligible: Drive CTC (${driveCtcLpa} LPA) meets ${policy.ctcMultiplier}x criteria` };
  }

  return {
    eligible: false,
    reason: `Excluded by Post-Placement Policy: Placed at ${currentCtcLpa} LPA. Requires at least ${requiredCtc} LPA or Dream Tier (>= ${policy.dreamTierThresholdLpa} LPA).`,
  };
};

// ==========================================
// 1. POST-PLACEMENT POLICY
// ==========================================

// @route   GET /api/placement/policy
// @desc    Get active post-placement policy for batch
router.get('/policy', async (req, res) => {
  try {
    const batch = req.query.batch || '2023-2027';
    let policy = await PlacementPolicy.findOne({ batch });

    if (!policy) {
      return res.status(200).json({
        success: true,
        isConfigured: false,
        message: 'Placement policy not yet configured for this batch.',
        policy: {
          batch,
          ctcMultiplier: 2,
          minCtcIncreaseLpa: 3,
          dreamTierThresholdLpa: 10,
          allowDreamUpgrade: true,
          maxOffersAllowed: 2,
          isConfigured: false,
        },
      });
    }

    return res.status(200).json({
      success: true,
      isConfigured: policy.isConfigured,
      policy,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/placement/policy
// @desc    Set or update post-placement policy
router.post('/policy', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const { batch, ctcMultiplier, minCtcIncreaseLpa, dreamTierThresholdLpa, allowDreamUpgrade, maxOffersAllowed, policyDescription } = req.body;

    const b = batch || '2023-2027';
    let policy = await PlacementPolicy.findOne({ batch: b });

    if (!policy) {
      policy = new PlacementPolicy({ batch: b });
    }

    if (ctcMultiplier !== undefined) policy.ctcMultiplier = Number(ctcMultiplier);
    if (minCtcIncreaseLpa !== undefined) policy.minCtcIncreaseLpa = Number(minCtcIncreaseLpa);
    if (dreamTierThresholdLpa !== undefined) policy.dreamTierThresholdLpa = Number(dreamTierThresholdLpa);
    if (allowDreamUpgrade !== undefined) policy.allowDreamUpgrade = Boolean(allowDreamUpgrade);
    if (maxOffersAllowed !== undefined) policy.maxOffersAllowed = Number(maxOffersAllowed);
    if (policyDescription) policy.policyDescription = policyDescription.trim();

    policy.isConfigured = true;
    policy.updatedBy = req.user._id;

    await policy.save();

    await logSystemEvent({
      level: 'info',
      module: 'placement',
      action: 'POLICY_UPDATED',
      message: `Placement Policy updated for batch ${b} by ${req.user.name}`,
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Post-placement criteria configured successfully.',
      policy,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. PLACEMENT-ONLY ANALYTICS DASHBOARD
// ==========================================

// @route   GET /api/placement/analytics
// @desc    Metrics restricted ONLY to students who opted for Placement
router.get('/analytics', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const {
      batch = 'all',
      department = 'all',
      cgpaBracket = 'all',
      isPlaced = 'all',
      placementType = 'all',
      offerType = 'all',
      arrearFilter = 'all',
      search = '',
    } = req.query;

    // Strict constraint: ONLY students whose primary goal is Placement
    const filter = {
      'careerGoal.primaryGoal': 'Placement',
    };

    if (batch && batch !== 'all') {
      filter.batch = batch;
    }

    if (department && department !== 'all') {
      filter.department = department;
    }

    if (isPlaced !== 'all') {
      filter['placementStatus.isPlaced'] = isPlaced === 'true';
    }

    if (placementType !== 'all') {
      filter['placementStatus.placementType'] = placementType;
    }

    if (cgpaBracket !== 'all') {
      if (cgpaBracket === '9-10') filter.currentCGPA = { $gte: 9.0 };
      else if (cgpaBracket === '8-8.99') filter.currentCGPA = { $gte: 8.0, $lt: 9.0 };
      else if (cgpaBracket === '7-7.99') filter.currentCGPA = { $gte: 7.0, $lt: 8.0 };
      else if (cgpaBracket === '6-6.99') filter.currentCGPA = { $gte: 6.0, $lt: 7.0 };
      else if (cgpaBracket === 'below-6') filter.currentCGPA = { $lt: 6.0 };
    }

    if (arrearFilter !== 'all') {
      if (arrearFilter === 'zero_standing') filter.standingArrearsCount = 0;
      else if (arrearFilter === 'has_standing') filter.standingArrearsCount = { $gt: 0 };
      else if (arrearFilter === 'history_cleared') {
        filter.standingArrearsCount = 0;
        filter.historyArrearsCount = { $gt: 0 };
      }
    }

    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { rollNumber: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
        { 'placementStatus.companyName': { $regex: s, $options: 'i' } },
      ];
    }

    // Always sort by rollNumber ascending
    const students = await StudentProfile.find(filter)
      .sort({ rollNumber: 1 })
      .lean();

    const totalAspirants = students.length;
    const placedStudents = students.filter((s) => s.placementStatus && s.placementStatus.isPlaced);
    const unplacedStudents = students.filter((s) => !s.placementStatus || !s.placementStatus.isPlaced);

    const placementRate = totalAspirants > 0 ? ((placedStudents.length / totalAspirants) * 100).toFixed(1) : 0;

    const salaryList = placedStudents
      .map((s) => Number(s.placementStatus.packageCTC) || 0)
      .filter((sal) => sal > 0);

    const avgCtc = salaryList.length > 0 ? (salaryList.reduce((a, b) => a + b, 0) / salaryList.length).toFixed(2) : 0;
    const highestCtc = salaryList.length > 0 ? Math.max(...salaryList).toFixed(2) : 0;

    salaryList.sort((a, b) => a - b);
    const medianCtc =
      salaryList.length > 0
        ? (salaryList.length % 2 === 0
            ? (salaryList[salaryList.length / 2 - 1] + salaryList[salaryList.length / 2]) / 2
            : salaryList[Math.floor(salaryList.length / 2)]
          ).toFixed(2)
        : 0;

    // Department-wise distribution
    const departmentBreakdown = {};
    students.forEach((st) => {
      const dept = st.department || 'Unknown';
      if (!departmentBreakdown[dept]) {
        departmentBreakdown[dept] = { total: 0, placed: 0, unplaced: 0 };
      }
      departmentBreakdown[dept].total += 1;
      if (st.placementStatus && st.placementStatus.isPlaced) {
        departmentBreakdown[dept].placed += 1;
      } else {
        departmentBreakdown[dept].unplaced += 1;
      }
    });

    // Company-wise placements
    const companyHires = {};
    placedStudents.forEach((st) => {
      const comp = st.placementStatus.companyName || 'Other Company';
      companyHires[comp] = (companyHires[comp] || 0) + 1;
    });

    const companyLeaderboard = Object.entries(companyHires)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Active drives count
    const totalDrives = await DepartmentDrive.countDocuments({ driveScope: 'college_wide' });
    const activeDrives = await DepartmentDrive.countDocuments({ driveScope: 'college_wide', status: 'Active' });

    return res.status(200).json({
      success: true,
      metrics: {
        totalAspirants,
        totalPlaced: placedStudents.length,
        totalUnplaced: unplacedStudents.length,
        placementRate: Number(placementRate),
        avgCtc: Number(avgCtc),
        highestCtc: Number(highestCtc),
        medianCtc: Number(medianCtc),
        totalDrives,
        activeDrives,
      },
      departmentBreakdown,
      companyLeaderboard,
      // Default roll number sorted list for floating records window
      students,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/placement/students
// @desc    Placement Aspirants directory list
router.get('/students', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const { batch, department, isPlaced, cgpaBracket, arrearFilter, search } = req.query;

    const filter = { 'careerGoal.primaryGoal': 'Placement' };

    if (batch && batch !== 'all') filter.batch = batch;
    if (department && department !== 'all') filter.department = department;
    if (isPlaced && isPlaced !== 'all') filter['placementStatus.isPlaced'] = isPlaced === 'true';

    if (cgpaBracket && cgpaBracket !== 'all') {
      if (cgpaBracket === '9-10') filter.currentCGPA = { $gte: 9.0 };
      else if (cgpaBracket === '8-8.99') filter.currentCGPA = { $gte: 8.0, $lt: 9.0 };
      else if (cgpaBracket === '7-7.99') filter.currentCGPA = { $gte: 7.0, $lt: 8.0 };
      else if (cgpaBracket === '6-6.99') filter.currentCGPA = { $gte: 6.0, $lt: 7.0 };
      else if (cgpaBracket === 'below-6') filter.currentCGPA = { $lt: 6.0 };
    }

    if (arrearFilter && arrearFilter !== 'all') {
      if (arrearFilter === 'zero_standing') filter.standingArrearsCount = 0;
      else if (arrearFilter === 'has_standing') filter.standingArrearsCount = { $gt: 0 };
    }

    if (search && search.trim()) {
      const s = search.trim();
      filter.$or = [
        { name: { $regex: s, $options: 'i' } },
        { rollNumber: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ];
    }

    const students = await StudentProfile.find(filter)
      .sort({ rollNumber: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/placement/students/:id
// @desc    Get single student profile
router.get('/students/:id', async (req, res) => {
  try {
    const student = await StudentProfile.findOne({
      $or: [{ _id: req.params.id }, { userId: req.params.id }],
    }).populate('mentorId', 'name email department');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    return res.status(200).json({ success: true, student });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/placement/students/:id/remarks
// @desc    Update placement remarks for QS I-Gauge Excel 1 & Student Profiling
router.put('/students/:id/remarks', async (req, res) => {
  try {
    const { placementRemarks, entrepreneurshipRemarks, higherStudiesRemarks, generalRemarks } = req.body;
    const profile = await StudentProfile.findOne({
      $or: [{ _id: req.params.id }, { userId: req.params.id }],
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    profile.mentorRemarks = {
      placementRemarks: placementRemarks !== undefined ? placementRemarks : (profile.mentorRemarks?.placementRemarks || ''),
      entrepreneurshipRemarks: entrepreneurshipRemarks !== undefined ? entrepreneurshipRemarks : (profile.mentorRemarks?.entrepreneurshipRemarks || ''),
      higherStudiesRemarks: higherStudiesRemarks !== undefined ? higherStudiesRemarks : (profile.mentorRemarks?.higherStudiesRemarks || ''),
      generalRemarks: generalRemarks !== undefined ? generalRemarks : (profile.mentorRemarks?.generalRemarks || ''),
      updatedByName: req.user.name,
      updatedAt: new Date(),
    };

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Student remarks updated successfully.',
      mentorRemarks: profile.mentorRemarks,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. PLACEMENT DRIVES (CRUD + ROUNDS + EVALUATION)
// ==========================================

// @route   GET /api/placement/drives
// @desc    Get all college-wide / placement officer drives
router.get('/drives', async (req, res) => {
  try {
    const { status, department } = req.query;
    const query = { driveScope: 'college_wide' };

    if (status && status !== 'all') query.status = status;
    if (department && department !== 'all') query.eligibleDepartments = department;

    const drives = await DepartmentDrive.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email role');

    return res.status(200).json({
      success: true,
      count: drives.length,
      drives,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/placement/drives
// @desc    Create a new college-wide Placement Drive & auto-create Channels 2 & 3
router.post('/drives', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const {
      companyName,
      jobLocation,
      companyDescription,
      eligibleDepartments,
      offerType,
      internshipDurationMonths,
      stipend,
      minCGPA,
      standingArrearsAllowed,
      maxStandingArrears,
      historyArrearsAllowed,
      maxHistoryArrears,
      roles,
      maxRoleChoicesAllowed,
      optInDeadline,
      customFormFields,
      rounds,
    } = req.body;

    if (!companyName || !jobLocation || !optInDeadline) {
      return res.status(400).json({
        success: false,
        message: 'companyName, jobLocation, and optInDeadline are required.',
      });
    }

    const departmentsList = Array.isArray(eligibleDepartments) && eligibleDepartments.length > 0
      ? eligibleDepartments
      : ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS'];

    const drive = new DepartmentDrive({
      companyName: companyName.trim(),
      jobLocation: jobLocation.trim(),
      companyDescription: companyDescription || '',
      department: 'All Departments',
      driveScope: 'college_wide',
      isDepartmentSpecific: false,
      eligibleDepartments: departmentsList,
      offerType: offerType || 'Full Time',
      internshipDurationMonths: Number(internshipDurationMonths) || 0,
      stipend: stipend || '',
      minCGPA: Number(minCGPA) || 0,
      standingArrearsAllowed: Boolean(standingArrearsAllowed),
      maxStandingArrears: Number(maxStandingArrears) || 0,
      historyArrearsAllowed: Boolean(historyArrearsAllowed),
      maxHistoryArrears: Number(maxHistoryArrears) || 0,
      roles: Array.isArray(roles) && roles.length > 0 ? roles : [
        {
          roleName: 'Graduate Trainee Engineer',
          ctc: '7 LPA',
          minCGPA: Number(minCGPA) || 0,
          standingArrearsAllowed: Boolean(standingArrearsAllowed),
          maxStandingArrears: Number(maxStandingArrears) || 0,
          historyArrearsAllowed: Boolean(historyArrearsAllowed),
          maxHistoryArrears: Number(maxHistoryArrears) || 0,
        },
      ],
      maxRoleChoicesAllowed: Number(maxRoleChoicesAllowed) || 1,
      optInDeadline: new Date(optInDeadline),
      customFormFields: Array.isArray(customFormFields) ? customFormFields : [],
      rounds: Array.isArray(rounds) && rounds.length > 0 ? rounds : [
        { roundNumber: 1, roundName: 'Aptitude Assessment' },
        { roundNumber: 2, roundName: 'Coding Assessment' },
        { roundNumber: 3, roundName: 'Technical Interview' },
        { roundNumber: 4, roundName: 'HR Interview' },
      ],
      createdBy: req.user._id,
      status: 'Active',
    });

    await drive.save();

    // AUTO-CREATE Channel 2 Thread: Drive Announcements & Follow-ups (Read-only for students)
    const announcementThread = new CommunicationMessage({
      sender: {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      department: 'Placement Cell',
      channel: 'drive_announcements',
      driveId: drive._id,
      isReadOnly: true, // Read-only for students
      messageType: 'announcement',
      subject: `[Drive Announcement] ${drive.companyName} - Campus Recruitment Details & Schedules`,
      content: `Official announcement thread for ${drive.companyName}.\nOffer Type: ${drive.offerType}\nLocation: ${drive.jobLocation}\nEligible Departments: ${departmentsList.join(', ')}\nOpt-in Deadline: ${new Date(drive.optInDeadline).toLocaleString()}.\nOnly placement team can post updates here.`,
      priority: 'Important',
      targetGroup: 'all_students',
    });
    await announcementThread.save();

    // AUTO-CREATE Channel 3 Thread: Drive Queries (Open for student inquiries)
    const queryThread = new CommunicationMessage({
      sender: {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      department: 'Placement Cell',
      channel: 'drive_queries',
      driveId: drive._id,
      isReadOnly: false, // Students can ask questions
      messageType: 'enquiry',
      subject: `[Drive Q&A] ${drive.companyName} - Inquiries & Clarifications`,
      content: `Welcome to the Q&A thread for ${drive.companyName}. Students opting in or considering this drive can post questions here. The placement team and department coordinators will reply.`,
      priority: 'Normal',
      targetGroup: 'all_students',
    });
    await queryThread.save();

    // Notify all placement-opted eligible students across the eligible departments
    const policy = await PlacementPolicy.findOne({ batch: '2023-2027' });
    const eligibleStudents = await StudentProfile.find({
      'careerGoal.primaryGoal': 'Placement',
      department: { $in: departmentsList },
      currentCGPA: { $gte: drive.minCGPA || 0 },
      ...(drive.standingArrearsAllowed ? {} : { standingArrearsCount: 0 }),
    }).select('userId name placementStatus');

    for (const st of eligibleStudents) {
      const eligibility = checkPostPlacementEligibility(st, drive, policy);
      if (eligibility.eligible) {
        await createNotification({
          recipientId: st.userId,
          senderUser: req.user,
          type: 'announcement',
          title: `New Placement Drive: ${drive.companyName}`,
          message: `${drive.companyName} is hiring for ${drive.offerType}. Opt-in before ${new Date(drive.optInDeadline).toLocaleDateString()}.`,
          relatedId: drive._id,
          link: '/placement',
        });
      }
    }

    await logSystemEvent({
      level: 'info',
      module: 'placement',
      action: 'DRIVE_POSTED',
      message: `Placement Drive for '${drive.companyName}' posted by ${req.user.name}`,
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Drive for ${drive.companyName} created, Channels 2 & 3 initialized, and eligible students notified.`,
      drive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/placement/drives/:id
// @desc    Update drive details
router.put('/drives/:id', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    const updates = req.body;
    Object.assign(drive, updates);
    await drive.save();

    return res.status(200).json({
      success: true,
      message: `Drive details for ${drive.companyName} updated successfully.`,
      drive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/placement/drives/:id
// @desc    Delete drive (direct CRUD, no deletion request)
router.delete('/drives/:id', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    await DepartmentDrive.findByIdAndDelete(req.params.id);

    await logSystemEvent({
      level: 'warn',
      module: 'placement',
      action: 'DRIVE_DELETED',
      message: `Drive '${drive.companyName}' deleted by ${req.user.name}`,
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Drive ${drive.companyName} deleted successfully.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/placement/drives/:id/evaluations
// @desc    Get student round evaluations for a drive
router.get('/drives/:id/evaluations', async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    // If evaluations don't exist yet for opted-in students, initialize them
    const optedInStudents = drive.optIns.filter((o) => o.status === 'Opted-In');

    let updated = false;
    for (const opt of optedInStudents) {
      const exists = drive.roundEvaluations.some((e) => e.studentId.toString() === opt.studentId.toString());
      if (!exists) {
        drive.roundEvaluations.push({
          studentId: opt.studentId,
          rollNumber: opt.rollNumber,
          studentName: opt.studentName,
          department: opt.department,
          rounds: (drive.rounds || []).map((r) => ({
            roundNumber: r.roundNumber,
            roundName: r.roundName,
            status: 'Failed', // Default per specification: Failed until updated
            remarks: '',
          })),
          finalStatus: 'Not Placed',
          placedRole: '',
          placedCTC: '',
          absentCount: 0,
        });
        updated = true;
      }
    }

    if (updated) {
      await drive.save();
    }

    // Sort by rollNumber
    const evaluations = [...drive.roundEvaluations].sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

    return res.status(200).json({
      success: true,
      rounds: drive.rounds,
      evaluations,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/placement/drives/:id/evaluations
// @desc    Update a student's round evaluation outcome (Passed / Failed / Absent / Placed)
router.put('/drives/:id/evaluations', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const { studentId, roundNumber, status, remarks, isFinalRound, placedRole, placedCTC } = req.body;

    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    const evaluation = drive.roundEvaluations.find((e) => e.studentId.toString() === studentId.toString());
    if (!evaluation) {
      return res.status(404).json({ success: false, message: 'Evaluation record for student not found.' });
    }

    const roundIndex = evaluation.rounds.findIndex((r) => r.roundNumber === Number(roundNumber));
    if (roundIndex === -1) {
      return res.status(404).json({ success: false, message: `Round ${roundNumber} not found in drive.` });
    }

    const roundItem = evaluation.rounds[roundIndex];
    roundItem.status = status;
    if (remarks) roundItem.remarks = remarks;
    roundItem.updatedAt = new Date();

    const studentUser = await User.findById(studentId);
    const studentProfile = await StudentProfile.findOne({ userId: studentId });

    // CASCADING RULES:
    // 1. If ABSENT:
    //    - All subsequent rounds automatically marked Absent
    //    - Increment absent count
    //    - Send email/notification requiring proof submission within 24h
    if (status === 'Absent') {
      evaluation.absentCount = (evaluation.absentCount || 0) + 1;
      for (let i = roundIndex + 1; i < evaluation.rounds.length; i++) {
        evaluation.rounds[i].status = 'Absent';
        evaluation.rounds[i].remarks = 'Cascade Absent from Round ' + roundNumber;
      }
      evaluation.finalStatus = 'Not Placed';

      if (studentUser) {
        await createNotification({
          recipientId: studentId,
          senderUser: req.user,
          type: 'announcement',
          title: `URGENT: Marked Absent in ${drive.companyName} (${roundItem.roundName})`,
          message: `You were marked Absent. You must submit valid medical/academic proof via email to placement@college.edu within 24 hours.`,
        });

        try {
          await sendPlacementRoundEmail({
            toEmail: studentUser.email,
            recipientName: studentUser.name,
            companyName: drive.companyName,
            roundName: roundItem.roundName,
            status: 'Absent',
            instructions: 'Submit your signed proof and reason via email to placement@college.edu immediately to avoid being barred from future drives.',
          });
        } catch (mailErr) {
          console.warn('Mail dispatch failed:', mailErr.message);
        }
      }
    }

    // 2. If FAILED:
    //    - Subsequent rounds marked '-'
    else if (status === 'Failed') {
      for (let i = roundIndex + 1; i < evaluation.rounds.length; i++) {
        evaluation.rounds[i].status = '-';
      }
      evaluation.finalStatus = 'Not Placed';
    }

    // 3. If PASSED:
    //    - Notify student to proceed to next round
    else if (status === 'Passed') {
      const nextRound = evaluation.rounds[roundIndex + 1];
      if (nextRound && nextRound.status === '-') {
        nextRound.status = 'Failed'; // Reset to default pending state
      }

      if (studentUser) {
        await createNotification({
          recipientId: studentId,
          senderUser: req.user,
          type: 'announcement',
          title: `Round Cleared! ${drive.companyName} (${roundItem.roundName})`,
          message: `Congratulations! You have cleared ${roundItem.roundName}.${nextRound ? ` Prepare for Round ${nextRound.roundNumber}: ${nextRound.roundName}.` : ''}`,
        });

        try {
          await sendPlacementRoundEmail({
            toEmail: studentUser.email,
            recipientName: studentUser.name,
            companyName: drive.companyName,
            roundName: roundItem.roundName,
            status: 'Passed',
            instructions: nextRound ? `Next round is ${nextRound.roundName}. Please be prepared.` : 'Awaiting final offer announcement.',
          });
        } catch (mailErr) {
          console.warn('Mail dispatch failed:', mailErr.message);
        }
      }
    }

    // 4. Final Placement Marking
    if (isFinalRound || status === 'Placed' || req.body.finalStatus === 'Placed') {
      evaluation.finalStatus = 'Placed';
      evaluation.placedRole = placedRole || (drive.roles && drive.roles[0] ? drive.roles[0].roleName : 'Selected Role');
      evaluation.placedCTC = placedCTC || (drive.roles && drive.roles[0] ? drive.roles[0].ctc : 'CTC As Agreed');

      // Update StudentProfile placementStatus and placementOffers for all 5 Excels
      if (studentProfile) {
        const ctcNum = parseFloat((evaluation.placedCTC || '').match(/[0-9]+(\.[0-9]+)?/) ? RegExp.$1 : '0') || 0;
        studentProfile.isPlaced = 'Yes';
        studentProfile.placedCompany = drive.companyName;
        studentProfile.salaryPackage = ctcNum;
        studentProfile.placementType = 'On-Campus';
        studentProfile.jobRole = evaluation.placedRole;
        studentProfile.placementStatus = {
          isPlaced: true,
          placementType: 'On-Campus',
          companyName: drive.companyName,
          packageCTC: ctcNum,
          jobRole: evaluation.placedRole,
        };

        if (!Array.isArray(studentProfile.placementOffers)) {
          studentProfile.placementOffers = [];
        }
        const existingOfferIdx = studentProfile.placementOffers.findIndex(o =>
          (o.companyName || '').toLowerCase() === drive.companyName.toLowerCase()
        );
        const offerData = {
          companyName: drive.companyName,
          jobRole: evaluation.placedRole,
          packageCTC: ctcNum,
          placementType: 'On-Campus',
          offerType: drive.offerType || 'Full Time',
          dateOfOffer: new Date(),
        };
        if (existingOfferIdx > -1) {
          studentProfile.placementOffers[existingOfferIdx] = offerData;
        } else {
          studentProfile.placementOffers.push(offerData);
        }
        await studentProfile.save();
      }

      if (studentUser) {
        await createNotification({
          recipientId: studentId,
          senderUser: req.user,
          type: 'announcement',
          title: `🎉 CONGRATULATIONS! Placed at ${drive.companyName}!`,
          message: `Hearty congratulations! You have been successfully selected for ${evaluation.placedRole} at ${drive.companyName} (${evaluation.placedCTC}).`,
        });

        try {
          await sendPlacementRoundEmail({
            toEmail: studentUser.email,
            recipientName: studentUser.name,
            companyName: drive.companyName,
            roundName: 'Final Offer',
            status: 'Placed',
            instructions: `Offer Role: ${evaluation.placedRole} | Package: ${evaluation.placedCTC}. Official offer letter dispatch and onboarding details will follow.`,
          });
        } catch (mailErr) {
          console.warn('Mail dispatch failed:', mailErr.message);
        }
      }
    }

    await drive.save();

    return res.status(200).json({
      success: true,
      message: `Evaluation for ${evaluation.studentName} updated successfully.`,
      evaluation,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/placement/drives/:id/rounds
// @desc    Add, modify, rename, or remove rounds of a drive dynamically
router.put('/drives/:id/rounds', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const { rounds } = req.body;
    if (!Array.isArray(rounds)) {
      return res.status(400).json({ success: false, message: 'rounds array is required.' });
    }

    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    const formattedRounds = rounds.map((r, idx) => ({
      roundNumber: idx + 1,
      roundName: (r.roundName || `Round ${idx + 1}`).trim(),
    }));

    drive.rounds = formattedRounds;

    // Synchronize round evaluations for all opted students
    drive.roundEvaluations.forEach((ev) => {
      const oldRoundsMap = new Map();
      (ev.rounds || []).forEach(oldR => {
        oldRoundsMap.set(oldR.roundNumber, oldR);
      });

      ev.rounds = formattedRounds.map((r) => {
        const existing = oldRoundsMap.get(r.roundNumber);
        return {
          roundNumber: r.roundNumber,
          roundName: r.roundName,
          status: existing ? existing.status : 'Failed',
          remarks: existing ? existing.remarks : '',
          updatedAt: existing ? existing.updatedAt : new Date(),
        };
      });
    });

    await drive.save();

    return res.status(200).json({
      success: true,
      message: 'Drive rounds updated and synchronized successfully.',
      rounds: drive.rounds,
      evaluations: drive.roundEvaluations,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. PLACEMENT UNWILLINGNESS FORM & SUBMISSIONS
// ==========================================

// @route   GET /api/placement/unwillingness/form
// @desc    Get active unwillingness form metadata
router.get('/unwillingness/form', async (req, res) => {
  try {
    let form = await PlacementUnwillingness.findOne({ isActive: true });
    if (!form) {
      const officer = await User.findOne({ role: 'placement_officer' });
      form = await PlacementUnwillingness.create({
        title: 'Placement Unwillingness Undertaking & Documentation Form',
        instructions: 'Mandatory undertaking form for students choosing Higher Studies or Entrepreneurship instead of campus placement. Upload your signed undertaking document.',
        createdBy: officer ? officer._id : req.user._id,
      });
    }

    return res.status(200).json({
      success: true,
      form,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/placement/unwillingness/form
// @desc    Placement officer creates/updates unwillingness form definition
router.post('/unwillingness/form', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const { title, instructions, sampleDocumentUrl, deadline, isActive, customFields } = req.body;

    let form = await PlacementUnwillingness.findOne({ isActive: true });
    if (!form) {
      form = new PlacementUnwillingness({ createdBy: req.user._id });
    }

    if (title) form.title = title.trim();
    if (instructions) form.instructions = instructions.trim();
    if (sampleDocumentUrl !== undefined) form.sampleDocumentUrl = sampleDocumentUrl;
    if (deadline) form.deadline = new Date(deadline);
    if (isActive !== undefined) form.isActive = Boolean(isActive);
    if (customFields && Array.isArray(customFields)) form.customFields = customFields;

    await form.save();

    // Notify all students NOT opted for placement
    const nonPlacementStudents = await StudentProfile.find({
      'careerGoal.primaryGoal': { $in: ['Higher Studies', 'Entrepreneurship'] },
    }).select('userId');

    for (const st of nonPlacementStudents) {
      await createNotification({
        recipientId: st.userId,
        senderUser: req.user,
        type: 'announcement',
        title: 'Action Required: Placement Unwillingness Undertaking Form',
        message: 'Please complete and submit the official Placement Unwillingness Form along with your signed undertaking.',
        relatedId: form._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Unwillingness form published successfully and non-placement students notified.',
      form,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/placement/unwillingness/submit
// @desc    Student submits placement unwillingness form (locks choice)
router.post('/unwillingness/submit', async (req, res) => {
  try {
    const { careerGoalChoice, reasonForUnwillingness, higherStudiesDetails, entrepreneurshipDetails, signedFormAttachment } = req.body;

    if (!careerGoalChoice || !reasonForUnwillingness) {
      return res.status(400).json({
        success: false,
        message: 'careerGoalChoice and reasonForUnwillingness are required.',
      });
    }

    let form = await PlacementUnwillingness.findOne({ isActive: true });
    if (!form) {
      return res.status(404).json({ success: false, message: 'Active unwillingness form not found.' });
    }

    // Check if student already submitted
    const existingIndex = form.submissions.findIndex((s) => s.studentId.toString() === req.user._id.toString());

    if (existingIndex !== -1 && form.submissions[existingIndex].isLocked && !form.submissions[existingIndex].allowPlacementSwitch) {
      return res.status(403).json({
        success: false,
        message: 'Your unwillingness form has already been submitted and locked. You cannot modify your choice without explicit permission from the Placement Officer.',
      });
    }

    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });

    const submissionData = {
      studentId: req.user._id,
      rollNumber: studentProfile ? studentProfile.rollNumber : req.user.rollNumber || 'STU-000',
      name: req.user.name,
      email: req.user.email,
      department: studentProfile ? studentProfile.department : req.user.department || 'General',
      careerGoalChoice,
      higherStudiesDetails: higherStudiesDetails || {},
      entrepreneurshipDetails: entrepreneurshipDetails || {},
      reasonForUnwillingness: reasonForUnwillingness.trim(),
      signedFormAttachment: signedFormAttachment || '',
      customResponses: req.body.customResponses || {},
      parentAcknowledgmentAttached: true,
      isLocked: true, // Locked choice!
      allowPlacementSwitch: false,
      submittedAt: new Date(),
    };

    if (existingIndex !== -1) {
      form.submissions[existingIndex] = submissionData;
    } else {
      form.submissions.push(submissionData);
    }

    await form.save();

    // Lock student's profile career goal choice
    if (studentProfile) {
      studentProfile.careerGoal.primaryGoal = careerGoalChoice;
      await studentProfile.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Placement unwillingness undertaking submitted and locked successfully.',
      submission: submissionData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/placement/unwillingness/submissions
// @desc    View all unwillingness submissions (Placement officer sees all; Coordinator sees their department only)
router.get('/unwillingness/submissions', async (req, res) => {
  try {
    const { department, careerGoalChoice, search } = req.query;

    const form = await PlacementUnwillingness.findOne({ isActive: true });
    if (!form) {
      return res.status(200).json({ success: true, count: 0, submissions: [] });
    }

    let submissions = form.submissions || [];

    // Coordinators can ONLY see their own department
    if (req.user.role === 'department_coordinator') {
      submissions = submissions.filter((s) => s.department === req.user.department);
    } else if (department && department !== 'all') {
      submissions = submissions.filter((s) => s.department === department);
    }

    if (careerGoalChoice && careerGoalChoice !== 'all') {
      submissions = submissions.filter((s) => s.careerGoalChoice === careerGoalChoice);
    }

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      submissions = submissions.filter(
        (sub) =>
          sub.name.toLowerCase().includes(s) ||
          sub.rollNumber.toLowerCase().includes(s) ||
          sub.email.toLowerCase().includes(s)
      );
    }

    // Sort by rollNumber
    submissions.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

    return res.status(200).json({
      success: true,
      count: submissions.length,
      submissions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/placement/unwillingness/:submissionId/permit-placement
// @desc    Placement officer permits a locked student to switch back to Placement
router.put('/unwillingness/:submissionId/permit-placement', authorize('placement_officer', 'admin'), async (req, res) => {
  try {
    const form = await PlacementUnwillingness.findOne({ 'submissions._id': req.params.submissionId });
    if (!form) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    const sub = form.submissions.id(req.params.submissionId);
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }

    sub.allowPlacementSwitch = true;
    sub.isLocked = false;
    sub.permittedBy = req.user._id;
    sub.permittedAt = new Date();

    await form.save();

    // Allow student profile to select Placement
    const profile = await StudentProfile.findOne({ userId: sub.studentId });
    if (profile) {
      profile.careerGoal.primaryGoal = 'Placement';
      await profile.save();
    }

    // Notify student
    await createNotification({
      recipientId: sub.studentId,
      senderUser: req.user,
      type: 'announcement',
      title: 'Placement Permission Granted',
      message: 'The Placement Officer has approved your request to switch your career path to Campus Placement. You are now eligible to opt-in for upcoming placement drives.',
      link: '/placement',
    });

    return res.status(200).json({
      success: true,
      message: `Permission granted for ${sub.name} to opt-in for placement.`,
      submission: sub,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 5. EXCEL EXPORTS (EXCEL 1, EXCEL 2, UNWILLINGNESS)
// ==========================================

// @route   GET /api/placement/drives/:id/export-excel
// @desc    EXCEL 1: Drive-specific Excel with Eligible/Opted Students & Round-Level Analysis Sheet
router.get('/drives/:id/export-excel', async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    // SHEET 1: Eligible & Opted Students
    const eligibleStudents = await StudentProfile.find({
      'careerGoal.primaryGoal': 'Placement',
      department: { $in: drive.eligibleDepartments || ['CSE'] },
      currentCGPA: { $gte: drive.minCGPA || 0 },
    }).sort({ rollNumber: 1 });

    const sheet1Data = eligibleStudents.map((st) => {
      const optRecord = drive.optIns.find((o) => o.studentId.toString() === st.userId.toString());
      const isOptedIn = optRecord && optRecord.status === 'Opted-In';
      const isOptedOut = optRecord && optRecord.status === 'Opted-Out';

      return {
        'Roll Number': st.rollNumber,
        'Student Name': st.name,
        'Department': st.department,
        'Section': st.section,
        'Email': st.email,
        'Current CGPA': st.currentCGPA,
        'Standing Arrears': st.standingArrearsCount,
        'History Arrears': st.historyArrearsCount,
        'Opt-in Status': isOptedIn ? 'Opted-In' : isOptedOut ? 'Opted-Out' : 'Not Responded',
        'Selected Roles': isOptedIn ? (optRecord.selectedRoles || []).join(', ') : '-',
        'Opted At': isOptedIn && optRecord.optedAt ? new Date(optRecord.optedAt).toLocaleString() : '-',
      };
    });

    // SHEET 2: Round-Level Analysis
    const sheet2Data = (drive.roundEvaluations || []).map((ev) => {
      const row = {
        'Roll Number': ev.rollNumber,
        'Student Name': ev.studentName,
        'Department': ev.department,
      };

      (drive.rounds || []).forEach((r) => {
        const found = (ev.rounds || []).find((rnd) => rnd.roundNumber === r.roundNumber);
        row[`Round ${r.roundNumber} (${r.roundName})`] = found ? found.status : 'Failed';
      });

      row['Final Status'] = ev.finalStatus || 'Not Placed';
      row['Offered Role'] = ev.placedRole || '-';
      row['Offered CTC'] = ev.placedCTC || '-';
      row['Absent Count'] = ev.absentCount || 0;

      return row;
    });

    // Generate Workbook
    const wb = xlsx.utils.book_new();
    const ws1 = xlsx.utils.json_to_sheet(sheet1Data);
    const ws2 = xlsx.utils.json_to_sheet(sheet2Data);

    xlsx.utils.book_append_sheet(wb, ws1, 'Eligible & Opted Students');
    xlsx.utils.book_append_sheet(wb, ws2, 'Round-Level Analysis');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const sanitizedName = drive.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');

    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}_Drive_Rounds_Analysis.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/placement/export-master-tracking
// @desc    EXCEL 2: Master Placement Tracking Excel with separate sheet per department
router.get('/export-master-tracking', async (req, res) => {
  try {
    const requestedDept = req.query.department;
    const isCoordinator = req.user.role === 'department_coordinator';

    // If Coordinator, restrict to their department only
    const targetDept = isCoordinator ? req.user.department : requestedDept;

    const allDrives = await DepartmentDrive.find({ driveScope: 'college_wide' }).sort({ createdAt: 1 });
    const policy = await PlacementPolicy.findOne({ batch: '2023-2027' });

    // Determine departments to include
    let departments = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS'];
    if (targetDept && targetDept !== 'all') {
      departments = [targetDept];
    }

    const wb = xlsx.utils.book_new();

    for (const dept of departments) {
      const students = await StudentProfile.find({
        'careerGoal.primaryGoal': 'Placement',
        department: dept,
      }).sort({ rollNumber: 1 });

      if (students.length === 0 && targetDept && targetDept !== 'all') {
        // continue even if empty for explicit department
      }

      const rows = students.map((st) => {
        let totalEligibleDrives = 0;
        let totalOptedDrives = 0;
        let absentCount = 0;

        const row = {
          'Roll Number': st.rollNumber,
          'Student Name': st.name,
          'Email': st.email,
          'Department': st.department,
          'Current CGPA': st.currentCGPA,
          'Standing Arrears': st.standingArrearsCount,
        };

        // For each drive, compute status
        allDrives.forEach((drive) => {
          const colHeader = `${drive.companyName} (${drive.offerType || 'Full-Time'} - ${drive.roles && drive.roles[0] ? drive.roles[0].ctc : ''})`;

          // Check eligibility
          const deptEligible = (drive.eligibleDepartments || []).includes(dept);
          const cgpaEligible = st.currentCGPA >= (drive.minCGPA || 0);
          const arrearsEligible = drive.standingArrearsAllowed || st.standingArrearsCount === 0;
          const postPlacement = checkPostPlacementEligibility(st, drive, policy);

          const isEligible = deptEligible && cgpaEligible && arrearsEligible && postPlacement.eligible;

          if (isEligible) {
            totalEligibleDrives++;
            const optRecord = drive.optIns.find((o) => o.studentId.toString() === st.userId.toString());
            const ev = drive.roundEvaluations.find((e) => e.studentId.toString() === st.userId.toString());

            if (ev && ev.finalStatus === 'Placed') {
              row[colHeader] = 'Placed';
              totalOptedDrives++;
            } else if (ev && (ev.rounds || []).some((r) => r.status === 'Absent')) {
              row[colHeader] = 'Absent';
              totalOptedDrives++;
              absentCount++;
            } else if (optRecord && optRecord.status === 'Opted-In') {
              row[colHeader] = 'Opted-In';
              totalOptedDrives++;
            } else {
              row[colHeader] = 'Eligible - Not Opted';
            }
          } else {
            // Not eligible or removed due to post placement policy
            row[colHeader] = '-';
          }
        });

        row['Total Eligible Drives'] = totalEligibleDrives;
        row['Total Opted Drives'] = totalOptedDrives;
        row['Absent Count'] = absentCount;
        row['Final Placement Status'] = st.placementStatus && st.placementStatus.isPlaced ? 'Placed' : 'Unplaced';
        row['Placed Company'] = st.placementStatus && st.placementStatus.isPlaced ? st.placementStatus.companyName : '-';
        row['Placed Package (LPA)'] = st.placementStatus && st.placementStatus.isPlaced ? st.placementStatus.packageCTC : '-';

        return row;
      });

      const ws = xlsx.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Message': 'No placement-registered students in ' + dept }]);
      xlsx.utils.book_append_sheet(wb, ws, dept);
    }

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = targetDept && targetDept !== 'all' ? `${targetDept}_Placement_Tracking.xlsx` : 'Master_Placement_Tracking_All_Departments.xlsx';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/placement/unwillingness/export-excel
// @desc    Export Unwillingness Submissions: Department-wise, separated by Higher Studies & Entrepreneurship, sorted by roll number
router.get('/unwillingness/export-excel', async (req, res) => {
  try {
    const isCoordinator = req.user.role === 'department_coordinator';
    const requestedDept = req.query.department;
    const targetDept = isCoordinator ? req.user.department : requestedDept;

    const form = await PlacementUnwillingness.findOne({ isActive: true });
    let submissions = form ? form.submissions || [] : [];

    if (targetDept && targetDept !== 'all') {
      submissions = submissions.filter((s) => s.department === targetDept);
    }

    const departments = targetDept && targetDept !== 'all'
      ? [targetDept]
      : Array.from(new Set(submissions.map((s) => s.department || 'General'))).sort();

    if (departments.length === 0) {
      departments.push('CSE');
    }

    const wb = xlsx.utils.book_new();

    departments.forEach((dept) => {
      const deptSubs = submissions.filter((s) => (s.department || 'General') === dept);

      // Separate into Higher Studies and Entrepreneurship
      const higherStudies = deptSubs
        .filter((s) => s.careerGoalChoice === 'Higher Studies')
        .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

      const entrepreneurship = deptSubs
        .filter((s) => s.careerGoalChoice === 'Entrepreneurship')
        .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || ''));

      const combinedRows = [];

      // Higher Studies Section
      combinedRows.push({ 'Section': '=== HIGHER STUDIES ASPIRANTS ===' });
      higherStudies.forEach((hs) => {
        combinedRows.push({
          'Roll Number': hs.rollNumber,
          'Student Name': hs.name,
          'Email': hs.email,
          'Target Degree': hs.higherStudiesDetails ? hs.higherStudiesDetails.targetDegree : '',
          'Specialization': hs.higherStudiesDetails ? hs.higherStudiesDetails.specialization : '',
          'Country Preference': hs.higherStudiesDetails ? hs.higherStudiesDetails.countryPreference : '',
          'Planned Exam': hs.higherStudiesDetails ? hs.higherStudiesDetails.entranceExam : '',
          'Reason': hs.reasonForUnwillingness,
          'Status': hs.isLocked ? 'Locked (Unwilling)' : 'Unlocked',
          'Submitted At': new Date(hs.submittedAt).toLocaleDateString(),
        });
      });

      // Space
      combinedRows.push({});

      // Entrepreneurship Section
      combinedRows.push({ 'Section': '=== ENTREPRENEURSHIP / STARTUP ASPIRANTS ===' });
      entrepreneurship.forEach((ent) => {
        combinedRows.push({
          'Roll Number': ent.rollNumber,
          'Student Name': ent.name,
          'Email': ent.email,
          'Startup / Venture': ent.entrepreneurshipDetails ? ent.entrepreneurshipDetails.startupName : '',
          'Industry / Domain': ent.entrepreneurshipDetails ? ent.entrepreneurshipDetails.industry : '',
          'Current Stage': ent.entrepreneurshipDetails ? ent.entrepreneurshipDetails.currentStage : '',
          'Summary': ent.entrepreneurshipDetails ? ent.entrepreneurshipDetails.summary : '',
          'Reason': ent.reasonForUnwillingness,
          'Status': ent.isLocked ? 'Locked (Unwilling)' : 'Unlocked',
          'Submitted At': new Date(ent.submittedAt).toLocaleDateString(),
        });
      });

      const ws = xlsx.utils.json_to_sheet(combinedRows);
      const sheetTitle = (dept.substring(0, 28) || 'Dept') + '_Unwilling';
      xlsx.utils.book_append_sheet(wb, ws, sheetTitle);
    });

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = targetDept && targetDept !== 'all' ? `${targetDept}_Unwillingness_Report.xlsx` : 'Placement_Unwillingness_Undertakings.xlsx';

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 6. 3-CHANNEL COMMUNICATION HUB
// ==========================================

// @route   GET /api/placement/communication/messages
// @desc    Get messages filtered by channel (general, drive_announcements, drive_queries)
router.get('/communication/messages', async (req, res) => {
  try {
    const { channel = 'general', driveId } = req.query;

    const query = { channel };
    if (driveId) query.driveId = driveId;

    const messages = await CommunicationMessage.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      channel,
      count: messages.length,
      messages,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/placement/communication/messages
// @desc    Post message in one of the 3 channels
router.post('/communication/messages', async (req, res) => {
  try {
    const { channel = 'general', driveId, subject, content, priority = 'Normal', targetGroup = 'all_students' } = req.body;

    if (!subject || !content) {
      return res.status(400).json({ success: false, message: 'subject and content are required.' });
    }

    // Enforcement: Channel 2 (drive_announcements) is READ-ONLY for students
    if (channel === 'drive_announcements' && req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Drive Announcements channel is read-only for students. Please post in Channel 3 (Drive Queries) for questions.',
      });
    }

    const message = new CommunicationMessage({
      sender: {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      department: req.user.department || 'Placement Cell',
      channel,
      driveId: driveId || null,
      isReadOnly: channel === 'drive_announcements',
      subject: subject.trim(),
      content: content.trim(),
      priority,
      targetGroup,
      messageType: channel === 'drive_announcements' ? 'announcement' : channel === 'drive_queries' ? 'enquiry' : 'message',
    });

    await message.save();

    return res.status(201).json({
      success: true,
      message: 'Message posted successfully to channel.',
      communicationMessage: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/placement/communication/messages/:id/reply
// @desc    Post reply to a message thread (e.g. answering a drive query)
router.post('/communication/messages/:id/reply', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const thread = await CommunicationMessage.findById(req.params.id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Thread not found.' });
    }

    if (thread.isReadOnly && req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'This announcement channel is read-only for students.' });
    }

    thread.replies.push({
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content: content.trim(),
      sentAt: new Date(),
    });

    await thread.save();

    // Notify thread creator if replied by someone else
    if (thread.sender.userId && thread.sender.userId.toString() !== req.user._id.toString()) {
      await createNotification({
        recipientId: thread.sender.userId,
        senderUser: req.user,
        type: 'message_reply',
        title: `Reply on: ${thread.subject}`,
        message: `${req.user.name}: ${content.substring(0, 80)}...`,
        relatedId: thread._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reply posted successfully.',
      thread,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
