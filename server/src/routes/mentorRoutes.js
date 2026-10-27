const express = require('express');
const xlsx = require('xlsx');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const CommunicationMessage = require('../models/CommunicationMessage');
const { protect, authorize } = require('../middleware/auth');
const { logSystemEvent } = require('../utils/logger');
const { createNotification, createBulkNotifications } = require('../services/notificationService');

const router = express.Router();

// Apply auth protection: only mentors and admins can access mentor endpoints
router.use(protect, authorize('mentor', 'admin'));

// Helper to get mentor's department
const getMentorDept = (req) => {
  return req.user.department || '';
};

// ==========================================
// 1. MENTOR ANALYTICS & INSIGHTS (MENTEE SCOPE & DEPT SCOPE)
// ==========================================
// @route   GET /api/mentor/analytics
// @desc    Returns complete departmental/mentee intelligence & student statistics.
//          By default, scope is 'mentees' (only students assigned to this mentor).
//          If scope is 'department', returns view-only entire department statistics.
router.get('/analytics', async (req, res) => {
  try {
    const dept = getMentorDept(req);
    const scope = req.query.scope === 'department' ? 'department' : 'mentees';
    const andClauses = [];

    if (dept && dept !== 'all') {
      andClauses.push({
        $or: [
          { department: { $regex: new RegExp(`^${dept}$`, 'i') } },
          { department: dept },
        ],
      });
    }

    // Base scope filter
    if (scope === 'mentees') {
      andClauses.push({ mentorId: req.user._id });
    }

    // Search
    if (req.query.search && req.query.search.trim() !== '') {
      const q = req.query.search.trim();
      andClauses.push({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { rollNumber: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      });
    }

    // Section, Category, Batch
    if (req.query.section && req.query.section !== 'all') {
      andClauses.push({ section: req.query.section });
    }
    if (req.query.studentCategory && req.query.studentCategory !== 'all') {
      andClauses.push({ studentCategory: req.query.studentCategory });
    }
    if (req.query.batch && req.query.batch !== 'all') {
      andClauses.push({ batch: req.query.batch });
    }

    // Career Goal and conditional sub-filters
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

    // Arrear Status: Standing vs History Arrears
    const { arrearFilter, hasArrears, arrearCount, arrearStatusType } = req.query;
    const effectiveArrearFilter = arrearFilter || (hasArrears === 'yes' ? 'standing' : hasArrears === 'no' ? 'none' : 'all');

    if (effectiveArrearFilter === 'none') {
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

    // CGPA Range and Brackets
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
        department: dept,
        scope,
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
          studentsWithStandingArrears: 0,
          studentsWithHistoryArrears: 0,
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
          placementTypeDistribution: { 'On-Campus Placed': 0, 'Off-Campus Placed': 0, 'Unplaced': 0 },
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

    const semSGPAMap = {};
    const subjectArrearMap = {};

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

      // 3. Arrears & Remedial Support
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

      // 4. Semester Progression Analysis
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

      // 5. Readiness & Skill Gaps
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

    const semesterAverageSGPA = Object.values(semSGPAMap)
      .map((item) => ({
        semester: `Semester ${item.semester}`,
        semNumber: item.semester,
        averageSGPA: Number((item.totalSGPA / item.count).toFixed(2)),
        studentCount: item.count,
      }))
      .sort((a, b) => a.semNumber - b.semNumber);

    const subjectArrearHotspots = Object.values(subjectArrearMap)
      .sort((a, b) => b.totalArrears - a.totalArrears)
      .slice(0, 8);

    const averageCGPA = (totalCGPA / totalStudents).toFixed(2);
    const placementPercentage = ((placedCount / totalStudents) * 100).toFixed(1);

    // Filtered Students sorted by roll number by default
    const filteredStudents = profiles
      .map((p) => ({
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
      }))
      .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));

    return res.status(200).json({
      success: true,
      department: dept,
      scope,
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
// 2. MENTEE DIRECTORY (VIEW-ONLY STUDENTS UNDER THIS MENTOR)
// ==========================================
// @route   GET /api/mentor/students
// @desc    View-only list of students assigned to this mentor
router.get('/students', async (req, res) => {
  try {
    const dept = getMentorDept(req);
    const { page = 1, limit = 25, search = '', section, studentCategory } = req.query;

    const query = {
      department: dept,
      mentorId: req.user._id,
    };

    if (search.trim() !== '') {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [{ name: regex }, { rollNumber: regex }, { email: regex }];
    }

    if (section && section !== 'all') {
      query.section = section;
    }

    if (studentCategory && studentCategory !== 'all') {
      query.studentCategory = studentCategory;
    }

    const totalCount = await StudentProfile.countDocuments(query);
    const students = await StudentProfile.find(query)
      .populate('userId', 'email status')
      .sort({ rollNumber: 1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      success: true,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      currentPage: Number(page),
      students,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/mentor/students/:id
// @desc    Get complete individual student profile details (view-only)
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

// ==========================================
// 3. PRIVACY-SAFE CUSTOM EXCEL EXPORT
// ==========================================
const buildMentorExportRows = (students, chosenFields) => {
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
    historyArrearsCount: { label: 'History of Arrears', get: (s) => (Array.isArray(s.arrears) ? s.arrears.length : (s.historyArrearsCount || 0)) },
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
  };

  const activeFields = chosenFields && chosenFields.length > 0
    ? chosenFields.filter((k) => fieldDefinitions[k])
    : ['rollNumber', 'name', 'email', 'section', 'currentCGPA', 'standingArrearsCount', 'isPlaced', 'primaryGoal'];

  return students.map((s) => {
    const row = {};
    activeFields.forEach((fieldKey) => {
      const def = fieldDefinitions[fieldKey];
      row[def.label] = def.get(s);
    });
    return row;
  });
};

// @route   POST /api/mentor/export-excel
// @desc    Download Excel sheet of mentor's students with chosen columns
router.post('/export-excel', async (req, res) => {
  try {
    const dept = getMentorDept(req);
    const { chosenFields = [], filters = {} } = req.body;

    const query = {
      department: dept,
      mentorId: req.user._id,
    };

    if (filters.search && filters.search.trim() !== '') {
      const regex = new RegExp(filters.search.trim(), 'i');
      query.$or = [{ name: regex }, { rollNumber: regex }, { email: regex }];
    }

    if (filters.section && filters.section !== 'all') query.section = filters.section;
    if (filters.studentCategory && filters.studentCategory !== 'all') query.studentCategory = filters.studentCategory;
    if (filters.careerGoal && filters.careerGoal !== 'all') query['careerGoal.primaryGoal'] = filters.careerGoal;

    const students = await StudentProfile.find(query).sort({ rollNumber: 1 }).lean();
    const exportRows = buildMentorExportRows(students, chosenFields);

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(exportRows);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Mentees');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Mentees_${dept}_${req.user.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 4. COMMUNICATION HUB (RESTRICTED TO MENTEES & DEPT COORDINATORS)
// ==========================================
// @route   GET /api/mentor/communication/recipients
// @desc    Requirement 2: Return only the students under them and their department coordinators
router.get('/communication/recipients', async (req, res) => {
  try {
    const dept = getMentorDept(req);

    // 1. Students under this mentor
    const mentees = await User.find({
      role: 'student',
      department: dept,
      mentorId: req.user._id,
    }).select('name email role rollNumber').sort({ rollNumber: 1, name: 1 });

    // 2. Department coordinators in this department
    const coordinators = await User.find({
      role: 'department_coordinator',
      department: dept,
    }).select('name email role department').sort({ name: 1 });

    return res.status(200).json({
      success: true,
      recipients: {
        mentees,
        coordinators,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/mentor/messages
// @desc    Get messages sent by this mentor or addressed to this mentor
router.get('/messages', async (req, res) => {
  try {
    const dept = getMentorDept(req);
    const messages = await CommunicationMessage.find({
      $or: [
        { 'sender.userId': req.user._id },
        { 'recipients.userId': req.user._id },
        // Also capture department-level circulars relevant to mentors
        { department: dept, targetGroup: { $in: ['all_mentors', 'custom_selection'] } },
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

// @route   POST /api/mentor/messages
// @desc    Send message/circular to allowed recipients (mentees & department coordinators only)
router.post('/messages', async (req, res) => {
  const { subject, content, messageType, priority, targetGroup, selectedUserIds } = req.body;
  const dept = getMentorDept(req);

  if (!subject || !content) {
    return res.status(400).json({
      success: false,
      message: 'Subject and message content are required.',
    });
  }

  try {
    // Determine allowed recipients
    const allowedMenteeUsers = await User.find({
      role: 'student',
      department: dept,
      mentorId: req.user._id,
    }).select('_id name email role');

    const allowedCoordinatorUsers = await User.find({
      role: 'department_coordinator',
      department: dept,
    }).select('_id name email role');

    const allowedUserIdsSet = new Set([
      ...allowedMenteeUsers.map((u) => u._id.toString()),
      ...allowedCoordinatorUsers.map((u) => u._id.toString()),
    ]);

    let recipients = [];

    if (targetGroup === 'all_mentees') {
      recipients = allowedMenteeUsers.map((s) => ({
        userId: s._id,
        name: s.name,
        email: s.email,
        role: s.role,
      }));
    } else if (targetGroup === 'all_coordinators') {
      recipients = allowedCoordinatorUsers.map((c) => ({
        userId: c._id,
        name: c.name,
        email: c.email,
        role: c.role,
      }));
    } else if (Array.isArray(selectedUserIds) && selectedUserIds.length > 0) {
      // Validate that each selected user is allowed
      const validatedIds = selectedUserIds.filter((id) => allowedUserIdsSet.has(id.toString()));
      if (validatedIds.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You can only converse with students under your mentorship and your department coordinators.',
        });
      }

      const users = await User.find({ _id: { $in: validatedIds } }).select('name email role');
      recipients = users.map((u) => ({
        userId: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));
    } else {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one recipient.',
      });
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
        type: 'message_received',
        title: `New Message from ${req.user.name}: ${message.subject}`,
        message: `${req.user.name} sent: "${message.subject}"`,
        relatedId: message._id,
        link: '/?tab=communication',
      });
    }

    await logSystemEvent({
      level: 'info',
      module: 'user_management',
      action: 'MENTOR_MESSAGE_SENT',
      message: `Mentor '${req.user.name}' sent ${message.messageType} '${message.subject}' to ${recipients.length} recipients.`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Message sent successfully to ${recipients.length} recipient(s).`,
      communication: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/mentor/messages/:id/reply
// @desc    Reply to an ongoing message/enquiry thread
router.post('/messages/:id/reply', async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
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

// ==========================================
// 5. MENTOR PROFILE UPDATE
// ==========================================
// @route   PUT /api/mentor/profile
// @desc    Edit personal profile (name and email only; role and department locked)
router.put('/profile', async (req, res) => {
  const { name, email } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name && name.trim()) user.name = name.trim();
    if (email && email.trim()) {
      const emailLower = email.trim().toLowerCase();
      // Check if email already taken by another user
      const exists = await User.findOne({ email: emailLower, _id: { $ne: user._id } });
      if (exists) {
        return res.status(400).json({ success: false, message: 'Email address already in use by another account.' });
      }
      user.email = emailLower;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
