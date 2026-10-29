const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');
const DepartmentDrive = require('../models/DepartmentDrive');
const PlacementUnwillingness = require('../models/PlacementUnwillingness');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { logSystemEvent } = require('../utils/logger');

// All Excel endpoints require authentication (coordinator, mentor, placement_officer, admin)
router.use(protect);

// Helper to sanitize sheet names for Excel (max 31 chars, no invalid chars : \ / ? * [ ])
const sanitizeSheetName = (name, fallbackIndex = 1) => {
  if (!name) return `Drive_${fallbackIndex}`;
  const clean = name.replace(/[:\\/?*\[\]]/g, ' ').trim();
  const truncated = clean.substring(0, 31).trim();
  return truncated || `Drive_${fallbackIndex}`;
};

// Helper to determine department scope based on user role
const resolveDepartmentScope = (req) => {
  const { role, department } = req.user;
  const requestedDept = req.query.department || '';

  if (role === 'admin' || role === 'placement_officer') {
    return requestedDept && requestedDept !== 'all' ? requestedDept : null;
  }
  // Department coordinators and mentors are scoped to their department
  return department || null;
};

// ============================================================================
// EXCEL 1: QS I-GAUGE DATA 2025-26
// Exact format matching the institution's uploaded template
// ============================================================================
router.get('/1-qs-gauge', async (req, res) => {
  try {
    const deptScope = resolveDepartmentScope(req);
    const query = {};
    if (deptScope) {
      query.department = { $regex: new RegExp(`^${deptScope}$`, 'i') };
    }

    const students = await StudentProfile.find(query)
      .populate('userId', 'email name department role')
      .sort({ rollNumber: 1 })
      .lean();

    const deptLabel = deptScope ? deptScope.toUpperCase() : 'ALL DEPARTMENTS';

    // Construct raw rows matching exact template
    const rows = [
      [], // Row 1 (Empty)
      ['', '', '', '', '', 'QS I-Gauge Data-2025-26'], // Row 2
      ['', '', '', '', '', `Department : ${deptLabel}`], // Row 3
      ['', '', '', '', '', 'AY: 2025-2026'], // Row 4
      [], // Row 5 (Empty)
      [
        '', '', '',
        'Placement', '', '', '', '', '', '',
        'Self Employed/Entrepreneur', '', '', '',
        'Higher Studies', '', '', '', ''
      ], // Row 6
      [
        'S.No',
        'Roll No.',
        'Name ',
        'Name of the Company 1',
        'Annual Salary (Lakhs/Yr) in number',
        'ON/OFF CAMPUS',
        'Name of the Company 2',
        'Annual Salary (Lakhs/Yr) in number',
        'ON/OFF CAMPUS',
        'Remarks',
        'Name of the Company',
        'Designation',
        'Approx. Income (Lakhs/Yr) in number',
        'Remarks',
        'PG/PhD Program ',
        'Name of the University/ Institution',
        'Name of the Program',
        'Year of Admission (MMYYYY)',
        'Remarks',
      ], // Row 7
    ];

    let sNo = 1;
    students.forEach((s) => {
      const isPlacement = (s.careerGoal || '').toLowerCase() === 'placement';
      const isHigher = (s.careerGoal || '').toLowerCase().includes('higher');
      const isEnt = (s.careerGoal || '').toLowerCase().includes('entrepreneur');

      // Placement Company 1 & 2
      const offers = Array.isArray(s.placementOffers) ? s.placementOffers : [];
      let comp1Name = 'NA', comp1Salary = 'NA', comp1Type = 'NA';
      let comp2Name = 'NA', comp2Salary = 'NA', comp2Type = 'NA';

      if (isPlacement && (s.isPlaced === 'Yes' || offers.length > 0)) {
        if (offers.length > 0) {
          const off1 = offers[0];
          comp1Name = off1.companyName || 'NA';
          comp1Salary = off1.packageCTC ? Number(off1.packageCTC) : 'NA';
          comp1Type = off1.placementType || 'ON CAMPUS';

          if (offers.length > 1) {
            const off2 = offers[1];
            comp2Name = off2.companyName || 'NA';
            comp2Salary = off2.packageCTC ? Number(off2.packageCTC) : 'NA';
            comp2Type = off2.placementType || 'ON CAMPUS';
          }
        } else if (s.placedCompany) {
          comp1Name = s.placedCompany || 'NA';
          comp1Salary = s.salaryPackage ? Number(s.salaryPackage) : 'NA';
          comp1Type = s.placementType || 'ON CAMPUS';
        }
      }

      const placementRemarks = s.mentorRemarks?.placementRemarks || (isPlacement ? '' : 'NA');

      // Entrepreneurship columns
      let entComp = 'NA', entDesig = 'NA', entIncome = 'NA';
      if (isEnt) {
        entComp = s.entrepreneurshipDetails?.startupName || s.entrepreneurshipDetails?.companyName || 'NA';
        entDesig = s.entrepreneurshipDetails?.designation || 'Founder / Director';
        entIncome = s.entrepreneurshipDetails?.annualRevenue || s.entrepreneurshipDetails?.income || 'NA';
      }
      const entRemarks = s.mentorRemarks?.entrepreneurshipRemarks || (isEnt ? '' : 'NA');

      // Higher Studies columns
      let hsDegree = 'NA', hsInst = 'NA', hsProg = 'NA', hsYear = 'NA';
      if (isHigher) {
        hsDegree = s.higherStudiesDetails?.degree || s.higherStudiesDetails?.targetDegree || 'PG/PhD';
        hsInst = s.higherStudiesDetails?.institution || s.higherStudiesDetails?.targetInstitution || 'NA';
        hsProg = s.higherStudiesDetails?.fieldOfStudy || s.higherStudiesDetails?.specialization || 'NA';
        hsYear = s.higherStudiesDetails?.admissionYear || s.higherStudiesDetails?.expectedAdmissionYear || 'NA';
      }
      const hsRemarks = s.mentorRemarks?.higherStudiesRemarks || (isHigher ? '' : 'NA');

      rows.push([
        sNo++,
        s.rollNumber || 'NA',
        s.name || 'NA',
        comp1Name,
        comp1Salary,
        comp1Type,
        comp2Name,
        comp2Salary,
        comp2Type,
        placementRemarks || 'NA',
        entComp,
        entDesig,
        entIncome,
        entRemarks || 'NA',
        hsDegree,
        hsInst,
        hsProg,
        hsYear,
        hsRemarks || 'NA',
      ]);
    });

    const ws = xlsx.utils.aoa_to_sheet(rows);

    // Apply exact template merges
    ws['!merges'] = [
      { s: { c: 5, r: 1 }, e: { c: 13, r: 1 } }, // Title
      { s: { c: 5, r: 2 }, e: { c: 13, r: 2 } }, // Dept
      { s: { c: 5, r: 3 }, e: { c: 13, r: 3 } }, // AY
      { s: { c: 3, r: 5 }, e: { c: 9, r: 5 } },  // Placement
      { s: { c: 10, r: 5 }, e: { c: 13, r: 5 } }, // Entrepreneur
      { s: { c: 14, r: 5 }, e: { c: 18, r: 5 } }, // Higher Studies
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 8 },  // S.No
      { wch: 14 }, // Roll No
      { wch: 24 }, // Name
      { wch: 24 }, // Comp 1
      { wch: 16 }, // Salary 1
      { wch: 14 }, // On/off
      { wch: 24 }, // Comp 2
      { wch: 16 }, // Salary 2
      { wch: 14 }, // On/off
      { wch: 20 }, // Remarks
      { wch: 24 }, // Ent Comp
      { wch: 20 }, // Designation
      { wch: 18 }, // Income
      { wch: 20 }, // Remarks
      { wch: 18 }, // Degree
      { wch: 28 }, // Inst
      { wch: 24 }, // Prog
      { wch: 16 }, // Year
      { wch: 20 }, // Remarks
    ];

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'QS I-Gauge');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `QS_I-Gauge_Data_${deptLabel.replace(/[^A-Za-z0-9]/g, '_')}_2025-26.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel 1 (QS I-Gauge):', error);
    return res.status(500).json({ success: false, message: 'Failed to generate QS I-Gauge Excel', error: error.message });
  }
});

// ============================================================================
// EXCEL 2: CUSTOM FILTERED EXCEL WITH CUSTOM FIELDS
// ============================================================================
router.post('/2-custom-export', async (req, res) => {
  try {
    const {
      selectedFields = [],
      department = 'all',
      section = 'all',
      studentCategory = 'all',
      cgpaMin = 0,
      cgpaMax = 10,
      careerGoal = 'all',
      arrearFilter = 'all',
      isPlaced = 'all',
      placementType = 'all',
      search = '',
    } = req.body;

    const deptScope = resolveDepartmentScope(req);
    const andClauses = [];

    if (deptScope) {
      andClauses.push({ department: { $regex: new RegExp(`^${deptScope}$`, 'i') } });
    } else if (department && department !== 'all') {
      andClauses.push({ department: { $regex: new RegExp(`^${department}$`, 'i') } });
    }

    if (section && section !== 'all') {
      andClauses.push({ section: { $regex: new RegExp(`^${section}$`, 'i') } });
    }
    if (studentCategory && studentCategory !== 'all') {
      andClauses.push({ studentCategory: { $regex: new RegExp(`^${studentCategory}$`, 'i') } });
    }
    if (careerGoal && careerGoal !== 'all') {
      andClauses.push({ careerGoal: { $regex: new RegExp(`^${careerGoal}$`, 'i') } });
    }
    if (isPlaced && isPlaced !== 'all') {
      andClauses.push({ isPlaced });
    }
    if (placementType && placementType !== 'all') {
      andClauses.push({ placementType });
    }

    if (cgpaMin !== undefined || cgpaMax !== undefined) {
      andClauses.push({
        currentCGPA: {
          $gte: Number(cgpaMin) || 0,
          $lte: Number(cgpaMax) || 10,
        },
      });
    }

    if (arrearFilter === 'standing') {
      andClauses.push({ standingArrearsCount: { $gt: 0 } });
    } else if (arrearFilter === 'history') {
      andClauses.push({ historyArrearsCount: { $gt: 0 } });
    } else if (arrearFilter === 'none') {
      andClauses.push({ standingArrearsCount: 0, historyArrearsCount: 0 });
    }

    if (search && search.trim()) {
      const q = search.trim();
      andClauses.push({
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { rollNumber: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      });
    }

    const query = andClauses.length > 0 ? { $and: andClauses } : {};
    const students = await StudentProfile.find(query).sort({ rollNumber: 1 }).lean();

    // Default field set if none specified
    const fieldsToExport = selectedFields.length > 0 ? selectedFields : [
      'rollNumber', 'name', 'department', 'section', 'email', 'contactNumber',
      'currentCGPA', 'standingArrearsCount', 'historyArrearsCount', 'careerGoal', 'isPlaced'
    ];

    const headerLabels = {
      rollNumber: 'Roll Number',
      registerNumber: 'Register Number',
      name: 'Student Name',
      department: 'Department',
      section: 'Section',
      email: 'Institutional Email',
      personalEmail: 'Personal Email',
      contactNumber: 'Mobile Number',
      studentCategory: 'Category (Hosteller/Day Scholar)',
      currentCGPA: 'Current CGPA',
      standingArrearsCount: 'Standing Arrears',
      historyArrearsCount: 'History Arrears',
      clearedArrearsCount: 'Cleared Arrears',
      careerGoal: 'Career Goal',
      isPlaced: 'Placed (Yes/No)',
      placedCompany: 'Placed Company',
      salaryPackage: 'CTC (LPA)',
      placementType: 'Placement Type (On/Off)',
      profileCompleteness: 'Profile Completeness %',
    };

    const rows = [
      fieldsToExport.map(f => headerLabels[f] || f)
    ];

    students.forEach((s) => {
      const row = fieldsToExport.map((f) => {
        const val = s[f];
        if (val === undefined || val === null || val === '') return 'NA';
        return val;
      });
      rows.push(row);
    });

    const ws = xlsx.utils.aoa_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Filtered_Students');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Custom_Filtered_Students_${Date.now()}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel 2 (Custom Export):', error);
    return res.status(500).json({ success: false, message: 'Failed to generate custom export', error: error.message });
  }
});

// ============================================================================
// EXCEL 3: EACH DRIVE DETAIL EXCEL (MULTI-SHEET WORKBOOK)
// Separate sheet per drive with eligible students and opt-in/out/removed/blocked status
// ============================================================================
router.get('/3-drives-detail', async (req, res) => {
  try {
    const deptScope = resolveDepartmentScope(req);
    const driveQuery = {};

    if (deptScope) {
      // Coordinator/Mentor sees department drives or college drives that include their dept
      driveQuery.$or = [
        { department: { $regex: new RegExp(`^${deptScope}$`, 'i') } },
        { driveScope: 'college_wide' },
        { eligibleDepartments: { $in: [deptScope.toUpperCase()] } },
      ];
    }

    const drives = await DepartmentDrive.find(driveQuery).sort({ createdAt: -1 }).lean();

    if (drives.length === 0) {
      return res.status(404).json({ success: false, message: 'No drives found matching criteria' });
    }

    // Get all students to check eligibility per drive
    const studentQuery = deptScope ? { department: { $regex: new RegExp(`^${deptScope}$`, 'i') } } : {};
    const allStudents = await StudentProfile.find(studentQuery).sort({ rollNumber: 1 }).lean();

    const wb = xlsx.utils.book_new();
    const usedSheetNames = new Set();

    drives.forEach((drive, driveIdx) => {
      let sheetName = sanitizeSheetName(drive.companyName || `Drive_${driveIdx + 1}`, driveIdx + 1);
      // Ensure unique sheet name within 31 characters
      let counter = 1;
      let finalSheetName = sheetName;
      while (usedSheetNames.has(finalSheetName.toLowerCase())) {
        finalSheetName = `${sheetName.substring(0, 27)}_${counter++}`;
      }
      usedSheetNames.add(finalSheetName.toLowerCase());

      const optInsMap = new Map();
      (drive.optIns || []).forEach((opt) => {
        if (opt.rollNumber) {
          optInsMap.set(opt.rollNumber.trim().toUpperCase(), opt);
        } else if (opt.studentId) {
          optInsMap.set(String(opt.studentId), opt);
        }
      });

      const evaluationsMap = new Map();
      (drive.roundEvaluations || []).forEach((ev) => {
        if (ev.rollNumber) {
          evaluationsMap.set(ev.rollNumber.trim().toUpperCase(), ev);
        }
      });

      // Filter eligible students for this drive
      const eligibleStudents = allStudents.filter((s) => {
        // Department eligibility
        if (drive.eligibleDepartments && drive.eligibleDepartments.length > 0) {
          const sDept = (s.department || '').toUpperCase();
          const match = drive.eligibleDepartments.some(d => d.toUpperCase() === sDept);
          if (!match && drive.department?.toUpperCase() !== sDept) return false;
        }
        // Min CGPA
        if (drive.minCGPA > 0 && (s.currentCGPA || 0) < drive.minCGPA) return false;
        // Standing Arrears
        if (!drive.standingArrearsAllowed && (s.standingArrearsCount || 0) > 0) return false;
        if (drive.standingArrearsAllowed && (s.standingArrearsCount || 0) > (drive.maxStandingArrears || 0)) return false;
        // History Arrears
        if (!drive.historyArrearsAllowed && (s.historyArrearsCount || 0) > 0) return false;
        if (drive.historyArrearsAllowed && (s.historyArrearsCount || 0) > (drive.maxHistoryArrears || 0)) return false;
        return true;
      });

      const rows = [
        [`Drive: ${drive.companyName}`, `Location: ${drive.jobLocation}`, `Type: ${drive.driveType || 'Off-Campus'}`, `Offer: ${drive.offerType || 'Full Time'}`],
        [`Min CGPA: ${drive.minCGPA}`, `Standing Arrears Allowed: ${drive.standingArrearsAllowed ? drive.maxStandingArrears : 'No'}`, `History Arrears Allowed: ${drive.historyArrearsAllowed ? drive.maxHistoryArrears : 'No'}`],
        [],
        [
          'S.No',
          'Roll Number',
          'Student Name',
          'Department',
          'Section',
          'Institutional Email',
          'Mobile',
          'Current CGPA',
          'Standing Arrears',
          'History Arrears',
          'Status (Opted-In / Opted-Out / Removed / Blocked)',
          'Selected Roles',
          'Evaluation Status',
          'Placed Role & CTC',
        ]
      ];

      eligibleStudents.forEach((st, idx) => {
        const rollKey = (st.rollNumber || '').trim().toUpperCase();
        const opt = optInsMap.get(rollKey);
        const evalRec = evaluationsMap.get(rollKey);

        let optStatus = 'Not Opted';
        let selectedRoles = 'NA';
        if (opt) {
          optStatus = opt.status || 'Opted-In';
          selectedRoles = Array.isArray(opt.selectedRoles) && opt.selectedRoles.length > 0
            ? opt.selectedRoles.join(', ')
            : 'General';
        }

        const evalStatus = evalRec ? evalRec.finalStatus || 'In Progress' : 'Pending';
        const placedDetails = evalRec && evalRec.finalStatus === 'Placed'
          ? `${evalRec.placedRole || 'Standard'} @ ${evalRec.placedCTC || 'Offer CTC'}`
          : 'NA';

        rows.push([
          idx + 1,
          st.rollNumber || 'NA',
          st.name || 'NA',
          st.department || 'NA',
          st.section || 'NA',
          st.email || 'NA',
          st.contactNumber || 'NA',
          st.currentCGPA || 0,
          st.standingArrearsCount || 0,
          st.historyArrearsCount || 0,
          optStatus,
          selectedRoles,
          evalStatus,
          placedDetails,
        ]);
      });

      const ws = xlsx.utils.aoa_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },  // S.No
        { wch: 14 }, // Roll
        { wch: 24 }, // Name
        { wch: 14 }, // Dept
        { wch: 8 },  // Sec
        { wch: 28 }, // Email
        { wch: 14 }, // Mobile
        { wch: 12 }, // CGPA
        { wch: 16 }, // Standing
        { wch: 16 }, // History
        { wch: 20 }, // Opt status
        { wch: 22 }, // Roles
        { wch: 18 }, // Eval
        { wch: 24 }, // Placed details
      ];

      xlsx.utils.book_append_sheet(wb, ws, finalSheetName);
    });

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Drive_Details_Workbook_${Date.now()}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel 3 (Drive Details):', error);
    return res.status(500).json({ success: false, message: 'Failed to generate drive detail excel', error: error.message });
  }
});

// ============================================================================
// EXCEL 4: COMPLETE MASTER TRACKING MATRIX (ONLY PLACEMENT OPTED STUDENTS)
// Y-axis: Student Name, Roll No, Dept, Sec, Email
// X-axis: All Drives with [Drive Name] Eligible/Not, Opted/Not, Placed/Not
// ============================================================================
router.get('/4-master-tracking', async (req, res) => {
  try {
    const deptScope = resolveDepartmentScope(req);
    const studentQuery = {
      careerGoal: { $regex: /^placement$/i },
    };

    if (deptScope) {
      studentQuery.department = { $regex: new RegExp(`^${deptScope}$`, 'i') };
    }

    const students = await StudentProfile.find(studentQuery).sort({ rollNumber: 1 }).lean();
    const allDrives = await DepartmentDrive.find({}).sort({ createdAt: 1 }).lean();

    // Prepare Header row
    const headers = [
      'S.No',
      'Roll Number',
      'Student Name',
      'Department',
      'Section',
      'Institutional Email',
      'Mobile Number',
      'Current CGPA',
      'Standing Arrears',
      'History Arrears',
    ];

    // For each drive, create columns: Eligible/Not, Opted/Not, Placed/Not, Role & CTC
    allDrives.forEach((d) => {
      const cName = d.companyName || 'Drive';
      headers.push(`${cName} - Eligible/Not`);
      headers.push(`${cName} - Opted/Not`);
      headers.push(`${cName} - Placed/Not`);
      headers.push(`${cName} - Role & CTC`);
    });

    const rows = [headers];

    students.forEach((st, sIdx) => {
      const row = [
        sIdx + 1,
        st.rollNumber || 'NA',
        st.name || 'NA',
        st.department || 'NA',
        st.section || 'NA',
        st.email || 'NA',
        st.contactNumber || 'NA',
        st.currentCGPA || 0,
        st.standingArrearsCount || 0,
        st.historyArrearsCount || 0,
      ];

      allDrives.forEach((d) => {
        // Eligibility check
        let isEligible = true;
        if (d.eligibleDepartments && d.eligibleDepartments.length > 0) {
          const match = d.eligibleDepartments.some(dept => dept.toUpperCase() === (st.department || '').toUpperCase());
          if (!match && d.department?.toUpperCase() !== (st.department || '').toUpperCase()) isEligible = false;
        }
        if (d.minCGPA > 0 && (st.currentCGPA || 0) < d.minCGPA) isEligible = false;
        if (!d.standingArrearsAllowed && (st.standingArrearsCount || 0) > 0) isEligible = false;
        if (d.standingArrearsAllowed && (st.standingArrearsCount || 0) > (d.maxStandingArrears || 0)) isEligible = false;
        if (!d.historyArrearsAllowed && (st.historyArrearsCount || 0) > 0) isEligible = false;
        if (d.historyArrearsAllowed && (st.historyArrearsCount || 0) > (d.maxHistoryArrears || 0)) isEligible = false;

        // Opted check: Opted-In is Opted; Opted-Out, Removed, Blocked, or not present is Not
        const optRecord = (d.optIns || []).find(o =>
          (o.rollNumber && o.rollNumber.trim().toUpperCase() === (st.rollNumber || '').trim().toUpperCase()) ||
          (o.studentId && String(o.studentId) === String(st.userId))
        );

        const isOpted = optRecord && optRecord.status === 'Opted-In';

        // Placed check
        const evalRecord = (d.roundEvaluations || []).find(e =>
          (e.rollNumber && e.rollNumber.trim().toUpperCase() === (st.rollNumber || '').trim().toUpperCase()) ||
          (e.studentId && String(e.studentId) === String(st.userId))
        );

        const isPlaced = evalRecord && evalRecord.finalStatus === 'Placed';
        const roleAndCTC = isPlaced
          ? `${evalRecord.placedRole || 'Standard'} (${evalRecord.placedCTC || d.roles?.[0]?.ctc || 'Standard'})`
          : 'NA';

        row.push(isEligible ? 'Eligible' : 'Not Eligible');
        row.push(isOpted ? 'Opted' : 'Not');
        row.push(isPlaced ? 'Placed' : 'Not Placed');
        row.push(roleAndCTC);
      });

      rows.push(row);
    });

    const ws = xlsx.utils.aoa_to_sheet(rows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Master_Placement_Matrix');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Master_Placement_Matrix_${Date.now()}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel 4 (Master Tracking Matrix):', error);
    return res.status(500).json({ success: false, message: 'Failed to generate master tracking matrix', error: error.message });
  }
});

// ============================================================================
// EXCEL 5: UNWILLINGNESS & PLACED WORKBOOK (DUAL SHEET)
// Sheet 1: Placement Unwillingness (Higher Studies & Entrepreneurship)
// Sheet 2: Placement Records (Placement Opted Students with full details)
// ============================================================================
router.get('/5-unwillingness-and-placed', async (req, res) => {
  try {
    const deptScope = resolveDepartmentScope(req);
    const filterDept = deptScope ? { department: { $regex: new RegExp(`^${deptScope}$`, 'i') } } : {};

    // 1. Unwillingness records (Higher Studies and Entrepreneurship students)
    const nonPlacementStudents = await StudentProfile.find({
      ...filterDept,
      careerGoal: { $in: ['Higher Studies', 'Entrepreneurship'] },
    }).sort({ rollNumber: 1 }).lean();

    // Fetch submitted unwillingness forms
    const activeForm = await PlacementUnwillingness.findOne({ isActive: true }).lean();
    const submissionsMap = new Map();
    if (activeForm && activeForm.submissions) {
      activeForm.submissions.forEach((sub) => {
        if (sub.rollNumber) {
          submissionsMap.set(sub.rollNumber.trim().toUpperCase(), sub);
        }
      });
    }

    const unwillingnessHeaders = [
      'S.No',
      'Roll Number',
      'Student Name',
      'Department',
      'Section',
      'Institutional Email',
      'Mobile',
      'Current CGPA',
      'Career Choice',
      'Target Degree / Startup Name',
      'Target Institution / Industry',
      'Country / Stage',
      'Submission Status',
      'Reason For Unwillingness',
      'Form Locked (Cannot Switch to Placement)',
      'Permitted Switch Back',
      'Submission Date',
    ];

    const unwillingnessRows = [unwillingnessHeaders];

    nonPlacementStudents.forEach((st, idx) => {
      const rollKey = (st.rollNumber || '').trim().toUpperCase();
      const sub = submissionsMap.get(rollKey);

      const isHigher = (st.careerGoal || '').toLowerCase().includes('higher');
      const target1 = isHigher
        ? (st.higherStudiesDetails?.degree || sub?.higherStudiesDetails?.targetDegree || 'NA')
        : (st.entrepreneurshipDetails?.startupName || sub?.entrepreneurshipDetails?.startupName || 'NA');

      const target2 = isHigher
        ? (st.higherStudiesDetails?.institution || sub?.higherStudiesDetails?.specialization || 'NA')
        : (st.entrepreneurshipDetails?.industry || sub?.entrepreneurshipDetails?.industry || 'NA');

      const target3 = isHigher
        ? (st.higherStudiesDetails?.countryPreference || sub?.higherStudiesDetails?.countryPreference || 'NA')
        : (st.entrepreneurshipDetails?.currentStage || sub?.entrepreneurshipDetails?.currentStage || 'NA');

      const submissionStatus = sub ? 'Submitted' : 'Pending Submission';
      const reason = sub ? sub.reasonForUnwillingness || 'Formal Undertaking Filed' : 'Pending Undertaking';
      const isLocked = sub ? (sub.isLocked ? 'Yes (Locked)' : 'No') : 'Not Submitted';
      const permittedSwitch = sub && sub.allowPlacementSwitch ? 'Permitted by Placement Officer' : 'No';
      const submissionDate = sub && sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'NA';

      unwillingnessRows.push([
        idx + 1,
        st.rollNumber || 'NA',
        st.name || 'NA',
        st.department || 'NA',
        st.section || 'NA',
        st.email || 'NA',
        st.contactNumber || 'NA',
        st.currentCGPA || 0,
        st.careerGoal || 'NA',
        target1,
        target2,
        target3,
        submissionStatus,
        reason,
        isLocked,
        permittedSwitch,
        submissionDate,
      ]);
    });

    // 2. Placement Records (Students opted for placement who have offers or are placed)
    const placedStudents = await StudentProfile.find({
      ...filterDept,
      careerGoal: { $regex: /^placement$/i },
      $or: [
        { isPlaced: 'Yes' },
        { 'placementOffers.0': { $exists: true } },
      ],
    }).sort({ rollNumber: 1 }).lean();

    const placedHeaders = [
      'S.No',
      'Roll Number',
      'Student Name',
      'Department',
      'Section',
      'Institutional Email',
      'Mobile Number',
      'Current CGPA',
      'Offer Number',
      'Company Name',
      'Job Role',
      'Package CTC (LPA)',
      'Placement Type (On/Off Campus)',
      'Offer Type (Full Time / Intern / Intern + FT)',
      'Offer Date',
    ];

    const placedRows = [placedHeaders];
    let placedRowIndex = 1;

    placedStudents.forEach((st) => {
      const offers = Array.isArray(st.placementOffers) && st.placementOffers.length > 0
        ? st.placementOffers
        : [
            {
              companyName: st.placedCompany || 'Campus Drive Recruiter',
              jobRole: st.jobRole || 'Software Engineer',
              packageCTC: st.salaryPackage || 0,
              placementType: st.placementType || 'On-Campus',
              offerType: 'Full Time',
              dateOfOffer: st.updatedAt || new Date(),
            },
          ];

      offers.forEach((off, oIdx) => {
        placedRows.push([
          placedRowIndex++,
          st.rollNumber || 'NA',
          st.name || 'NA',
          st.department || 'NA',
          st.section || 'NA',
          st.email || 'NA',
          st.contactNumber || 'NA',
          st.currentCGPA || 0,
          `Offer ${oIdx + 1}`,
          off.companyName || 'NA',
          off.jobRole || 'NA',
          off.packageCTC ? Number(off.packageCTC) : 'NA',
          off.placementType || 'On-Campus',
          off.offerType || 'Full Time',
          off.dateOfOffer ? new Date(off.dateOfOffer).toLocaleDateString() : 'NA',
        ]);
      });
    });

    const wb = xlsx.utils.book_new();

    const ws1 = xlsx.utils.aoa_to_sheet(unwillingnessRows);
    ws1['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 14 }, // Roll
      { wch: 24 }, // Name
      { wch: 14 }, // Dept
      { wch: 8 },  // Sec
      { wch: 28 }, // Email
      { wch: 14 }, // Mobile
      { wch: 10 }, // CGPA
      { wch: 18 }, // Choice
      { wch: 24 }, // Target 1
      { wch: 24 }, // Target 2
      { wch: 16 }, // Target 3
      { wch: 20 }, // Status
      { wch: 26 }, // Reason
      { wch: 16 }, // Locked
      { wch: 22 }, // Permitted
      { wch: 16 }, // Date
    ];
    xlsx.utils.book_append_sheet(wb, ws1, 'Placement_Unwillingness');

    const ws2 = xlsx.utils.aoa_to_sheet(placedRows);
    ws2['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 14 }, // Roll
      { wch: 24 }, // Name
      { wch: 14 }, // Dept
      { wch: 8 },  // Sec
      { wch: 28 }, // Email
      { wch: 14 }, // Mobile
      { wch: 10 }, // CGPA
      { wch: 12 }, // Offer #
      { wch: 26 }, // Company
      { wch: 22 }, // Role
      { wch: 16 }, // CTC
      { wch: 18 }, // On/off
      { wch: 22 }, // Offer type
      { wch: 16 }, // Date
    ];
    xlsx.utils.book_append_sheet(wb, ws2, 'Placement_Records');

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Unwillingness_and_Placed_Students_${Date.now()}.xlsx"`);
    return res.send(buffer);
  } catch (error) {
    console.error('Error generating Excel 5 (Unwillingness & Placed):', error);
    return res.status(500).json({ success: false, message: 'Failed to generate unwillingness & placed excel', error: error.message });
  }
});

module.exports = router;
