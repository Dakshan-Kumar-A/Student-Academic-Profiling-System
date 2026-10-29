const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');
const DepartmentDrive = require('../models/DepartmentDrive');
const PlacementUnwillingness = require('../models/PlacementUnwillingness');
const PlacementPolicy = require('../models/PlacementPolicy');
const CommunicationMessage = require('../models/CommunicationMessage');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { logSystemEvent } = require('../utils/logger');
const { createNotification } = require('../services/notificationService');

// All endpoints in this router are for logged-in students (or admin)
router.use(protect);
router.use(authorize('student', 'admin'));

// Helper: Get or initialize student profile for current user
const getOrCreateProfile = async (user) => {
  let profile = await StudentProfile.findOne({ userId: user._id });
  if (!profile) {
    profile = new StudentProfile({
      userId: user._id,
      rollNumber: user.rollNumber || (user.email ? user.email.split('@')[0].toUpperCase() : 'PENDING'),
      registerNumber: user.rollNumber || '',
      name: user.name || 'Student',
      email: user.email,
      department: user.department || 'CSE',
      section: user.section || 'A',
      currentCGPA: 0,
      standingArrearsCount: 0,
      historyArrearsCount: 0,
      careerGoal: 'Undecided',
    });
    await profile.save();
  }
  return profile;
};

// ============================================================================
// 1. STUDENT PROFILE MANAGEMENT
// ============================================================================
router.get('/profile', async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user);
    const populated = await StudentProfile.findById(profile._id)
      .populate('mentorId', 'name email designation department')
      .populate('userId', 'email name role isProfileCompleted');

    // Also check unwillingness status to inform UI if careerGoal is locked
    const activeForm = await PlacementUnwillingness.findOne({ isActive: true }).lean();
    let unwillingnessStatus = null;
    if (activeForm && activeForm.submissions) {
      const sub = activeForm.submissions.find(s =>
        (s.rollNumber && s.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase()) ||
        String(s.studentId) === String(req.user._id)
      );
      if (sub) {
        unwillingnessStatus = {
          submitted: true,
          isLocked: sub.isLocked,
          allowPlacementSwitch: sub.allowPlacementSwitch,
          careerGoalChoice: sub.careerGoalChoice,
          submittedAt: sub.submittedAt,
        };
      }
    }

    return res.status(200).json({
      success: true,
      profile: populated,
      unwillingnessStatus,
    });
  } catch (error) {
    console.error('Error fetching student profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve profile', error: error.message });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user);
    const updates = req.body;

    // Check Unwillingness Lock: If student submitted unwillingness form, locked, and not permitted switch
    if (updates.careerGoal && updates.careerGoal.toLowerCase() === 'placement' && profile.careerGoal !== 'Placement') {
      const activeForm = await PlacementUnwillingness.findOne({ isActive: true }).lean();
      if (activeForm && activeForm.submissions) {
        const sub = activeForm.submissions.find(s =>
          (s.rollNumber && s.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase()) ||
          String(s.studentId) === String(req.user._id)
        );
        if (sub && sub.isLocked && !sub.allowPlacementSwitch) {
          return res.status(403).json({
            success: false,
            message: 'You have submitted a formal Placement Unwillingness form. You cannot switch back to Placement without explicit permission from the Placement Officer.',
          });
        }
      }
    }

    // Dynamic field cleanup based on career goal choice
    if (updates.careerGoal) {
      const goal = updates.careerGoal.toLowerCase();
      if (goal !== 'placement') {
        // Clear or nil out placement-only fields
        updates.isPlaced = 'No';
        updates.placedCompany = '';
        updates.salaryPackage = 0;
        updates.placementType = 'On-Campus';
        updates.jobRole = '';
      }
      if (!goal.includes('higher')) {
        updates.higherStudiesDetails = {
          degree: '',
          institution: '',
          fieldOfStudy: '',
          admissionYear: '',
          examQualified: '',
          score: '',
          targetDegree: '',
          targetInstitution: '',
          countryPreference: '',
        };
      }
      if (!goal.includes('entrepreneur')) {
        updates.entrepreneurshipDetails = {
          companyName: '',
          startupName: '',
          industry: '',
          currentStage: 'Idea',
          fundingStatus: '',
          teamSize: 0,
          annualRevenue: '',
          designation: '',
          summary: '',
        };
      }
    }

    // Apply allowed fields to profile
    const allowedKeys = [
      'name', 'registerNumber', 'personalEmail', 'contactNumber', 'residentialAddress',
      'studentCategory', 'hostelName', 'distanceToCollege', 'gender', 'dateOfBirth',
      'fatherDetails', 'motherDetails', 'guardianDetails', 'emergencyContactNumber',
      'firstGenGraduate', 'scholarshipAvailed', 'mentorshipGuidanceRequired',
      'semesters', 'arrears', 'technicalSkills', 'languages', 'domainInterest',
      'certifications', 'projects', 'hackathons', 'internshipExperience',
      'githubProfile', 'linkedinProfile', 'hackerrankProfile', 'hackerearthProfile',
      'communicationSkillLevel', 'aptitudeSkillLevel', 'selfEvaluation',
      'careerGoal', 'higherStudiesDetails', 'entrepreneurshipDetails',
    ];

    allowedKeys.forEach((key) => {
      if (updates[key] !== undefined) {
        profile[key] = updates[key];
      }
    });

    await profile.save();

    // Also update User isProfileCompleted if completeness >= 75
    if (profile.profileCompleteness >= 75) {
      await User.findByIdAndUpdate(req.user._id, { isProfileCompleted: true });
    }

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      profileCompleteness: profile.profileCompleteness,
      profile,
    });
  } catch (error) {
    console.error('Error updating student profile:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
});

