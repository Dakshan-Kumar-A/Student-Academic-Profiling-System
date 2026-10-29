const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DepartmentDrive = require('../models/DepartmentDrive');
const CommunicationMessage = require('../models/CommunicationMessage');
const SystemLog = require('../models/SystemLog');
const { protect, authorize } = require('../middleware/auth');
const { generateTempPassword, sendTempPasswordEmail } = require('../utils/mailer');
const { logSystemEvent } = require('../utils/logger');
const { createNotification, createBulkNotifications } = require('../services/notificationService');

// Setup multer memory storage for excel file parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid Excel (.xlsx, .xls) or CSV file.'));
    }
  },
});

// All routes here require Department Coordinator or Admin role
router.use(protect);
router.use(authorize('department_coordinator', 'admin'));

// Helper: Ensure the coordinator operates on their assigned department
const getCoordinatorDept = (req) => {
  return req.user.department || '';
};

// ==========================================
// 1. COMPREHENSIVE ANALYTICS DASHBOARD (PROBLEM STATEMENT ALIGNED)
// ==========================================
router.get('/analytics', async (req, res) => {
  try {
    const dept = req.query.department || getCoordinatorDept(req);
    const andClauses = [];

    if (dept && dept !== 'all') {
      andClauses.push({
        $or: [
          { department: { $regex: new RegExp(`^${dept}$`, 'i') } },
          { department: dept },
        ],
      });
    }

    // Search by name, rollNumber, email
    if (req.query.search && req.query.search.trim()) {
      const q = req.query.search.trim();
      andClauses.push({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { rollNumber: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      });
    }

    // Optional dynamic dashboard filters
    if (req.query.section && req.query.section !== 'all') {
      andClauses.push({ section: req.query.section });
    }
    if (req.query.studentCategory && req.query.studentCategory !== 'all') {
      andClauses.push({ studentCategory: req.query.studentCategory });
    }
    if (req.query.batch && req.query.batch !== 'all') {
      andClauses.push({ batch: req.query.batch });
    }
    // Requirement 2: Career Goal and its conditional sub-filters
    if (req.query.careerGoal && req.query.careerGoal !== 'all') {
      andClauses.push({ 'careerGoal.primaryGoal': req.query.careerGoal });

      if (req.query.careerGoal === 'Placement') {
        if (req.query.isPlaced !== undefined && req.query.isPlaced !== '' && req.query.isPlaced !== 'all') {
          andClauses.push({ 'placementStatus.isPlaced': req.query.isPlaced === 'true' });
        }
        if (req.query.placementType && req.query.placementType !== 'all') {
          andClauses.push({ 'placementStatus.placementType': req.query.placementType });
        }
        if (req.query.domainInterest && req.query.domainInterest !== 'all') {
          andClauses.push({ 'technicalProfile.domainInterest': { $regex: req.query.domainInterest, $options: 'i' } });
        }
      } else if (req.query.careerGoal === 'Higher Studies') {
        if (req.query.studyLocation && req.query.studyLocation !== 'all') {
          andClauses.push({ 'careerGoal.higherStudies.studyLocation': req.query.studyLocation });
        }
      } else if (req.query.careerGoal === 'Entrepreneurship') {
        if (req.query.startupStage && req.query.startupStage !== 'all') {
          andClauses.push({ 'careerGoal.entrepreneurship.currentStage': req.query.startupStage });
        }
      }
    }

    // Requirement 2 & 3: Arrear Status - Standing vs History Arrears as separate entities
    const { arrearFilter, hasArrears, arrearCount, arrearStatusType } = req.query;
    const effectiveArrearFilter = arrearFilter || (hasArrears === 'yes' ? 'standing' : hasArrears === 'no' ? 'none' : 'all');

    if (effectiveArrearFilter === 'none') {
      // Clean academic record - zero standing arrears AND zero history
      andClauses.push({
        $and: [
          {
            $or: [
              { standingArrearsCount: 0 },
              { standingArrearsCount: { $exists: false } },
              { standingArrearsCount: null },
            ],
          },
          {
            $or: [
              { arrears: { $size: 0 } },
              { arrears: { $exists: false } },
              { arrears: null },
              { historyArrearsCount: 0 },
              { historyArrearsCount: { $exists: false } },
              { historyArrearsCount: null },
            ],
          },
        ],
      });
    } else if (effectiveArrearFilter === 'standing') {
      // Has standing/pending arrears
      let countQuery = { $gt: 0 };
      if (arrearCount && arrearCount !== 'all') {
        if (arrearCount === '3+') countQuery = { $gte: 3 };
        else countQuery = Number(arrearCount);
      }
      andClauses.push({ standingArrearsCount: countQuery });

      if (arrearStatusType === 'cleared') {
        andClauses.push({ 'arrears.currentStatus': 'Cleared' });
      } else if (arrearStatusType === 'standing') {
        andClauses.push({ 'arrears.currentStatus': 'Pending' });
      }
    } else if (effectiveArrearFilter === 'history') {
      // Has history of arrears (either standing active or previously cleared)
      andClauses.push({
        $or: [
          { standingArrearsCount: { $gt: 0 } },
          { historyArrearsCount: { $gt: 0 } },
          { arrears: { $exists: true, $not: { $size: 0 } } },
        ],
      });

      if (arrearStatusType === 'cleared') {
        andClauses.push({
          $or: [
            { standingArrearsCount: 0 },
            { standingArrearsCount: { $exists: false } },
            { standingArrearsCount: null },
          ],
        });
        andClauses.push({ 'arrears.currentStatus': 'Cleared' });
      } else if (arrearStatusType === 'standing') {
        andClauses.push({ standingArrearsCount: { $gt: 0 } });
      }

      if (arrearCount && arrearCount !== 'all') {
        if (arrearStatusType === 'cleared') {
          andClauses.push({ clearedArrearsCount: arrearCount === '3+' ? { $gte: 3 } : Number(arrearCount) });
        } else {
          andClauses.push({
            $or: [
              { standingArrearsCount: arrearCount === '3+' ? { $gte: 3 } : Number(arrearCount) },
              { historyArrearsCount: arrearCount === '3+' ? { $gte: 3 } : Number(arrearCount) },
            ],
          });
        }
      }
    }

    if (req.query.mentorStatus === 'assigned') {
      andClauses.push({ mentorId: { $ne: null } });
    } else if (req.query.mentorStatus === 'unassigned') {
      andClauses.push({ $or: [{ mentorId: null }, { mentorId: { $exists: false } }] });
    }

    if (req.query.cgpaMin || req.query.cgpaMax) {
      const cgpaRange = {};
      if (req.query.cgpaMin) cgpaRange.$gte = Number(req.query.cgpaMin);
      if (req.query.cgpaMax) cgpaRange.$lte = Number(req.query.cgpaMax);
      andClauses.push({ currentCGPA: cgpaRange });
    }

    if (req.query.cgpaBracket && req.query.cgpaBracket !== 'all') {
      if (req.query.cgpaBracket === '9+') andClauses.push({ currentCGPA: { $gte: 9.0 } });
      else if (req.query.cgpaBracket === '8-9') andClauses.push({ currentCGPA: { $gte: 8.0, $lt: 9.0 } });
      else if (req.query.cgpaBracket === '7-8') andClauses.push({ currentCGPA: { $gte: 7.0, $lt: 8.0 } });
      else if (req.query.cgpaBracket === '6-7') andClauses.push({ currentCGPA: { $gte: 6.0, $lt: 7.0 } });
      else if (req.query.cgpaBracket === '<6') andClauses.push({ currentCGPA: { $lt: 6.0 } });
    }

    const filter = andClauses.length > 0 ? { $and: andClauses } : {};

    const profiles = await StudentProfile.find(filter)
      .populate('mentorId', 'name email')
      .lean();

    const totalStudents = profiles.length;

    if (totalStudents === 0) {
      return res.status(200).json({
        success: true,
        analytics: {
          totalStudents: 0,
          placedCount: 0,
          unplacedCount: 0,
          placementPercentage: 0,
          onCampusCount: 0,
          offCampusCount: 0,
          averageCGPA: 0,
          highestCGPA: 0,
          lowestCGPA: 0,
          standingArrearsCount: 0,
          clearedArrearsCount: 0,
          studentsWithArrears: 0,
          zeroArrearCount: 0,
          remedialSupportCount: 0,
          improvingStudentsCount: 0,
          decliningStudentsCount: 0,
          improvingStudents: [],
          decliningStudents: [],
          remedialStudents: [],
          mentorInterventionCount: 0,
          mentorInterventionStudents: [],
          semesterAverageSGPA: [],
          subjectArrearHotspots: [],
          cgpaDistribution: { '>= 9.0': 0, '8.0 - 8.99': 0, '7.0 - 7.99': 0, '6.0 - 6.99': 0, '< 6.0': 0 },
          placementTypeDistribution: { 'On-Campus': 0, 'Off-Campus': 0, 'Unplaced': 0 },
          salaryDistribution: { '< 5 LPA': 0, '5 - 8 LPA': 0, '8 - 12 LPA': 0, '12+ LPA': 0 },
          careerGoals: { placement: 0, higherStudies: 0, entrepreneurship: 0, undecided: 0 },
          higherStudiesLocation: { india: 0, abroad: 0 },
          hostellerCount: 0,
          dayScholarCount: 0,
          assignedMentorsCount: 0,
          unassignedMentorsCount: 0,
          domainInterests: {},
          skillGaps: {
            withoutCertifications: 0,
            withoutProjects: 0,
            withoutProfiles: 0,
          },
          filteredStudents: [],
        },
      });
    }

    let placedCount = 0;
    let onCampusCount = 0;
    let offCampusCount = 0;
    let totalCGPA = 0;
    let highestCGPA = 0;
    let lowestCGPA = 10;
    let standingArrearsCount = 0;
    let historyArrearsCount = 0;
    let clearedArrearsCount = 0;
    let studentsWithStandingArrears = 0;
    let studentsWithHistoryArrears = 0;
    let studentsWithArrears = 0;
    let zeroArrearCount = 0;
    let remedialSupportCount = 0;
    let hostellerCount = 0;
    let dayScholarCount = 0;
    let assignedMentorsCount = 0;
    let unassignedMentorsCount = 0;

    let withoutCertifications = 0;
    let withoutProjects = 0;
    let withoutProfiles = 0;

    const salaryDistribution = { '< 5 LPA': 0, '5 - 8 LPA': 0, '8 - 12 LPA': 0, '12+ LPA': 0 };
    const cgpaDistribution = { '>= 9.0': 0, '8.0 - 8.99': 0, '7.0 - 7.99': 0, '6.0 - 6.99': 0, '< 6.0': 0 };
    const careerGoals = { placement: 0, higherStudies: 0, entrepreneurship: 0, undecided: 0 };
    const higherStudiesLocation = { india: 0, abroad: 0 };
    const domainInterests = {};

    // Semester-wise SGPA accumulators
    const semSGPAMap = {}; // { semNumber: { totalSGPA: 0, count: 0 } }
    const subjectArrearMap = {}; // { subjectCode: { subjectName, totalArrears, pendingCount, clearedCount } }

    const improvingStudents = [];
    const decliningStudents = [];
    const remedialStudents = [];
    const mentorInterventionStudents = [];

    profiles.forEach((p) => {
      // 1. Placement & Packages
      if (p.placementStatus?.isPlaced) {
        placedCount++;
        if (p.placementStatus.placementType === 'On-Campus') onCampusCount++;
        if (p.placementStatus.placementType === 'Off-Campus') offCampusCount++;

        const pkg = p.placementStatus.packageCTC || 0;
        if (pkg > 0) {
          if (pkg < 5) salaryDistribution['< 5 LPA']++;
          else if (pkg <= 8) salaryDistribution['5 - 8 LPA']++;
          else if (pkg <= 12) salaryDistribution['8 - 12 LPA']++;
          else salaryDistribution['12+ LPA']++;
        }
      }

      // 2. CGPA
      const cgpa = p.currentCGPA || 0;
      totalCGPA += cgpa;
      if (cgpa > highestCGPA) highestCGPA = cgpa;
      if (cgpa < lowestCGPA && cgpa > 0) lowestCGPA = cgpa;

      if (cgpa >= 9.0) cgpaDistribution['>= 9.0']++;
      else if (cgpa >= 8.0) cgpaDistribution['8.0 - 8.99']++;
      else if (cgpa >= 7.0) cgpaDistribution['7.0 - 7.99']++;
      else if (cgpa >= 6.0) cgpaDistribution['6.0 - 6.99']++;
      else if (cgpa > 0) cgpaDistribution['< 6.0']++;

      // 3. Arrears & Remedial Support (Standing vs History Arrears as separate entities)
      const activeArrears = p.standingArrearsCount || 0;
      const allTimeArrears = Array.isArray(p.arrears) ? p.arrears.length : (p.historyArrearsCount || activeArrears);
      standingArrearsCount += activeArrears;
      historyArrearsCount += allTimeArrears;
      if (activeArrears > 0) {
        studentsWithStandingArrears++;
        studentsWithArrears++;
      } else {
        zeroArrearCount++;
      }
      if (allTimeArrears > 0) {
        studentsWithHistoryArrears++;
      }

      let hasRemedial = false;
      if (Array.isArray(p.arrears)) {
        p.arrears.forEach((a) => {
          if (a.currentStatus === 'Cleared') clearedArrearsCount++;
          if (a.remedialSupportRequired === 'Yes') hasRemedial = true;

          // Track subject hotspots
          const subKey = (a.subjectCode || 'UNKNOWN').trim().toUpperCase();
          if (!subjectArrearMap[subKey]) {
            subjectArrearMap[subKey] = {
              subjectCode: subKey,
              subjectName: a.subjectName || subKey,
              totalArrears: 0,
              pendingCount: 0,
              clearedCount: 0,
            };
          }
          subjectArrearMap[subKey].totalArrears++;
          if (a.currentStatus === 'Pending') subjectArrearMap[subKey].pendingCount++;
          else subjectArrearMap[subKey].clearedCount++;
        });
      }

      if (hasRemedial) {
        remedialSupportCount++;
        remedialStudents.push({
          id: p._id,
          name: p.name,
          rollNumber: p.rollNumber,
          section: p.section,
          standingArrears: p.standingArrearsCount,
        });
      }

      // 4. Semester Progression Analysis (Improvement vs Decline)
      if (Array.isArray(p.semesters) && p.semesters.length > 0) {
        const sortedSems = [...p.semesters].sort((a, b) => a.semesterNumber - b.semesterNumber);

        sortedSems.forEach((s) => {
          if (s.sgpa > 0) {
            if (!semSGPAMap[s.semesterNumber]) {
              semSGPAMap[s.semesterNumber] = { semester: s.semesterNumber, totalSGPA: 0, count: 0 };
            }
            semSGPAMap[s.semesterNumber].totalSGPA += s.sgpa;
            semSGPAMap[s.semesterNumber].count++;
          }
        });

        if (sortedSems.length >= 2) {
          const last = sortedSems[sortedSems.length - 1];
          const prev = sortedSems[sortedSems.length - 2];

          if (last.sgpa > prev.sgpa && last.sgpa > 0 && prev.sgpa > 0) {
            improvingStudents.push({
              id: p._id,
              name: p.name,
              rollNumber: p.rollNumber,
              currentCGPA: p.currentCGPA,
              prevSGPA: prev.sgpa,
              latestSGPA: last.sgpa,
              diff: +(last.sgpa - prev.sgpa).toFixed(2),
            });
          } else if (last.sgpa < prev.sgpa && last.sgpa > 0 && prev.sgpa > 0) {
            decliningStudents.push({
              id: p._id,
              name: p.name,
              rollNumber: p.rollNumber,
              currentCGPA: p.currentCGPA,
              prevSGPA: prev.sgpa,
              latestSGPA: last.sgpa,
              diff: +(prev.sgpa - last.sgpa).toFixed(2),
              mentorName: p.mentorId?.name || 'Unassigned',
            });
          }
        }
      }

      // 5. Readiness & Portfolio Gaps
      const certs = p.technicalProfile?.certifications || [];
      if (certs.length === 0) withoutCertifications++;

      const projs = p.technicalProfile?.projects || [];
      if (projs.length === 0) withoutProjects++;

      const links = p.technicalProfile?.profileLinks || {};
      if (!links.github && !links.linkedin) withoutProfiles++;

      // 6. Mentor Intervention Flags
      if (
        (activeArrears >= 2) ||
        (cgpa > 0 && cgpa < 6.5) ||
        hasRemedial
      ) {
        mentorInterventionStudents.push({
          id: p._id,
          name: p.name,
          rollNumber: p.rollNumber,
          section: p.section,
          cgpa: p.currentCGPA,
          standingArrears: activeArrears,
          assignedMentor: p.mentorId?.name || 'Unassigned',
          reason: activeArrears >= 2
            ? `${activeArrears} Standing Arrears`
            : hasRemedial
            ? 'Remedial Support Required'
            : 'Low CGPA (< 6.5)',
        });
      }

      // 7. Category & Mentorship
      if (p.studentCategory === 'Hosteller') hostellerCount++;
      else dayScholarCount++;

      if (p.mentorId) assignedMentorsCount++;
      else unassignedMentorsCount++;

      // 8. Career Goals
      const goal = p.careerGoal?.primaryGoal;
      if (goal === 'Placement') careerGoals.placement++;
      else if (goal === 'Higher Studies') {
        careerGoals.higherStudies++;
        if (p.careerGoal?.higherStudies?.studyLocation === 'Abroad') {
          higherStudiesLocation.abroad++;
        } else {
          higherStudiesLocation.india++;
        }
      } else if (goal === 'Entrepreneurship') careerGoals.entrepreneurship++;
      else careerGoals.undecided++;

      // 9. Domain Interests
      const domain = p.technicalProfile?.domainInterest;
      if (domain) {
        domainInterests[domain] = (domainInterests[domain] || 0) + 1;
      }
    });

    // Compute Semester Average SGPA Curve
    const semesterAverageSGPA = Object.values(semSGPAMap)
      .map((item) => ({
        semester: `Semester ${item.semester}`,
        semNumber: item.semester,
        averageSGPA: Number((item.totalSGPA / item.count).toFixed(2)),
        studentCount: item.count,
      }))
      .sort((a, b) => a.semNumber - b.semNumber);

    // Sort Top 8 Arrear Bottleneck Subjects
    const subjectArrearHotspots = Object.values(subjectArrearMap)
      .sort((a, b) => b.totalArrears - a.totalArrears)
      .slice(0, 8);

    const averageCGPA = (totalCGPA / totalStudents).toFixed(2);
    const placementPercentage = ((placedCount / totalStudents) * 100).toFixed(1);

    // Filtered Students for instant identification on Analytics Dashboard
    const filteredStudents = profiles.map((p) => ({
      _id: p._id,
      rollNumber: p.rollNumber,
      name: p.name,
      email: p.email,
      section: p.section || 'A',
      studentCategory: p.studentCategory || 'Day Scholar',
      currentCGPA: p.currentCGPA || 0,
      standingArrearsCount: p.standingArrearsCount || 0,
      historyArrearsCount: Array.isArray(p.arrears) ? p.arrears.length : (p.historyArrearsCount || 0),
      clearedArrearsCount: Array.isArray(p.arrears) ? p.arrears.filter((a) => a.currentStatus === 'Cleared').length : 0,
      placementStatus: p.placementStatus,
      careerGoal: p.careerGoal,
      technicalProfile: p.technicalProfile,
      mentor: p.mentorId ? { _id: p.mentorId._id, name: p.mentorId.name, email: p.mentorId.email } : null,
      fullProfile: p,
    }));

    return res.status(200).json({
      success: true,
      analytics: {
        totalStudents,
        placedCount,
        unplacedCount: totalStudents - placedCount,
        placementPercentage: Number(placementPercentage),
        onCampusCount,
        offCampusCount,
        averageCGPA: Number(averageCGPA),
        highestCGPA: Number(highestCGPA.toFixed(2)),
        lowestCGPA: lowestCGPA === 10 ? 0 : Number(lowestCGPA.toFixed(2)),
        standingArrearsCount,
        historyArrearsCount,
        clearedArrearsCount,
        studentsWithArrears: studentsWithStandingArrears,
        studentsWithStandingArrears,
        studentsWithHistoryArrears,
        zeroArrearCount,
        remedialSupportCount,
        improvingStudentsCount: improvingStudents.length,
        decliningStudentsCount: decliningStudents.length,
        improvingStudents: improvingStudents.slice(0, 10),
        decliningStudents: decliningStudents.slice(0, 10),
        remedialStudents: remedialStudents.slice(0, 10),
        mentorInterventionCount: mentorInterventionStudents.length,
        mentorInterventionStudents: mentorInterventionStudents.slice(0, 15),
        semesterAverageSGPA,
        subjectArrearHotspots,
        cgpaDistribution,
        placementTypeDistribution: {
          'On-Campus Placed': onCampusCount,
          'Off-Campus Placed': offCampusCount,
          'Unplaced': totalStudents - placedCount,
        },
        salaryDistribution,
        careerGoals,
        higherStudiesLocation,
        hostellerCount,
        dayScholarCount,
        assignedMentorsCount,
        unassignedMentorsCount,
        domainInterests,
        skillGaps: {
          withoutCertifications,
          withoutProjects,
          withoutProfiles,
        },
        filteredStudents,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. CRUD STUDENTS
// ==========================================

// Build search & multi-filter query for students
const buildStudentFilterQuery = (dept, queryParams) => {
  const query = {};
  if (dept) query.department = dept;

  const {
    search,
    cgpaMin,
    cgpaMax,
    isPlaced,
    placementType,
    hasArrears,
    minArrears,
    maxArrears,
    careerGoal,
    studyLocation,
    domainInterest,
    studentCategory,
    section,
    mentorId,
  } = queryParams;

  // Search keyword (name, rollNumber, email)
  if (search && search.trim() !== '') {
    const term = search.trim();
    query.$or = [
      { name: { $regex: term, $options: 'i' } },
      { rollNumber: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ];
  }

  // CGPA range
  if (cgpaMin !== undefined && cgpaMin !== '' || cgpaMax !== undefined && cgpaMax !== '') {
    query.currentCGPA = {};
    if (cgpaMin !== undefined && cgpaMin !== '') query.currentCGPA.$gte = Number(cgpaMin);
    if (cgpaMax !== undefined && cgpaMax !== '') query.currentCGPA.$lte = Number(cgpaMax);
  }

  // Placed / Not placed
  if (isPlaced !== undefined && isPlaced !== '') {
    query['placementStatus.isPlaced'] = isPlaced === 'true' || isPlaced === true;
  }

  // Placement Type: On-Campus vs Off-Campus
  if (placementType && ['On-Campus', 'Off-Campus', 'None'].includes(placementType)) {
    query['placementStatus.placementType'] = placementType;
  }

  // Standing Arrears filter
  if (hasArrears !== undefined && hasArrears !== '') {
    if (hasArrears === 'true' || hasArrears === true) {
      query.standingArrearsCount = { $gt: 0 };
    } else {
      query.standingArrearsCount = 0;
    }
  }

  // Arrears range
  if (minArrears !== undefined && minArrears !== '' || maxArrears !== undefined && maxArrears !== '') {
    query.standingArrearsCount = query.standingArrearsCount || {};
    if (minArrears !== undefined && minArrears !== '') query.standingArrearsCount.$gte = Number(minArrears);
    if (maxArrears !== undefined && maxArrears !== '') query.standingArrearsCount.$lte = Number(maxArrears);
  }

  // Career Goal
  if (careerGoal && ['Placement', 'Higher Studies', 'Entrepreneurship', 'Undecided'].includes(careerGoal)) {
    query['careerGoal.primaryGoal'] = careerGoal;
  }

  // Higher studies destination
  if (studyLocation && ['India', 'Abroad'].includes(studyLocation)) {
    query['careerGoal.higherStudies.studyLocation'] = studyLocation;
  }

  // Domain interest
  if (domainInterest && domainInterest.trim() !== '') {
    query['technicalProfile.domainInterest'] = { $regex: domainInterest.trim(), $options: 'i' };
  }

  // Category
  if (studentCategory && ['Hosteller', 'Day Scholar'].includes(studentCategory)) {
    query.studentCategory = studentCategory;
  }

  // Section
  if (section && section.trim() !== '') {
    query.section = section.trim();
  }

  // Mentor assignment filter
  if (mentorId) {
    if (mentorId === 'unassigned') {
      query.mentorId = null;
    } else {
      query.mentorId = mentorId;
    }
  }

  return query;
};

// @route   GET /api/coordinator/students
// @desc    Get filtered students list with pagination
router.get('/students', async (req, res) => {
  try {
    const dept = req.query.department || getCoordinatorDept(req);
    const query = buildStudentFilterQuery(dept, req.query);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [students, totalCount] = await Promise.all([
      StudentProfile.find(query)
        .populate('mentorId', 'name email')
        .sort({ rollNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StudentProfile.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      students,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/coordinator/students/:id
// @desc    Get complete individual student profile
router.get('/students/:id', async (req, res) => {
  try {
    const student = await StudentProfile.findById(req.params.id)
      .populate('userId', 'email status lastLogin')
      .populate('mentorId', 'name email department');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/students
// @desc    Add single student (name, rollNumber, email, department) & send 24-hr temp password
router.post('/students', async (req, res) => {
  const { name, rollNumber, email, department, section, studentCategory } = req.body;
  const dept = department || getCoordinatorDept(req);

  if (!name || !rollNumber || !email) {
    return res.status(400).json({
      success: false,
      message: 'Name, roll number, and email are mandatory fields.',
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const cleanRoll = rollNumber.trim().toUpperCase();

    // Check email uniqueness
    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: `An account with email '${normalizedEmail}' already exists.`,
      });
    }

    // Check roll number uniqueness
    const rollExists = await StudentProfile.findOne({ rollNumber: cleanRoll });
    if (rollExists) {
      return res.status(400).json({
        success: false,
        message: `A student with roll number '${cleanRoll}' already exists.`,
      });
    }

    // Generate single-use 24-hr temporary password
    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    const codeHash = await bcrypt.hash(tempPassword, salt);

    // Create User record
    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'student',
      rollNumber: cleanRoll,
      department: dept,
      status: 'active',
      mustChangePassword: true,
      tempPassword: {
        codeHash,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        isUsed: false,
        purpose: 'account_creation',
      },
    });
    await user.save();

    // Create StudentProfile record
    const profile = new StudentProfile({
      userId: user._id,
      rollNumber: cleanRoll,
      name: name.trim(),
      email: normalizedEmail,
      department: dept,
      section: section ? section.trim().toUpperCase() : 'A',
      studentCategory: studentCategory || 'Day Scholar',
      currentCGPA: 0,
      standingArrearsCount: 0,
    });
    await profile.save();

    // Dispatch welcome email
    let emailResult = { previewUrl: null };
    try {
      emailResult = await sendTempPasswordEmail({
        toEmail: user.email,
        recipientName: user.name,
        tempPassword,
        purpose: 'account_creation',
      });
    } catch (mailErr) {
      console.warn(`Could not dispatch email to student ${user.email}:`, mailErr.message);
    }

    await logSystemEvent({
      level: 'info',
      module: 'user_management',
      action: 'STUDENT_CREATED',
      message: `Coordinator '${req.user.name}' registered student '${user.name}' (${user.rollNumber})`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      targetUser: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Student '${name}' (${cleanRoll}) created successfully. Invitation email dispatched.`,
      student: profile,
      previewUrl: emailResult.previewUrl,
      demoTempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/coordinator/students/:id
// @desc    Update student details
router.put('/students/:id', async (req, res) => {
  try {
    const profile = await StudentProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const {
      name,
      rollNumber,
      email,
      section,
      batch,
      studentCategory,
      hostelName,
      distanceFromCollege,
      mentorId,
      currentCGPA,
      placementStatus,
      careerGoal,
    } = req.body;

    if (name) profile.name = name.trim();
    if (rollNumber) profile.rollNumber = rollNumber.trim().toUpperCase();
    if (section) profile.section = section.trim().toUpperCase();
    if (batch) profile.batch = batch.trim();
    if (studentCategory) profile.studentCategory = studentCategory;
    if (hostelName !== undefined) profile.hostelName = hostelName;
    if (distanceFromCollege !== undefined) profile.distanceFromCollege = Number(distanceFromCollege);
    if (mentorId !== undefined) profile.mentorId = mentorId ? mentorId : null;
    if (currentCGPA !== undefined) profile.currentCGPA = Number(currentCGPA);
    if (placementStatus) profile.placementStatus = { ...profile.placementStatus, ...placementStatus };
    if (careerGoal) profile.careerGoal = { ...profile.careerGoal, ...careerGoal };

    // Update email in User model if changed
    if (email && email.toLowerCase().trim() !== profile.email) {
      const existing = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: profile.userId } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already used by another user.' });
      }
      profile.email = email.toLowerCase().trim();
      await User.findByIdAndUpdate(profile.userId, { email: profile.email, name: profile.name, rollNumber: profile.rollNumber });
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Student profile updated successfully.',
      student: profile,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/coordinator/students/:id/remarks
// @desc    Update mentor & coordinator remarks for QS I-Gauge Excel 1 & Student Profiling
router.put('/students/:id/remarks', async (req, res) => {
  try {
    const { placementRemarks, entrepreneurshipRemarks, higherStudiesRemarks, generalRemarks } = req.body;
    const profile = await StudentProfile.findById(req.params.id);
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

// @route   DELETE /api/coordinator/students/:id
// @desc    Delete student profile and associated user
router.delete('/students/:id', async (req, res) => {
  try {
    const profile = await StudentProfile.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    const userId = profile.userId;
    await StudentProfile.findByIdAndDelete(req.params.id);
    if (userId) {
      await User.findByIdAndDelete(userId);
    }

    await logSystemEvent({
      level: 'warn',
      module: 'user_management',
      action: 'STUDENT_DELETED',
      message: `Coordinator '${req.user.name}' deleted student '${profile.name}' (${profile.rollNumber})`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Student '${profile.name}' has been permanently deleted.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/students/bulk-upload
// @desc    Bulk create students from Excel (.xlsx/.xls/.csv) with template parsing
router.post('/students/bulk-upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an Excel or CSV file.' });
  }

  const dept = req.body.department || getCoordinatorDept(req);

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'The uploaded file is empty.' });
    }

    const results = {
      totalRows: rows.length,
      createdCount: 0,
      skippedCount: 0,
      createdStudents: [],
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = (row.Name || row.name || row['Student Name'] || '').toString().trim();
      const rollNumber = (row['Roll Number'] || row['Roll No'] || row.RollNumber || row.rollNumber || row['Register Number'] || '').toString().trim().toUpperCase();
      const email = (row.Email || row.email || '').toString().toLowerCase().trim();
      const section = (row.Section || row.section || 'A').toString().trim().toUpperCase();
      const rowDept = (row.Department || row.department || dept).toString().trim();
      const category = (row.Category || row.studentCategory || 'Day Scholar').toString().trim();

      if (!name || !rollNumber || !email) {
        results.skippedCount++;
        results.errors.push({ row: rowNum, rollNumber, email, reason: 'Missing Name, Roll Number, or Email' });
        continue;
      }

      // Check existing user email
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        results.skippedCount++;
        results.errors.push({ row: rowNum, rollNumber, email, reason: 'Email already exists in database.' });
        continue;
      }

      // Check existing roll number
      const rollExists = await StudentProfile.findOne({ rollNumber });
      if (rollExists) {
        results.skippedCount++;
        results.errors.push({ row: rowNum, rollNumber, email, reason: 'Roll number already registered.' });
        continue;
      }

      try {
        const tempPassword = generateTempPassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        const codeHash = await bcrypt.hash(tempPassword, salt);

        const newUser = new User({
          name,
          email,
          password: hashedPassword,
          role: 'student',
          rollNumber,
          department: rowDept,
          status: 'active',
          mustChangePassword: true,
          tempPassword: {
            codeHash,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            isUsed: false,
            purpose: 'account_creation',
          },
        });
        await newUser.save();

        const newProfile = new StudentProfile({
          userId: newUser._id,
          rollNumber,
          name,
          email,
          department: rowDept,
          section,
          studentCategory: category.toLowerCase().includes('hostel') ? 'Hosteller' : 'Day Scholar',
        });
        await newProfile.save();

        // Dispatch temporary password email
        try {
          await sendTempPasswordEmail({
            toEmail: newUser.email,
            recipientName: newUser.name,
            tempPassword,
            purpose: 'account_creation',
          });
        } catch (mailErr) {
          console.warn(`Failed to dispatch email to student ${newUser.email}:`, mailErr.message);
        }

        results.createdCount++;
        results.createdStudents.push({
          name: newUser.name,
          rollNumber: newUser.rollNumber,
          email: newUser.email,
          demoTempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
        });
      } catch (err) {
        results.skippedCount++;
        results.errors.push({ row: rowNum, rollNumber, email, reason: err.message });
      }
    }

    await logSystemEvent({
      level: results.errors.length > 0 ? 'warn' : 'info',
      module: 'excel_import',
      action: 'BULK_STUDENT_IMPORT',
      message: `Bulk student import: ${results.createdCount} created, ${results.skippedCount} skipped from file '${req.file.originalname}'`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Processed ${results.totalRows} rows. Successfully created ${results.createdCount} student accounts.`,
      results,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. CRUD MENTORS
// ==========================================

// @route   GET /api/coordinator/mentors
// @desc    Get all mentors in department with assigned student count
router.get('/mentors', async (req, res) => {
  try {
    const dept = req.query.department || getCoordinatorDept(req);
    const filter = { role: 'mentor' };
    if (dept) filter.department = dept;

    const mentors = await User.find(filter)
      .select('name email department status lastLogin createdAt')
      .sort({ name: 1 })
      .lean();

    // Attach student count assigned to each mentor
    const mentorsWithCount = await Promise.all(
      mentors.map(async (m) => {
        const assignedCount = await StudentProfile.countDocuments({ mentorId: m._id });
        return {
          ...m,
          assignedStudentCount: assignedCount,
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: mentorsWithCount.length,
      mentors: mentorsWithCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/mentors
// @desc    Add mentor (name, email, department) & send single-use 24-hr temp password
router.post('/mentors', async (req, res) => {
  const { name, email, department } = req.body;
  const dept = department || getCoordinatorDept(req);

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Name and email are required fields.',
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `An account with email '${normalizedEmail}' already exists.`,
      });
    }

    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    const codeHash = await bcrypt.hash(tempPassword, salt);

    const mentor = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'mentor',
      department: dept,
      status: 'active',
      mustChangePassword: true,
      tempPassword: {
        codeHash,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        isUsed: false,
        purpose: 'account_creation',
      },
    });
    await mentor.save();

    let emailResult = { previewUrl: null };
    try {
      emailResult = await sendTempPasswordEmail({
        toEmail: mentor.email,
        recipientName: mentor.name,
        tempPassword,
        purpose: 'account_creation',
      });
    } catch (mailErr) {
      console.warn(`Could not dispatch email to mentor ${mentor.email}:`, mailErr.message);
    }

    await logSystemEvent({
      level: 'info',
      module: 'user_management',
      action: 'MENTOR_CREATED',
      message: `Coordinator '${req.user.name}' added Mentor '${mentor.name}' (${mentor.email}) for dept '${dept}'`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      targetUser: { userId: mentor._id, name: mentor.name, email: mentor.email, role: mentor.role },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Mentor '${mentor.name}' created successfully. Invitation email sent.`,
      mentor,
      previewUrl: emailResult.previewUrl,
      demoTempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/coordinator/mentors/:id
// @desc    Update mentor details
router.put('/mentors/:id', async (req, res) => {
  const { name, email, department, status } = req.body;
  try {
    const mentor = await User.findById(req.params.id);
    if (!mentor || mentor.role !== 'mentor') {
      return res.status(404).json({ success: false, message: 'Mentor not found.' });
    }

    if (name) mentor.name = name.trim();
    if (department) mentor.department = department.trim();
    if (status) mentor.status = status;
    if (email && email.toLowerCase().trim() !== mentor.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: mentor._id } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use.' });
      }
      mentor.email = email.toLowerCase().trim();
    }

    await mentor.save();

    return res.status(200).json({
      success: true,
      message: 'Mentor updated successfully.',
      mentor,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/coordinator/mentors/:id
// @desc    Delete mentor and unassign their mentees
router.delete('/mentors/:id', async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id);
    if (!mentor || mentor.role !== 'mentor') {
      return res.status(404).json({ success: false, message: 'Mentor not found.' });
    }

    // Unassign all students linked to this mentor
    await StudentProfile.updateMany({ mentorId: mentor._id }, { $set: { mentorId: null } });
    await User.updateMany({ mentorId: mentor._id }, { $set: { mentorId: null } });

    await User.findByIdAndDelete(req.params.id);

    await logSystemEvent({
      level: 'warn',
      module: 'user_management',
      action: 'MENTOR_DELETED',
      message: `Coordinator '${req.user.name}' deleted mentor '${mentor.name}' and unassigned their mentees.`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Mentor '${mentor.name}' deleted and assigned students set to unassigned.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. STUDENT-TO-MENTOR ASSIGNMENT
// ==========================================
// @route   POST /api/coordinator/assign-mentor
// @desc    Assign any number of students to a mentor (or unassign)
// Rule: A student can be assigned only to one mentor at a time
router.post('/assign-mentor', async (req, res) => {
  const { studentProfileIds, mentorId } = req.body;

  if (!Array.isArray(studentProfileIds) || studentProfileIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least one student to assign.',
    });
  }

  try {
    let mentorName = 'Unassigned';
    if (mentorId) {
      const mentor = await User.findById(mentorId);
      if (!mentor || mentor.role !== 'mentor') {
        return res.status(404).json({ success: false, message: 'Selected mentor not found.' });
      }
      mentorName = mentor.name;
    }

    // Update StudentProfiles
    const updatePayload = { mentorId: mentorId || null };
    await StudentProfile.updateMany(
      { _id: { $in: studentProfileIds } },
      { $set: updatePayload }
    );

    // Also sync User records
    const profiles = await StudentProfile.find({ _id: { $in: studentProfileIds } }).select('userId');
    const userIds = profiles.map(p => p.userId).filter(Boolean);
    if (userIds.length > 0) {
      await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { mentorId: mentorId || null } }
      );
    }

    await logSystemEvent({
      level: 'info',
      module: 'user_management',
      action: 'MENTOR_ASSIGNMENT',
      message: `Coordinator '${req.user.name}' assigned ${studentProfileIds.length} student(s) to Mentor '${mentorName}'`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
      details: { count: studentProfileIds.length, mentorId, mentorName },
    });

    return res.status(200).json({
      success: true,
      message: `Successfully updated mentorship for ${studentProfileIds.length} student(s) -> ${mentorName}.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 5. PRIVACY-BY-DESIGN CUSTOM EXCEL EXPORT
// ==========================================
// Helper to extract custom selected fields for Excel export
const buildExportRows = (students, chosenFields) => {
  // Mapping of field keys to header labels and extractor functions
  const fieldDefinitions = {
    rollNumber: { label: 'Roll Number', get: (s) => s.rollNumber },
    name: { label: 'Student Name', get: (s) => s.name },
    email: { label: 'Institutional Email', get: (s) => s.email },
    personalEmail: { label: 'Personal Email', get: (s) => s.personalEmail || '—' },
    mobileNumber: { label: 'Mobile Number', get: (s) => s.mobileNumber || '—' },
    department: { label: 'Department', get: (s) => s.department },
    section: { label: 'Section', get: (s) => s.section || 'A' },
    batch: { label: 'Batch', get: (s) => s.batch || '—' },
    gender: { label: 'Gender', get: (s) => s.gender || '—' },
    studentCategory: { label: 'Category', get: (s) => s.studentCategory || 'Day Scholar' },
    hostelName: { label: 'Hostel Name', get: (s) => s.hostelName || '—' },
    distanceFromCollege: { label: 'Distance from College (km)', get: (s) => s.distanceFromCollege || 0 },
    currentCGPA: { label: 'Current CGPA', get: (s) => s.currentCGPA || 0 },
    standingArrearsCount: { label: 'Standing Arrears', get: (s) => s.standingArrearsCount || 0 },
    isPlaced: { label: 'Placement Status', get: (s) => (s.careerGoal?.primaryGoal === 'Placement' ? (s.placementStatus?.isPlaced ? 'Placed' : 'Not Placed') : 'Nil') },
    placementType: { label: 'Placement Mode', get: (s) => (s.careerGoal?.primaryGoal === 'Placement' ? (s.placementStatus?.isPlaced ? s.placementStatus?.placementType : 'N/A') : 'Nil') },
    companyName: { label: 'Placed Company', get: (s) => (s.careerGoal?.primaryGoal === 'Placement' ? (s.placementStatus?.companyName || '—') : 'Nil') },
    packageCTC: { label: 'Package (LPA)', get: (s) => (s.careerGoal?.primaryGoal === 'Placement' ? (s.placementStatus?.packageCTC || '—') : 'Nil') },
    jobRole: { label: 'Placed Job Role', get: (s) => (s.careerGoal?.primaryGoal === 'Placement' ? (s.placementStatus?.jobRole || '—') : 'Nil') },
    primaryGoal: { label: 'Primary Career Goal', get: (s) => s.careerGoal?.primaryGoal || 'Undecided' },
    studyLocation: { label: 'Higher Studies Destination', get: (s) => (s.careerGoal?.primaryGoal === 'Higher Studies' ? (s.careerGoal?.higherStudies?.studyLocation || '—') : 'Nil') },
    preferredProgramme: { label: 'Target Programme', get: (s) => (s.careerGoal?.primaryGoal === 'Higher Studies' ? (s.careerGoal?.higherStudies?.preferredProgramme || '—') : 'Nil') },
    targetInstitutions: { label: 'Target Institutions', get: (s) => (s.careerGoal?.primaryGoal === 'Higher Studies' ? (s.careerGoal?.higherStudies?.targetInstitutions || '—') : 'Nil') },
    startupIdea: { label: 'Startup Idea', get: (s) => (s.careerGoal?.primaryGoal === 'Entrepreneurship' ? (s.careerGoal?.entrepreneurship?.startupIdea || '—') : 'Nil') },
    startupStage: { label: 'Startup Stage', get: (s) => (s.careerGoal?.primaryGoal === 'Entrepreneurship' ? (s.careerGoal?.entrepreneurship?.currentStage || '—') : 'Nil') },
    domainInterest: { label: 'Technical Domain', get: (s) => s.technicalProfile?.domainInterest || '—' },
    programmingLanguages: { label: 'Programming Languages', get: (s) => s.technicalProfile?.programmingLanguages?.join(', ') || '—' },
    certifications: { label: 'Certifications', get: (s) => s.technicalProfile?.certifications?.join(', ') || '—' },
    mentorName: { label: 'Assigned Mentor', get: (s) => s.mentorId?.name || 'Unassigned' },
    semestersCount: { label: 'Semesters Completed', get: (s) => s.semesters?.length || 0 },
  };

  const defaultKeys = [
    'rollNumber', 'name', 'email', 'department', 'section', 'studentCategory',
    'currentCGPA', 'standingArrearsCount', 'isPlaced', 'placementType',
    'companyName', 'packageCTC', 'primaryGoal', 'studyLocation', 'domainInterest', 'mentorName'
  ];

  const activeKeys = (Array.isArray(chosenFields) && chosenFields.length > 0)
    ? chosenFields.filter((k) => fieldDefinitions[k])
    : defaultKeys;

  return students.map((s, idx) => {
    const row = { 'S.No': idx + 1 };
    activeKeys.forEach((key) => {
      const def = fieldDefinitions[key];
      if (def) {
        row[def.label] = def.get(s);
      }
    });
    return row;
  });
};

const handleExportLogic = async (req, res, queryParams, chosenFields) => {
  const dept = queryParams.department || getCoordinatorDept(req);
  const query = buildStudentFilterQuery(dept, queryParams);

  const students = await StudentProfile.find(query)
    .populate('mentorId', 'name email')
    .sort({ rollNumber: 1 })
    .lean();

  const exportRows = buildExportRows(students, chosenFields);

  const ws = xlsx.utils.json_to_sheet(exportRows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Filtered_Students');

  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=Students_${dept || 'Department'}_${Date.now()}.xlsx`);

  await logSystemEvent({
    level: 'info',
    module: 'excel_import',
    action: 'CUSTOM_EXCEL_EXPORT',
    message: `Coordinator '${req.user.name}' exported ${exportRows.length} student records with ${Object.keys(exportRows[0] || {}).length} custom fields.`,
    performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
    req,
  });

  return res.send(buffer);
};

// @route   GET /api/coordinator/export-excel
router.get('/export-excel', async (req, res) => {
  try {
    const fields = req.query.fields ? req.query.fields.split(',') : null;
    await handleExportLogic(req, res, req.query, fields);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/export-excel
router.post('/export-excel', async (req, res) => {
  try {
    const { filters = {}, fields = [] } = req.body;
    await handleExportLogic(req, res, filters, fields);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 6. DEPARTMENT-SPECIFIC DRIVES (SPECIAL FLAG & FULL ROLE SPEC)
// ==========================================
// Visible ONLY to this department's coordinator, mentors, and students
router.get('/drives', async (req, res) => {
  try {
    const dept = req.query.department || getCoordinatorDept(req);
    const filter = { isDepartmentSpecific: true };
    if (dept) filter.department = dept;

    const drives = await DepartmentDrive.find(filter)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();

    // Augment drives with active status & counts
    const enrichedDrives = drives.map((d) => {
      const deadline = d.optInDeadline ? new Date(d.optInDeadline) : null;
      const isExpired = deadline ? now > deadline : false;
      const optedInCount = (d.optIns || []).filter((o) => o.status === 'Opted-In').length;
      const optedOutCount = (d.optIns || []).filter((o) => o.status === 'Opted-Out').length;

      return {
        ...d,
        isExpired,
        optedInCount,
        optedOutCount,
      };
    });

    return res.status(200).json({
      success: true,
      count: enrichedDrives.length,
      drives: enrichedDrives,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/drives
// @desc    Create new department drive with comprehensive roles & custom details form
router.post('/drives', async (req, res) => {
  const {
    companyName,
    jobLocation,
    location,
    companyDescription,
    aboutCompany,
    optInDeadline,
    maxRoleChoicesAllowed,
    roles,
    customFormFields,
    department,
  } = req.body;

  const dept = department || getCoordinatorDept(req);
  const compName = companyName?.trim();
  const loc = (jobLocation || location || '').trim();

  if (!compName || !loc) {
    return res.status(400).json({
      success: false,
      message: 'Company name and job location are required.',
    });
  }

  if (!optInDeadline) {
    return res.status(400).json({
      success: false,
      message: 'Opt-in deadline is required.',
    });
  }

  try {
    // Format roles according to schema (Standing vs History Arrears as separate entities)
    const formattedRoles = (Array.isArray(roles) ? roles : []).map((r) => {
      const standingAllowed = r.standingArrearsAllowed === true || r.standingArrearsAllowed === 'true' || r.standingArrearsAllowed === 'Yes' || (r.arrearsAllowed === true || r.arrearsAllowed === 'true');
      const historyAllowed = r.historyArrearsAllowed === true || r.historyArrearsAllowed === 'true' || r.historyArrearsAllowed === 'Yes';
      const maxStanding = Number(r.maxStandingArrears ?? r.maxArrearsAllowed) || 0;
      const maxHistory = Number(r.maxHistoryArrears) || 0;

      return {
        roleName: (r.roleName || r.jobRole || 'Software Engineer').trim(),
        ctc: (r.ctc || r.salary || '5 LPA').trim(),
        minCGPA: Number(r.minCGPA) || 0,
        standingArrearsAllowed: standingAllowed,
        maxStandingArrears: maxStanding,
        historyArrearsAllowed: historyAllowed,
        maxHistoryArrears: maxHistory,
        arrearsAllowed: standingAllowed,
        maxArrearsAllowed: maxStanding,
        roleDescription: r.roleDescription || r.jobDescription || '',
        roleDuties: r.roleDuties || '',
        roleRequirements: r.roleRequirements || r.eligibilityCriteria || '',
        otherDetails: r.otherDetails || '',
        fileAttachment: r.fileAttachment || '',
      };
    });

    const drive = new DepartmentDrive({
      companyName: compName,
      jobLocation: loc,
      companyDescription: companyDescription || aboutCompany || '',
      department: dept,
      isDepartmentSpecific: true, // Special flag: NOT visible to placement officers!
      optInDeadline: new Date(optInDeadline),
      maxRoleChoicesAllowed: Number(maxRoleChoicesAllowed) || 1,
      customFormFields: Array.isArray(customFormFields) ? customFormFields : [],
      roles: formattedRoles,
      createdBy: req.user._id,
      status: 'Active',
    });

    await drive.save();

    await logSystemEvent({
      level: 'info',
      module: 'admin',
      action: 'DEPT_DRIVE_CREATED',
      message: `Coordinator '${req.user.name}' posted department drive for '${drive.companyName}' with ${formattedRoles.length} roles (${dept})`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Department drive for '${compName}' published successfully.`,
      drive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/coordinator/drives/:id
// @desc    Update drive details, roles, deadline, custom form
router.put('/drives/:id', async (req, res) => {
  const {
    companyName,
    jobLocation,
    location,
    companyDescription,
    aboutCompany,
    optInDeadline,
    maxRoleChoicesAllowed,
    roles,
    customFormFields,
    status,
  } = req.body;

  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    if (companyName) drive.companyName = companyName.trim();
    if (jobLocation || location) drive.jobLocation = (jobLocation || location).trim();
    if (companyDescription !== undefined || aboutCompany !== undefined) {
      drive.companyDescription = companyDescription !== undefined ? companyDescription : aboutCompany;
    }
    if (optInDeadline) drive.optInDeadline = new Date(optInDeadline);
    if (maxRoleChoicesAllowed !== undefined) drive.maxRoleChoicesAllowed = Number(maxRoleChoicesAllowed) || 1;
    if (Array.isArray(customFormFields)) drive.customFormFields = customFormFields;
    if (status) drive.status = status;

    if (Array.isArray(roles)) {
      drive.roles = roles.map((r) => {
        const standingAllowed = r.standingArrearsAllowed === true || r.standingArrearsAllowed === 'true' || r.standingArrearsAllowed === 'Yes' || (r.arrearsAllowed === true || r.arrearsAllowed === 'true');
        const historyAllowed = r.historyArrearsAllowed === true || r.historyArrearsAllowed === 'true' || r.historyArrearsAllowed === 'Yes';
        const maxStanding = Number(r.maxStandingArrears ?? r.maxArrearsAllowed) || 0;
        const maxHistory = Number(r.maxHistoryArrears) || 0;

        return {
          roleName: (r.roleName || r.jobRole || 'Software Engineer').trim(),
          ctc: (r.ctc || r.salary || '5 LPA').trim(),
          minCGPA: Number(r.minCGPA) || 0,
          standingArrearsAllowed: standingAllowed,
          maxStandingArrears: maxStanding,
          historyArrearsAllowed: historyAllowed,
          maxHistoryArrears: maxHistory,
          arrearsAllowed: standingAllowed,
          maxArrearsAllowed: maxStanding,
          roleDescription: r.roleDescription || r.jobDescription || '',
          roleDuties: r.roleDuties || '',
          roleRequirements: r.roleRequirements || r.eligibilityCriteria || '',
          otherDetails: r.otherDetails || '',
          fileAttachment: r.fileAttachment || '',
        };
      });
    }

    await drive.save();

    return res.status(200).json({
      success: true,
      message: 'Department drive updated successfully.',
      drive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/coordinator/drives/:id
// @desc    Delete drive
router.delete('/drives/:id', async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    await DepartmentDrive.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: `Drive for '${drive.companyName}' has been removed.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// ROLE CRUD WITHIN A DEPARTMENT DRIVE
// ==========================================

// @route   POST /api/coordinator/drives/:id/roles
// @desc    Add a job role to an existing drive
router.post('/drives/:id/roles', async (req, res) => {
  const {
    roleName,
    jobRole,
    ctc,
    salary,
    minCGPA,
    arrearsAllowed,
    maxArrearsAllowed,
    roleDescription,
    jobDescription,
    roleDuties,
    roleRequirements,
    otherDetails,
    fileAttachment,
  } = req.body;

  const rName = (roleName || jobRole || '').trim();
  const rSalary = (ctc || salary || '').trim();

  if (!rName || !rSalary) {
    return res.status(400).json({
      success: false,
      message: 'Role name and CTC are required.',
    });
  }

  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    const standingAllowed = req.body.standingArrearsAllowed === true || req.body.standingArrearsAllowed === 'true' || req.body.standingArrearsAllowed === 'Yes' || (arrearsAllowed === true || arrearsAllowed === 'true');
    const historyAllowed = req.body.historyArrearsAllowed === true || req.body.historyArrearsAllowed === 'true' || req.body.historyArrearsAllowed === 'Yes';
    const maxStanding = Number(req.body.maxStandingArrears ?? maxArrearsAllowed) || 0;
    const maxHistory = Number(req.body.maxHistoryArrears) || 0;

    const newRole = {
      roleName: rName,
      ctc: rSalary,
      minCGPA: Number(minCGPA) || 0,
      standingArrearsAllowed: standingAllowed,
      maxStandingArrears: maxStanding,
      historyArrearsAllowed: historyAllowed,
      maxHistoryArrears: maxHistory,
      arrearsAllowed: standingAllowed,
      maxArrearsAllowed: maxStanding,
      roleDescription: roleDescription || jobDescription || '',
      roleDuties: roleDuties || '',
      roleRequirements: roleRequirements || '',
      otherDetails: otherDetails || '',
      fileAttachment: fileAttachment || '',
    };

    drive.roles.push(newRole);
    await drive.save();

    return res.status(201).json({
      success: true,
      message: `Role '${rName}' added to drive.`,
      role: drive.roles[drive.roles.length - 1],
      drive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/coordinator/drives/:id/roles/:roleId
// @desc    Update a specific role inside a drive
router.put('/drives/:id/roles/:roleId', async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    const role = drive.roles.id(req.params.roleId);
    if (!role) {
      return res.status(404).json({ success: false, message: 'Job role not found in this drive.' });
    }

    const {
      roleName,
      jobRole,
      ctc,
      salary,
      minCGPA,
      arrearsAllowed,
      maxArrearsAllowed,
      roleDescription,
      jobDescription,
      roleDuties,
      roleRequirements,
      otherDetails,
      fileAttachment,
    } = req.body;

    if (roleName || jobRole) role.roleName = (roleName || jobRole).trim();
    if (ctc || salary) role.ctc = (ctc || salary).trim();
    if (minCGPA !== undefined) role.minCGPA = Number(minCGPA) || 0;
    if (req.body.standingArrearsAllowed !== undefined) {
      role.standingArrearsAllowed = req.body.standingArrearsAllowed === true || req.body.standingArrearsAllowed === 'true';
      role.arrearsAllowed = role.standingArrearsAllowed;
    } else if (arrearsAllowed !== undefined) {
      role.arrearsAllowed = arrearsAllowed === true || arrearsAllowed === 'true' || arrearsAllowed === 'Yes';
      role.standingArrearsAllowed = role.arrearsAllowed;
    }
    if (req.body.maxStandingArrears !== undefined) {
      role.maxStandingArrears = Number(req.body.maxStandingArrears) || 0;
      role.maxArrearsAllowed = role.maxStandingArrears;
    } else if (maxArrearsAllowed !== undefined) {
      role.maxArrearsAllowed = Number(maxArrearsAllowed) || 0;
      role.maxStandingArrears = role.maxArrearsAllowed;
    }
    if (req.body.historyArrearsAllowed !== undefined) {
      role.historyArrearsAllowed = req.body.historyArrearsAllowed === true || req.body.historyArrearsAllowed === 'true';
    }
    if (req.body.maxHistoryArrears !== undefined) {
      role.maxHistoryArrears = Number(req.body.maxHistoryArrears) || 0;
    }
    if (roleDescription !== undefined || jobDescription !== undefined) {
      role.roleDescription = roleDescription !== undefined ? roleDescription : jobDescription;
    }
    if (roleDuties !== undefined) role.roleDuties = roleDuties;
    if (roleRequirements !== undefined) role.roleRequirements = roleRequirements;
    if (otherDetails !== undefined) role.otherDetails = otherDetails;
    if (fileAttachment !== undefined) role.fileAttachment = fileAttachment;

    await drive.save();

    return res.status(200).json({
      success: true,
      message: 'Job role updated successfully.',
      role,
      drive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/coordinator/drives/:id/roles/:roleId
// @desc    Delete a specific role from a drive
router.delete('/drives/:id/roles/:roleId', async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    drive.roles.pull({ _id: req.params.roleId });
    await drive.save();

    return res.status(200).json({
      success: true,
      message: 'Job role removed from drive.',
      drive,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// STUDENT OPT-IN / OPT-OUT FOR DEPARTMENT DRIVES
// ==========================================

// @route   POST /api/coordinator/drives/:id/opt-in
// @desc    Opt-in student for a department drive (with selected roles up to limit & custom form answers)
router.post('/drives/:id/opt-in', async (req, res) => {
  const { studentId, selectedRoles, customFormResponses } = req.body;
  const targetStudentUserId = studentId || req.user._id;

  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    // 1. Time Limit Check: After deadline, students cannot opt in!
    const now = new Date();
    if (drive.optInDeadline && now > new Date(drive.optInDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'The deadline for opting-in to this drive has expired. Submissions are closed.',
      });
    }

    // 2. Fetch student profile
    const studentUser = await User.findById(targetStudentUserId);
    if (!studentUser) {
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }

    const studentProfile = await StudentProfile.findOne({
      $or: [{ userId: targetStudentUserId }, { email: studentUser.email }],
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, message: 'Student profile not found.' });
    }

    // 3. Validate Role Selection Limit
    const chosenRoles = Array.isArray(selectedRoles) ? selectedRoles : [selectedRoles].filter(Boolean);
    if (chosenRoles.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one role to opt-in.' });
    }

    const maxAllowed = drive.maxRoleChoicesAllowed || 1;
    if (chosenRoles.length > maxAllowed) {
      return res.status(400).json({
        success: false,
        message: `You can select at most ${maxAllowed} role(s) for this drive.`,
      });
    }

    // 4. Validate Required Custom Form Fields
    if (Array.isArray(drive.customFormFields)) {
      for (const field of drive.customFormFields) {
        if (field.isRequired) {
          const val = customFormResponses ? customFormResponses[field.fieldLabel] : null;
          if (!val || val.toString().trim() === '') {
            return res.status(400).json({
              success: false,
              message: `Field '${field.fieldLabel}' is required before opting in.`,
            });
          }
        }
      }
    }

    // 5. Update or Add Opt-In Record
    const existingIndex = drive.optIns.findIndex(
      (o) => o.studentId.toString() === targetStudentUserId.toString()
    );

    const optInData = {
      studentId: targetStudentUserId,
      rollNumber: studentProfile.rollNumber,
      studentName: studentProfile.name,
      email: studentProfile.email,
      department: studentProfile.department,
      section: studentProfile.section || 'A',
      currentCGPA: studentProfile.currentCGPA || 0,
      standingArrearsCount: studentProfile.standingArrearsCount || 0,
      selectedRoles: chosenRoles,
      customFormResponses: customFormResponses || {},
      status: 'Opted-In',
      optedAt: new Date(),
    };

    if (existingIndex >= 0) {
      drive.optIns[existingIndex] = optInData;
    } else {
      drive.optIns.push(optInData);
    }

    await drive.save();

    return res.status(200).json({
      success: true,
      message: `Successfully opted-in for ${drive.companyName} (${chosenRoles.join(', ')}).`,
      optIn: optInData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/drives/:id/opt-out
// @desc    Opt-out student from a department drive
router.post('/drives/:id/opt-out', async (req, res) => {
  const { studentId } = req.body;
  const targetStudentUserId = studentId || req.user._id;

  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    const now = new Date();
    if (drive.optInDeadline && now > new Date(drive.optInDeadline)) {
      return res.status(400).json({
        success: false,
        message: 'The deadline for this drive has already passed.',
      });
    }

    const existingIndex = drive.optIns.findIndex(
      (o) => o.studentId.toString() === targetStudentUserId.toString()
    );

    if (existingIndex >= 0) {
      drive.optIns[existingIndex].status = 'Opted-Out';
      drive.optIns[existingIndex].optedAt = new Date();
    } else {
      const studentUser = await User.findById(targetStudentUserId);
      const studentProfile = await StudentProfile.findOne({
        $or: [{ userId: targetStudentUserId }, { email: studentUser?.email }],
      });

      drive.optIns.push({
        studentId: targetStudentUserId,
        rollNumber: studentProfile?.rollNumber || '',
        studentName: studentProfile?.name || studentUser?.name || '',
        email: studentProfile?.email || studentUser?.email || '',
        department: studentProfile?.department || drive.department,
        section: studentProfile?.section || 'A',
        currentCGPA: studentProfile?.currentCGPA || 0,
        standingArrearsCount: studentProfile?.standingArrearsCount || 0,
        selectedRoles: [],
        customFormResponses: {},
        status: 'Opted-Out',
        optedAt: new Date(),
      });
    }

    await drive.save();

    return res.status(200).json({
      success: true,
      message: `You have opted-out from ${drive.companyName}.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// TWO-SHEET EXCEL EXPORT: ELIGIBLE STUDENTS & OPTED-IN STUDENTS
// ==========================================
// @route   GET /api/coordinator/drives/:id/export-excel
// @desc    Download Excel sheet with company name as filename containing:
//          Sheet 1: All students who are eligible for the drive (Name, Roll No, Email, Dept, Sec, CGPA, Arrears, Eligible Roles)
//          Sheet 2: Students who opted in for that drive and for what role, with custom form responses
router.get('/drives/:id/export-excel', async (req, res) => {
  try {
    const drive = await DepartmentDrive.findById(req.params.id);
    if (!drive) {
      return res.status(404).json({ success: false, message: 'Drive not found.' });
    }

    const dept = drive.department;
    const now = new Date();
    const isDeadlinePassed = drive.optInDeadline ? now > new Date(drive.optInDeadline) : false;

    // Fetch all students in this department
    const departmentStudents = await StudentProfile.find({ department: dept })
      .populate('mentorId', 'name email')
      .lean();

    // ------------------------------------------
    // SHEET 1: ELIGIBLE STUDENTS
    // ------------------------------------------
    const eligibleStudentsData = [];

    departmentStudents.forEach((st) => {
      const stCGPA = st.currentCGPA || 0;
      const stStanding = st.standingArrearsCount || 0;
      const stHistory = Array.isArray(st.arrears) ? st.arrears.length : (st.historyArrearsCount || stStanding);
      const stCleared = Array.isArray(st.arrears) ? st.arrears.filter((a) => a.currentStatus === 'Cleared').length : Math.max(0, stHistory - stStanding);

      // Check which roles this student is eligible for (Standing & History Arrears as separate conditions)
      const eligibleRoles = [];
      (drive.roles || []).forEach((r) => {
        const meetsCGPA = stCGPA >= (r.minCGPA || 0);

        const standingAllowed = r.standingArrearsAllowed ?? r.arrearsAllowed ?? false;
        const maxStanding = Number(r.maxStandingArrears ?? r.maxArrearsAllowed) || 0;
        const meetsStanding = standingAllowed ? (stStanding <= maxStanding) : (stStanding === 0);

        const historyAllowed = r.historyArrearsAllowed ?? (r.arrearsAllowed !== undefined ? r.arrearsAllowed : true);
        const maxHistory = Number(r.maxHistoryArrears) || 0;
        const meetsHistory = historyAllowed ? (stHistory <= (maxHistory > 0 ? maxHistory : 99)) : (stHistory === 0);

        if (meetsCGPA && meetsStanding && meetsHistory) {
          eligibleRoles.push(r.roleName);
        }
      });

      if (eligibleRoles.length > 0) {
        eligibleStudentsData.push({
          'Roll Number': st.rollNumber,
          'Student Name': st.name,
          'Email': st.email,
          'Department': st.department,
          'Section': st.section || 'A',
          'Current CGPA': stCGPA,
          'Standing Arrears': stStanding,
          'History of Arrears': stHistory,
          'Cleared Arrears': stCleared,
          'Eligible For Roles': eligibleRoles.join(', '),
          'Assigned Mentor': st.mentorId?.name || 'Unassigned',
        });
      }
    });

    // ------------------------------------------
    // SHEET 2: OPTED-IN STUDENTS
    // ------------------------------------------
    const optedInData = [];
    const optInMap = new Map();

    (drive.optIns || []).forEach((opt) => {
      optInMap.set(opt.rollNumber || opt.email, opt);

      if (opt.status === 'Opted-In') {
        const row = {
          'Roll Number': opt.rollNumber,
          'Student Name': opt.studentName,
          'Email': opt.email,
          'Department': opt.department,
          'Section': opt.section || 'A',
          'Current CGPA': opt.currentCGPA || 0,
          'Standing Arrears': opt.standingArrearsCount || 0,
          'History of Arrears': opt.historyArrearsCount || opt.standingArrearsCount || 0,
          'Selected Role(s)': Array.isArray(opt.selectedRoles) ? opt.selectedRoles.join(', ') : '',
          'Status': 'Opted-In',
          'Opted-In At': opt.optedAt ? new Date(opt.optedAt).toLocaleString() : '',
        };

        // Append custom form answers
        if (Array.isArray(drive.customFormFields)) {
          drive.customFormFields.forEach((cf) => {
            const resp = opt.customFormResponses ? opt.customFormResponses[cf.fieldLabel] : '';
            row[`[Form] ${cf.fieldLabel}`] = resp || 'N/A';
          });
        }

        optedInData.push(row);
      }
    });

    // ------------------------------------------
    // SHEET 3: OPTED-OUT & EXPIRED STUDENTS
    // ------------------------------------------
    // If deadline passed, any eligible student who has not opted-in is considered Opted-Out
    const optedOutData = [];
    eligibleStudentsData.forEach((el) => {
      const rec = optInMap.get(el['Roll Number']) || optInMap.get(el['Email']);
      if (!rec || rec.status === 'Opted-Out') {
        optedOutData.push({
          'Roll Number': el['Roll Number'],
          'Student Name': el['Student Name'],
          'Email': el['Email'],
          'Department': el['Department'],
          'Section': el['Section'],
          'Current CGPA': el['Current CGPA'],
          'Eligible For Roles': el['Eligible For Roles'],
          'Status': rec?.status === 'Opted-Out' ? 'Explicitly Opted-Out' : isDeadlinePassed ? 'Considered Opted-Out (Deadline Expired)' : 'Pending Decision',
        });
      }
    });

    // Build Excel Workbook with multiple sheets
    const workbook = xlsx.utils.book_new();

    const ws1 = xlsx.utils.json_to_sheet(eligibleStudentsData);
    xlsx.utils.book_append_sheet(workbook, ws1, 'Eligible Students');

    const ws2 = xlsx.utils.json_to_sheet(optedInData.length > 0 ? optedInData : [{ Note: 'No students have opted-in yet.' }]);
    xlsx.utils.book_append_sheet(workbook, ws2, 'Opted-In Students');

    const ws3 = xlsx.utils.json_to_sheet(optedOutData.length > 0 ? optedOutData : [{ Note: 'No opted-out students.' }]);
    xlsx.utils.book_append_sheet(workbook, ws3, 'Opted-Out or Expired');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Clean company name for safe filename
    const safeCompName = drive.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeCompName}_Drive_Details.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 7. COMMUNICATION HUB (CIRCULARS / MESSAGES)
// ==========================================
// @route   GET /api/coordinator/messages
// @desc    Get sent or received messages in department
router.get('/messages', async (req, res) => {
  try {
    const dept = getCoordinatorDept(req);
    const messages = await CommunicationMessage.find({
      $or: [
        { 'sender.userId': req.user._id },
        { department: dept },
      ],
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/messages
// @desc    Send message / circular / enquiry to students or mentors
router.post('/messages', async (req, res) => {
  const {
    subject,
    content,
    messageType, // 'circular', 'message', 'enquiry', 'announcement'
    priority, // 'Normal', 'Important', 'Urgent'
    targetGroup, // 'all_students', 'all_mentors', 'custom_selection'
    selectedUserIds,
  } = req.body;

  const dept = getCoordinatorDept(req);

  if (!subject || !content) {
    return res.status(400).json({
      success: false,
      message: 'Subject and content are required.',
    });
  }

  try {
    let recipients = [];

    if (targetGroup === 'all_students') {
      const students = await User.find({ role: 'student', department: dept }).select('name email role');
      recipients = students.map(s => ({ userId: s._id, name: s.name, email: s.email, role: s.role }));
    } else if (targetGroup === 'all_mentors') {
      const mentors = await User.find({ role: 'mentor', department: dept }).select('name email role');
      recipients = mentors.map(m => ({ userId: m._id, name: m.name, email: m.email, role: m.role }));
    } else if (Array.isArray(selectedUserIds) && selectedUserIds.length > 0) {
      const users = await User.find({ _id: { $in: selectedUserIds } }).select('name email role');
      recipients = users.map(u => ({ userId: u._id, name: u.name, email: u.email, role: u.role }));
    }

    const message = new CommunicationMessage({
      sender: {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      department: dept,
      messageType: messageType || 'message',
      priority: priority || 'Normal',
      subject: subject.trim(),
      content: content.trim(),
      targetGroup: targetGroup || 'custom_selection',
      recipients,
    });

    await message.save();

    // Trigger Notification Service: Notify all recipients
    const recipientUserIds = (recipients || []).map((r) => r.userId).filter(Boolean);
    if (recipientUserIds.length > 0) {
      await createBulkNotifications({
        recipientIds: recipientUserIds,
        sender: {
          userId: req.user._id,
          name: req.user.name,
          role: req.user.role,
        },
        type: message.messageType === 'circular' ? 'circular' : 'message_received',
        title: `New ${message.messageType === 'circular' ? 'Circular' : 'Message'}: ${message.subject}`,
        message: `${req.user.name} posted: "${message.subject}"`,
        relatedId: message._id,
        link: '/?tab=communication',
      });
    }

    await logSystemEvent({
      level: 'info',
      module: 'admin',
      action: 'CIRCULAR_DISPATCHED',
      message: `Coordinator '${req.user.name}' broadcasted ${message.messageType} '${message.subject}' to ${recipients.length} recipients.`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Message dispatched successfully to ${recipients.length} recipient(s).`,
      communication: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/coordinator/messages/:id/reply
// @desc    Reply to an ongoing message/enquiry thread
router.post('/messages/:id/reply', async (req, res) => {
  const { content } = req.body;
  if (!content) {
    return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
  }

  try {
    const message = await CommunicationMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message thread not found.' });
    }

    message.replies.push({
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content: content.trim(),
      sentAt: new Date(),
    });

    await message.save();

    // Trigger Notification Service:
    // If replier is not the thread creator, notify thread creator
    const creatorId = message.sender?.userId?.toString();
    const replierId = req.user._id.toString();

    if (creatorId && creatorId !== replierId) {
      await createNotification({
        recipientId: message.sender.userId,
        sender: {
          userId: req.user._id,
          name: req.user.name,
          role: req.user.role,
        },
        type: 'message_reply',
        title: `New Reply on "${message.subject}"`,
        message: `${req.user.name} replied: "${content.trim().substring(0, 80)}${content.trim().length > 80 ? '...' : ''}"`,
        relatedId: message._id,
        link: '/?tab=communication',
      });
    } else {
      // If creator replied, notify the other recipients
      const otherRecipients = (message.recipients || [])
        .map((r) => r.userId)
        .filter((id) => id && id.toString() !== replierId);

      if (otherRecipients.length > 0) {
        await createBulkNotifications({
          recipientIds: otherRecipients,
          sender: {
            userId: req.user._id,
            name: req.user.name,
            role: req.user.role,
          },
          type: 'message_reply',
          title: `Update on "${message.subject}"`,
          message: `${req.user.name} added a reply to the thread.`,
          relatedId: message._id,
          link: '/?tab=communication',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Reply posted successfully.',
      replies: message.replies,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