// ============================================================================
// 2. DRIVES & OPT-IN / OPT-OUT
// Categorized into Department Drives (Off-Campus) and Placement Drives (On-Campus)
// ============================================================================
router.get('/drives', async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user);
    const studentDept = (profile.department || req.user.department || '').toUpperCase();
    const studentCGPA = profile.currentCGPA || 0;
    const standingArrears = profile.standingArrearsCount || 0;
    const historyArrears = profile.historyArrearsCount || 0;

    // Fetch placement policy for post-placement checks
    const policy = await PlacementPolicy.findOne({}).lean();

    // Query drives where student's dept is eligible or drive is college_wide
    const drives = await DepartmentDrive.find({
      status: 'Active',
      $or: [
        { driveScope: 'college_wide' },
        { department: { $regex: new RegExp(`^${studentDept}$`, 'i') } },
        { eligibleDepartments: { $in: [studentDept] } },
      ],
    }).sort({ createdAt: -1 }).lean();

    const departmentDrives = [];
    const placementDrives = [];

    const now = new Date();

    drives.forEach((d) => {
      // Check eligibility
      let isEligible = true;
      const reasons = [];

      // CGPA Check
      if (d.minCGPA > 0 && studentCGPA < d.minCGPA) {
        isEligible = false;
        reasons.push(`Minimum CGPA requirement is ${d.minCGPA} (Your CGPA: ${studentCGPA})`);
      }

      // Standing Arrears Check
      if (!d.standingArrearsAllowed && standingArrears > 0) {
        isEligible = false;
        reasons.push(`No standing arrears allowed (You have ${standingArrears})`);
      } else if (d.standingArrearsAllowed && standingArrears > (d.maxStandingArrears || 0)) {
        isEligible = false;
        reasons.push(`Maximum allowed standing arrears is ${d.maxStandingArrears} (You have ${standingArrears})`);
      }

      // History Arrears Check
      if (!d.historyArrearsAllowed && historyArrears > 0) {
        isEligible = false;
        reasons.push(`No history of arrears allowed (You have ${historyArrears})`);
      } else if (d.historyArrearsAllowed && historyArrears > (d.maxHistoryArrears || 0)) {
        isEligible = false;
        reasons.push(`Maximum allowed history arrears is ${d.maxHistoryArrears} (You have ${historyArrears})`);
      }

      // Department Check
      if (d.eligibleDepartments && d.eligibleDepartments.length > 0) {
        const match = d.eligibleDepartments.some(dept => dept.toUpperCase() === studentDept);
        if (!match && d.department?.toUpperCase() !== studentDept) {
          isEligible = false;
          reasons.push(`Drive is not open for ${studentDept} department`);
        }
      }

      // Opt-in record for this student
      const optRecord = (d.optIns || []).find(o =>
        String(o.studentId) === String(req.user._id) ||
        (o.rollNumber && o.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase())
      );

      const hasOptedIn = optRecord && optRecord.status === 'Opted-In';
      const hasOptedOut = optRecord && optRecord.status === 'Opted-Out';
      const isBlockedOrRemoved = optRecord && (optRecord.status === 'Removed' || optRecord.status === 'Blocked');
      const isPastDeadline = d.optInDeadline ? new Date(d.optInDeadline) < now : false;

      // Evaluation record
      const evalRecord = (d.roundEvaluations || []).find(e =>
        String(e.studentId) === String(req.user._id) ||
        (e.rollNumber && e.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase())
      );

      const driveItem = {
        _id: d._id,
        companyName: d.companyName,
        jobLocation: d.jobLocation,
        companyDescription: d.companyDescription,
        department: d.department,
        driveScope: d.driveScope,
        driveType: d.driveType || (d.driveScope === 'college_wide' ? 'On-Campus' : 'Off-Campus'),
        offerType: d.offerType,
        internshipDurationMonths: d.internshipDurationMonths,
        stipend: d.stipend,
        eligibleDepartments: d.eligibleDepartments,
        minCGPA: d.minCGPA,
        standingArrearsAllowed: d.standingArrearsAllowed,
        maxStandingArrears: d.maxStandingArrears,
        historyArrearsAllowed: d.historyArrearsAllowed,
        maxHistoryArrears: d.maxHistoryArrears,
        optInDeadline: d.optInDeadline,
        maxRoleChoicesAllowed: d.maxRoleChoicesAllowed || 1,
        roles: d.roles || [],
        rounds: d.rounds || [],
        customFormFields: d.customFormFields || [],
        isEligible,
        ineligibilityReasons: reasons,
        hasOptedIn,
        hasOptedOut,
        isBlockedOrRemoved,
        isPastDeadline,
        selectedRoles: optRecord?.selectedRoles || [],
        evaluation: evalRecord ? {
          finalStatus: evalRecord.finalStatus,
          placedRole: evalRecord.placedRole,
          placedCTC: evalRecord.placedCTC,
          rounds: evalRecord.rounds,
        } : null,
      };

      if (d.driveScope === 'college_wide' || d.driveType === 'On-Campus') {
        // Placement officer drive
        driveItem.driveType = 'On-Campus';
        placementDrives.push(driveItem);
      } else {
        // Department coordinator drive
        driveItem.driveType = 'Off-Campus';
        departmentDrives.push(driveItem);
      }
    });

    return res.status(200).json({
      success: true,
      careerGoal: profile.careerGoal,
      studentCGPA,
      standingArrears,
      historyArrears,
      departmentDrives,
      placementDrives,
      policy,
    });
  } catch (error) {
    console.error('Error fetching student drives:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch drives', error: error.message });
  }
});

// Student Opt-In Endpoint
router.post('/drives/:id/opt-in', async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedRoles = [], customFormResponses = {} } = req.body;

    const profile = await getOrCreateProfile(req.user);

    // Career Goal Check
    if ((profile.careerGoal || '').toLowerCase() !== 'placement') {
      return res.status(400).json({
        success: false,
        message: `Your career goal is set to "${profile.careerGoal}". Only students with "Placement" career goal can opt-in to campus placement drives.`,
      });
    }

    const drive = await DepartmentDrive.findById(id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found' });
    }

    // Deadline Check
    if (drive.optInDeadline && new Date(drive.optInDeadline) < new Date()) {
      return res.status(400).json({ success: false, message: 'Opt-in deadline for this drive has passed.' });
    }

    // Eligibility validation
    if (drive.minCGPA > 0 && (profile.currentCGPA || 0) < drive.minCGPA) {
      return res.status(400).json({ success: false, message: `Minimum CGPA required is ${drive.minCGPA}. Your CGPA is ${profile.currentCGPA || 0}.` });
    }
    if (!drive.standingArrearsAllowed && (profile.standingArrearsCount || 0) > 0) {
      return res.status(400).json({ success: false, message: 'No standing arrears allowed for this drive.' });
    }
    if (drive.standingArrearsAllowed && (profile.standingArrearsCount || 0) > (drive.maxStandingArrears || 0)) {
      return res.status(400).json({ success: false, message: `Exceeds max standing arrears allowed (${drive.maxStandingArrears}).` });
    }
    if (!drive.historyArrearsAllowed && (profile.historyArrearsCount || 0) > 0) {
      return res.status(400).json({ success: false, message: 'No history of arrears allowed for this drive.' });
    }
    if (drive.historyArrearsAllowed && (profile.historyArrearsCount || 0) > (drive.maxHistoryArrears || 0)) {
      return res.status(400).json({ success: false, message: `Exceeds max history arrears allowed (${drive.maxHistoryArrears}).` });
    }

    // Role choices validation
    const maxRoles = drive.maxRoleChoicesAllowed || 1;
    if (selectedRoles.length > maxRoles) {
      return res.status(400).json({ success: false, message: `You can select at most ${maxRoles} role(s).` });
    }

    // Check post-placement policy for college_wide / On-Campus drives
    if (drive.driveScope === 'college_wide' || drive.driveType === 'On-Campus') {
      const policy = await PlacementPolicy.findOne({}).lean();
      if (policy && policy.maxOffersPerStudent) {
        const studentOffers = profile.placementOffers || [];
        if (studentOffers.length >= policy.maxOffersPerStudent) {
          // Check if dream policy applies
          const isDreamEligible = policy.allowDreamOffersAfterPlacement &&
            policy.dreamCompanyMinCTC &&
            (drive.roles || []).some(r => {
              const num = parseFloat(r.ctc);
              return num && num >= policy.dreamCompanyMinCTC;
            });

          if (!isDreamEligible) {
            return res.status(400).json({
              success: false,
              message: `You have already secured ${studentOffers.length} placement offer(s). Institution policy restricts further applications unless the offer is a Dream Category (min CTC ₹${policy.dreamCompanyMinCTC} LPA).`,
            });
          }
        }
      }
    }

    // Check existing opt-in record
    const existingIndex = (drive.optIns || []).findIndex(o =>
      String(o.studentId) === String(req.user._id) ||
      (o.rollNumber && o.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase())
    );

    const recordData = {
      studentId: req.user._id,
      rollNumber: profile.rollNumber,
      studentName: profile.name,
      email: profile.email,
      department: profile.department,
      section: profile.section,
      currentCGPA: profile.currentCGPA || 0,
      standingArrearsCount: profile.standingArrearsCount || 0,
      historyArrearsCount: profile.historyArrearsCount || 0,
      clearedArrearsCount: profile.clearedArrearsCount || 0,
      selectedRoles,
      customFormResponses,
      status: 'Opted-In',
      optedAt: new Date(),
    };

    if (existingIndex > -1) {
      const existingStatus = drive.optIns[existingIndex].status;
      if (existingStatus === 'Blocked' || existingStatus === 'Removed') {
        return res.status(403).json({
          success: false,
          message: `Your participation in this drive is currently marked as ${existingStatus}. Please contact the placement cell.`,
        });
      }
      drive.optIns[existingIndex] = recordData;
    } else {
      drive.optIns.push(recordData);
    }

    // Initialize roundEvaluation entry if not present
    const evalIndex = (drive.roundEvaluations || []).findIndex(e =>
      String(e.studentId) === String(req.user._id) ||
      (e.rollNumber && e.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase())
    );

    if (evalIndex === -1) {
      const initialRounds = (drive.rounds || []).map(r => ({
        roundNumber: r.roundNumber,
        roundName: r.roundName,
        status: 'Failed', // Standard initial state until updated
        remarks: 'Registered',
        updatedAt: new Date(),
      }));

      drive.roundEvaluations.push({
        studentId: req.user._id,
        rollNumber: profile.rollNumber,
        studentName: profile.name,
        department: profile.department,
        rounds: initialRounds,
        finalStatus: 'In Progress',
        placedRole: '',
        placedCTC: '',
      });
    }

    await drive.save();

    await createNotification({
      recipient: req.user._id,
      title: 'Opt-in Successful',
      message: `You have successfully opted-in for ${drive.companyName} recruitment drive.`,
      type: 'drive',
      metadata: { driveId: drive._id },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully opted-in for ${drive.companyName}!`,
      status: 'Opted-In',
    });
  } catch (error) {
    console.error('Error during student opt-in:', error);
    return res.status(500).json({ success: false, message: 'Failed to process opt-in', error: error.message });
  }
});

// Student Opt-Out Endpoint
router.post('/drives/:id/opt-out', async (req, res) => {
  try {
    const { id } = req.params;
    const profile = await getOrCreateProfile(req.user);

    const drive = await DepartmentDrive.findById(id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found' });
    }

    const optIndex = (drive.optIns || []).findIndex(o =>
      String(o.studentId) === String(req.user._id) ||
      (o.rollNumber && o.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase())
    );

    if (optIndex === -1) {
      return res.status(400).json({ success: false, message: 'You have not registered for this drive.' });
    }

    drive.optIns[optIndex].status = 'Opted-Out';

    // Mark evaluation as Not Placed
    const evalIndex = (drive.roundEvaluations || []).findIndex(e =>
      String(e.studentId) === String(req.user._id) ||
      (e.rollNumber && e.rollNumber.trim().toUpperCase() === (profile.rollNumber || '').trim().toUpperCase())
    );
    if (evalIndex > -1) {
      drive.roundEvaluations[evalIndex].finalStatus = 'Not Placed';
    }

    await drive.save();

    return res.status(200).json({
      success: true,
      message: `Successfully opted-out of ${drive.companyName}.`,
      status: 'Opted-Out',
    });
  } catch (error) {
    console.error('Error during student opt-out:', error);
    return res.status(500).json({ success: false, message: 'Failed to opt out', error: error.message });
  }
});

// ============================================================================
// 3. PLACEMENT UNWILLINGNESS FORM (FOR HIGHER STUDIES & ENTREPRENEURSHIP)
// ============================================================================
router.get('/unwillingness', async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user);
    const form = await PlacementUnwillingness.findOne({ isActive: true }).lean();

    if (!form) {
      return res.status(200).json({
        success: true,
        hasActiveForm: false,
        message: 'No active unwillingness form posted at this time.',
      });
    }

    // Check if this student already submitted
    const rollKey = (profile.rollNumber || '').trim().toUpperCase();
    const sub = (form.submissions || []).find(s =>
      String(s.studentId) === String(req.user._id) ||
      (s.rollNumber && s.rollNumber.trim().toUpperCase() === rollKey)
    );

    return res.status(200).json({
      success: true,
      hasActiveForm: true,
      form: {
        _id: form._id,
        title: form.title,
        instructions: form.instructions,
        sampleDocumentUrl: form.sampleDocumentUrl,
        deadline: form.deadline,
        customFields: form.customFields || [],
      },
      submission: sub || null,
      careerGoal: profile.careerGoal,
    });
  } catch (error) {
    console.error('Error fetching unwillingness form:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve form', error: error.message });
  }
});

router.post('/unwillingness', async (req, res) => {
  try {
    const {
      careerGoalChoice,
      higherStudiesDetails = {},
      entrepreneurshipDetails = {},
      reasonForUnwillingness,
      signedFormAttachment = '',
      parentAcknowledgmentAttached = true,
      customResponses = {},
    } = req.body;

    const profile = await getOrCreateProfile(req.user);

    if (!careerGoalChoice || !['Higher Studies', 'Entrepreneurship'].includes(careerGoalChoice)) {
      return res.status(400).json({ success: false, message: 'Valid careerGoalChoice (Higher Studies or Entrepreneurship) is required.' });
    }

    if (!reasonForUnwillingness || !reasonForUnwillingness.trim()) {
      return res.status(400).json({ success: false, message: 'Reason for placement unwillingness is required.' });
    }

    const form = await PlacementUnwillingness.findOne({ isActive: true });
    if (!form) {
      return res.status(404).json({ success: false, message: 'No active unwillingness form found.' });
    }

    const rollKey = (profile.rollNumber || '').trim().toUpperCase();
    const existingIndex = (form.submissions || []).findIndex(s =>
      String(s.studentId) === String(req.user._id) ||
      (s.rollNumber && s.rollNumber.trim().toUpperCase() === rollKey)
    );

    const submissionData = {
      studentId: req.user._id,
      rollNumber: profile.rollNumber,
      name: profile.name,
      email: profile.email,
      department: profile.department,
      careerGoalChoice,
      higherStudiesDetails,
      entrepreneurshipDetails,
      reasonForUnwillingness,
      signedFormAttachment,
      parentAcknowledgmentAttached,
      customResponses,
      isLocked: true, // Cannot switch back without permission
      allowPlacementSwitch: false,
      submittedAt: new Date(),
    };

    if (existingIndex > -1) {
      // Check if existing is locked
      if (form.submissions[existingIndex].isLocked && !form.submissions[existingIndex].allowPlacementSwitch) {
        return res.status(403).json({
          success: false,
          message: 'Your placement unwillingness form has already been submitted and is locked. Contact the Placement Officer to request changes.',
        });
      }
      form.submissions[existingIndex] = submissionData;
    } else {
      form.submissions.push(submissionData);
    }

    await form.save();

    // Update Student Profile career goal and path details
    profile.careerGoal = careerGoalChoice;
    if (careerGoalChoice === 'Higher Studies') {
      profile.higherStudiesDetails = {
        ...profile.higherStudiesDetails,
        ...higherStudiesDetails,
      };
    } else if (careerGoalChoice === 'Entrepreneurship') {
      profile.entrepreneurshipDetails = {
        ...profile.entrepreneurshipDetails,
        ...entrepreneurshipDetails,
      };
    }
    // Nil out placement data
    profile.isPlaced = 'No';
    profile.placedCompany = '';
    profile.salaryPackage = 0;
    await profile.save();

    await createNotification({
      recipient: req.user._id,
      title: 'Unwillingness Form Submitted',
      message: `Your undertaking for ${careerGoalChoice} has been recorded. Campus placement drives are now bypassed.`,
      type: 'system',
    });

    return res.status(200).json({
      success: true,
      message: 'Placement Unwillingness Undertaking submitted successfully and registered in institutional records.',
      submission: submissionData,
    });
  } catch (error) {
    console.error('Error submitting unwillingness form:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit unwillingness form', error: error.message });
  }
});

// ============================================================================
// 4. CENTRALIZED COMMUNICATION CHANNELS FOR STUDENTS
// ============================================================================
router.get('/communication/messages', async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user);
    const { channel = 'all', search = '' } = req.query;

    const studentDept = (profile.department || req.user.department || '').toUpperCase();
    const query = {};

    // Channel filter
    if (channel && channel !== 'all') {
      query.channel = channel;
    }

    // Role-based visibility for students
    // 1. Placement Announcements: all students can read
    // 2. Placement Queries: all students can read and post
    // 3. Department Channel: only students of this department
    // 4. Mentorship Channel: only mentees of assigned mentor
    // 5. General Channel: all
    query.$or = [
      { channel: { $in: ['placement_announcements', 'placement_queries', 'general_channel', 'general'] } },
      { channel: 'department_channel', department: { $regex: new RegExp(`^${studentDept}$`, 'i') } },
      { channel: 'mentorship_channel', targetGroup: { $in: ['all', 'mentees'] }, department: { $regex: new RegExp(`^${studentDept}$`, 'i') } },
    ];

    if (search && search.trim()) {
      const q = search.trim();
      query.$and = [
        {
          $or: [
            { subject: { $regex: q, $options: 'i' } },
            { content: { $regex: q, $options: 'i' } },
            { 'sender.name': { $regex: q, $options: 'i' } },
          ],
        },
      ];
    }

    const messages = await CommunicationMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error('Error fetching student communication messages:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
  }
});

router.post('/communication/messages', async (req, res) => {
  try {
    const { channel, subject, content, priority = 'Normal', driveId = null } = req.body;
    const profile = await getOrCreateProfile(req.user);

    // Read-only check: students cannot broadcast in placement_announcements
    if (channel === 'placement_announcements') {
      return res.status(403).json({
        success: false,
        message: 'Placement Announcements channel is broadcast-only by the Placement Officer. Post your questions in Placement Queries.',
      });
    }

    if (!subject || !content) {
      return res.status(400).json({ success: false, message: 'Subject and content are required.' });
    }

    const newMessage = new CommunicationMessage({
      sender: {
        userId: req.user._id,
        name: profile.name || req.user.name,
        email: profile.email || req.user.email,
        role: 'student',
      },
      department: profile.department || req.user.department || 'CSE',
      messageType: channel === 'placement_queries' ? 'enquiry' : 'message',
      channel: channel || 'general_channel',
      driveId: driveId || null,
      subject,
      content,
      priority,
      targetGroup: 'all',
      isReadOnly: false,
    });

    await newMessage.save();

    return res.status(201).json({
      success: true,
      message: 'Message posted successfully',
      communication: newMessage,
    });
  } catch (error) {
    console.error('Error posting student message:', error);
    return res.status(500).json({ success: false, message: 'Failed to post message', error: error.message });
  }
});

router.post('/communication/messages/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const profile = await getOrCreateProfile(req.user);

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const message = await CommunicationMessage.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const reply = {
      sender: {
        userId: req.user._id,
        name: profile.name || req.user.name,
        role: 'student',
      },
      content: content.trim(),
      createdAt: new Date(),
    };

    message.replies.push(reply);
    await message.save();

    // Notify original sender
    if (String(message.sender.userId) !== String(req.user._id)) {
      await createNotification({
        recipient: message.sender.userId,
        title: 'New Reply Received',
        message: `${profile.name} replied to your message: "${message.subject}"`,
        type: 'communication',
        metadata: { messageId: message._id },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reply sent successfully',
      replies: message.replies,
    });
  } catch (error) {
    console.error('Error replying to message:', error);
    return res.status(500).json({ success: false, message: 'Failed to send reply', error: error.message });
  }
});

module.exports = router;
