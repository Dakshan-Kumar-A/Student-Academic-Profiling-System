const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const SystemLog = require('../models/SystemLog');
const StudentProfile = require('../models/StudentProfile');
const DynamicField = require('../models/DynamicField');
const { protect, authorize } = require('../middleware/auth');
const { generateTempPassword, sendTempPasswordEmail } = require('../utils/mailer');
const { logSystemEvent } = require('../utils/logger');
const { createNotification } = require('../services/notificationService');

// Setup multer memory storage for excel file parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid Excel (.xlsx, .xls) or CSV file.'));
    }
  },
});

// All routes here require Admin role
router.use(protect);
router.use(authorize('admin'));

// ==========================================
// 1. STATS / DASHBOARD OVERVIEW (WITH CHARTS & FILTERS)
// ==========================================
router.get('/stats', async (req, res) => {
  try {
    const { department, startDate, endDate } = req.query;

    const userBaseFilter = {};
    if (department && department !== 'all') {
      userBaseFilter.department = department;
    }

    // Role-specific counts with department filter
    const totalOfficers = await User.countDocuments({ ...userBaseFilter, role: 'placement_officer' });
    const totalCoordinators = await User.countDocuments({ ...userBaseFilter, role: 'department_coordinator' });
    const totalMentors = await User.countDocuments({ ...userBaseFilter, role: 'mentor' });
    const totalStudents = await User.countDocuments({ ...userBaseFilter, role: 'student' });
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const totalUsers = await User.countDocuments(userBaseFilter);

    const activeUsers = await User.countDocuments({ ...userBaseFilter, status: 'active' });
    const inactiveUsers = await User.countDocuments({ ...userBaseFilter, status: 'inactive' });
    const pendingFirstLogins = await User.countDocuments({
      ...userBaseFilter,
      mustChangePassword: true,
    });

    // Time-based system log filtering
    const logTimeFilter = {};
    if (startDate || endDate) {
      logTimeFilter.timestamp = {};
      if (startDate) logTimeFilter.timestamp.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        logTimeFilter.timestamp.$lte = end;
      }
    }

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentErrors = await SystemLog.countDocuments({
      isError: true,
      timestamp: { $gte: twentyFourHoursAgo },
    });

    const totalLogs = await SystemLog.countDocuments(logTimeFilter);

    // Department Breakdown for Bar Graphs
    const knownDepts = ['CSE', 'ECE', 'MECH', 'EEE', 'IT', 'CIVIL', 'Placement Cell'];
    const deptAgg = await User.aggregate([
      { $match: { department: { $ne: '' } } },
      {
        $group: {
          _id: '$department',
          studentsCount: {
            $sum: { $cond: [{ $eq: ['$role', 'student'] }, 1, 0] },
          },
          staffCount: {
            $sum: { $cond: [{ $in: ['$role', ['department_coordinator', 'mentor', 'placement_officer']] }, 1, 0] },
          },
          total: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    // Ensure all standard departments are included in output
    const deptMap = {};
    deptAgg.forEach((d) => {
      deptMap[d._id] = d;
    });
    knownDepts.forEach((dName) => {
      if (!deptMap[dName]) {
        deptMap[dName] = { _id: dName, studentsCount: 0, staffCount: 0, total: 0 };
      }
    });
    const departmentBreakdown = Object.values(deptMap);

    // 7-day Activity Trend for Line/Bar charts
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const trendAgg = await SystemLog.aggregate([
      { $match: { timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          totalEvents: { $sum: 1 },
          errorEvents: { $sum: { $cond: ['$isError', 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill missing dates in trend
    const activityTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const found = trendAgg.find((t) => t._id === dateKey);
      activityTrend.push({
        date: dateKey,
        label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        totalEvents: found ? found.totalEvents : 0,
        errorEvents: found ? found.errorEvents : 0,
      });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalOfficers,
        totalCoordinators,
        totalMentors,
        totalStudents,
        totalAdmins,
        totalUsers,
        activeUsers,
        inactiveUsers,
        pendingFirstLogins,
        recentErrors,
        totalLogs,
        roleDistribution: {
          'Placement Officers': totalOfficers,
          'Dept Coordinators': totalCoordinators,
          'Faculty Mentors': totalMentors,
          'Students': totalStudents,
          'Administrators': totalAdmins,
        },
        departmentBreakdown,
        activityTrend,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 2. CRUD PLACEMENT OFFICERS & COORDINATORS
// ==========================================

// @route   GET /api/admin/users
// @desc    Get all staff (coordinators and placement officers) with optional search & filter
router.get('/users', async (req, res) => {
  try {
    const { role, department, search, status } = req.query;
    const query = { role: { $in: ['placement_officer', 'department_coordinator'] } };

    if (role && ['placement_officer', 'department_coordinator', 'student'].includes(role)) {
      query.role = role;
    }
    if (department) {
      query.department = department;
    }
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password -tempPassword.codeHash')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/users
// @desc    Add placement officer or department coordinator & send 24-hr single-use temp password
router.post('/users', async (req, res) => {
  const { name, email, role, department } = req.body;

  if (!name || !email || !role) {
    return res.status(400).json({
      success: false,
      message: 'Name, email, and role are mandatory fields.',
    });
  }

  if (!['placement_officer', 'department_coordinator'].includes(role)) {
    return res.status(400).json({
      success: false,
      message: 'Role must be either "placement_officer" or "department_coordinator".',
    });
  }

  if (role === 'department_coordinator' && !department) {
    return res.status(400).json({
      success: false,
      message: 'Department is required for Department Coordinators.',
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `A user with email '${normalizedEmail}' already exists.`,
      });
    }

    // Generate 8-character single-use temporary password
    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);
    const codeHash = await bcrypt.hash(tempPassword, salt);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword, // will be replaced once user creates permanent password
      role,
      department: department ? department.trim() : '',
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

    // Send email with single-use temporary password
    let emailResult = { previewUrl: null };
    try {
      emailResult = await sendTempPasswordEmail({
        toEmail: user.email,
        recipientName: user.name,
        tempPassword,
        purpose: 'account_creation',
      });
    } catch (mailErr) {
      console.error('Mail delivery warning:', mailErr.message);
    }

    await logSystemEvent({
      level: 'info',
      module: 'user_management',
      action: 'USER_CREATED',
      message: `Admin '${req.user.name}' created ${role} account for '${user.name}' (${user.email})`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      targetUser: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
      details: { role, department: user.department },
    });

    return res.status(201).json({
      success: true,
      message: `${role === 'placement_officer' ? 'Placement Officer' : 'Department Coordinator'} created successfully. Invitation email sent.`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status,
        mustChangePassword: user.mustChangePassword,
        tempPasswordExpiresAt: user.tempPassword.expiresAt,
      },
      previewUrl: emailResult.previewUrl,
      demoTempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
    });
  } catch (error) {
    await logSystemEvent({
      level: 'error',
      isError: true,
      module: 'user_management',
      action: 'USER_CREATE_ERROR',
      message: `Failed to create staff user: ${error.message}`,
      error,
      req,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to create user.',
      error: error.message,
    });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user details
router.put('/users/:id', async (req, res) => {
  const { name, email, role, department, status } = req.body;

  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'admin' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Cannot modify another admin account.' });
    }

    if (name) user.name = name.trim();
    if (department !== undefined) user.department = department.trim();
    if (role && ['placement_officer', 'department_coordinator', 'student'].includes(role)) {
      user.role = role;
    }
    if (status && ['active', 'inactive'].includes(status)) {
      user.status = status;
    }
    if (email && email.toLowerCase().trim() !== user.email) {
      const emailExists = await User.findOne({ email: email.toLowerCase().trim(), _id: { $ne: user._id } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email address already in use.' });
      }
      user.email = email.toLowerCase().trim();
    }

    await user.save();

    await logSystemEvent({
      level: 'info',
      module: 'user_management',
      action: 'USER_UPDATED',
      message: `User '${user.name}' (${user.email}) updated by Admin '${req.user.name}'`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      targetUser: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
      details: { updatedFields: { name, email, role, department, status } },
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        status: user.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Admin cannot delete their own account.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await User.findByIdAndDelete(req.params.id);

    await logSystemEvent({
      level: 'warn',
      module: 'user_management',
      action: 'USER_DELETED',
      message: `User '${user.name}' (${user.email}, ${user.role}) was deleted by Admin '${req.user.name}'`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      targetUser: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `User '${user.name}' has been permanently deleted.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/users/:id/resend-invite
// @desc    Regenerate single-use 24hr temp password & re-send invitation email
router.post('/users/:id/resend-invite', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(tempPassword, salt);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    user.password = hashedPassword;
    user.mustChangePassword = true;
    user.tempPassword = {
      codeHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isUsed: false,
      purpose: 'account_creation',
    };

    await user.save();

    let emailResult = { previewUrl: null };
    try {
      emailResult = await sendTempPasswordEmail({
        toEmail: user.email,
        recipientName: user.name,
        tempPassword,
        purpose: 'account_creation',
      });
    } catch (mailErr) {
      console.error('Mail delivery warning:', mailErr.message);
    }

    await logSystemEvent({
      level: 'info',
      module: 'user_management',
      action: 'INVITE_RESENT',
      message: `New 24-hr single-use temporary password issued for '${user.email}' by Admin '${req.user.name}'`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      targetUser: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `New invitation email with a 24-hour single-use temporary password dispatched to ${user.email}.`,
      previewUrl: emailResult.previewUrl,
      demoTempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 3. EXCEL SHEET BULK UPLOAD
// ==========================================
// @route   POST /api/admin/users/bulk-upload
// @desc    Parse Excel (.xlsx/.csv), create users, send single-use 24-hr temp password emails
router.post('/users/bulk-upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload an Excel or CSV file.' });
  }

  try {
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'The uploaded spreadsheet is empty.' });
    }

    const results = {
      totalRows: rows.length,
      createdCount: 0,
      skippedCount: 0,
      createdUsers: [],
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // header is row 1

      // Find fields flexibly (case-insensitive keys)
      const name = row.Name || row.name || row['Full Name'] || '';
      const email = (row.Email || row.email || '').toString().toLowerCase().trim();
      let roleRaw = (row.Role || row.role || '').toString().toLowerCase().trim();
      const department = (row.Department || row.department || row.Dept || '').toString().trim();

      // Normalize role
      let role = '';
      if (roleRaw.includes('placement') || roleRaw === 'po' || roleRaw === 'officer') {
        role = 'placement_officer';
      } else if (roleRaw.includes('coordinator') || roleRaw === 'dc' || roleRaw === 'faculty') {
        role = 'department_coordinator';
      }

      if (!name || !email) {
        results.skippedCount++;
        results.errors.push({ row: rowNum, reason: 'Missing Name or Email' });
        continue;
      }

      if (!role) {
        results.skippedCount++;
        results.errors.push({
          row: rowNum,
          email,
          reason: `Invalid Role '${rowRaw}'. Must be 'Placement Officer' or 'Department Coordinator'.`,
        });
        continue;
      }

      // Check if email already exists
      const existing = await User.findOne({ email });
      if (existing) {
        results.skippedCount++;
        results.errors.push({ row: rowNum, email, reason: 'Email already exists in database.' });
        continue;
      }

      try {
        const tempPassword = generateTempPassword();
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);
        const codeHash = await bcrypt.hash(tempPassword, salt);

        const newUser = new User({
          name: name.trim(),
          email,
          password: hashedPassword,
          role,
          department,
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

        // Send email
        try {
          await sendTempPasswordEmail({
            toEmail: newUser.email,
            recipientName: newUser.name,
            tempPassword,
            purpose: 'account_creation',
          });
        } catch (mailErr) {
          console.warn(`Failed to dispatch email to ${newUser.email}:`, mailErr.message);
        }

        results.createdCount++;
        results.createdUsers.push({
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          department: newUser.department,
          demoTempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
        });
      } catch (rowErr) {
        results.skippedCount++;
        results.errors.push({ row: rowNum, email, reason: rowErr.message });
      }
    }

    await logSystemEvent({
      level: results.errors.length > 0 ? 'warn' : 'info',
      module: 'excel_import',
      action: 'BULK_USER_IMPORT',
      message: `Bulk import completed: ${results.createdCount} created, ${results.skippedCount} skipped from file '${req.file.originalname}'`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
      details: {
        fileName: req.file.originalname,
        totalRows: results.totalRows,
        createdCount: results.createdCount,
        skippedCount: results.skippedCount,
      },
    });

    return res.status(200).json({
      success: true,
      message: `Processed ${results.totalRows} rows. Successfully created ${results.createdCount} users.`,
      results,
    });
  } catch (error) {
    await logSystemEvent({
      level: 'error',
      isError: true,
      module: 'excel_import',
      action: 'BULK_IMPORT_CRASH',
      message: `Bulk upload error: ${error.message}`,
      error,
      req,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to process Excel file.',
      error: error.message,
    });
  }
});

// ==========================================
// 4. COMPLETE SYSTEM LOG WINDOW & FILTERING
// ==========================================
// @route   GET /api/admin/logs
// @desc    Retrieve logs with filters (date range, time, error/not, level, module, search)
router.get('/logs', async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      isError,
      level,
      module: logModule,
      action,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        const start = new Date(startDate);
        query.timestamp.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.timestamp.$lte = end;
      }
    }

    // Error filter
    if (isError !== undefined && isError !== '') {
      query.isError = isError === 'true' || isError === true;
    }

    // Level filter
    if (level && level !== 'all') {
      query.level = level;
    }

    // Module filter
    if (logModule && logModule !== 'all') {
      query.module = logModule;
    }

    // Action filter
    if (action) {
      query.action = action;
    }

    // Free text keyword search
    if (search && search.trim() !== '') {
      const term = search.trim();
      query.$or = [
        { message: { $regex: term, $options: 'i' } },
        { action: { $regex: term, $options: 'i' } },
        { 'performedBy.name': { $regex: term, $options: 'i' } },
        { 'performedBy.email': { $regex: term, $options: 'i' } },
        { 'targetUser.name': { $regex: term, $options: 'i' } },
        { 'targetUser.email': { $regex: term, $options: 'i' } },
        { 'errorDetails.message': { $regex: term, $options: 'i' } },
        { ipAddress: { $regex: term, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, totalCount] = await Promise.all([
      SystemLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SystemLog.countDocuments(query),
    ]);

    // Quick stats breakdown for the filtered query
    const errorCount = await SystemLog.countDocuments({ ...query, isError: true });

    return res.status(200).json({
      success: true,
      logs,
      pagination: {
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
      summary: {
        total: totalCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve logs.',
      error: error.message,
    });
  }
});

// @route   DELETE /api/admin/logs/clear
// @desc    Clear logs (optional admin housekeeping)
router.delete('/logs/clear', async (req, res) => {
  try {
    const { olderThanDays } = req.body;
    let query = {};
    if (olderThanDays) {
      const cutoff = new Date(Date.now() - parseInt(olderThanDays, 10) * 24 * 60 * 60 * 1000);
      query = { timestamp: { $lt: cutoff } };
    }

    const result = await SystemLog.deleteMany(query);

    await logSystemEvent({
      level: 'warn',
      module: 'admin',
      action: 'LOGS_CLEARED',
      message: `Admin '${req.user.name}' purged ${result.deletedCount} log entries.`,
      performedBy: { userId: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Successfully purged ${result.deletedCount} log records.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 8. DYNAMIC TEMPLATES & FIELD MANAGEMENT
// ==========================================

// @route   GET /api/admin/templates
// @desc    Get all dynamic templates and field configurations
router.get('/templates', async (req, res) => {
  try {
    const { category } = req.query;
    const query = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    const fields = await DynamicField.find(query).sort({ category: 1, semesterNumber: 1, fieldName: 1 });

    const grouped = {
      student_profile: fields.filter((f) => f.category === 'student_profile'),
      semester_academics: fields.filter((f) => f.category === 'semester_academics'),
      excel_export: fields.filter((f) => f.category === 'excel_export'),
      placement_requirement: fields.filter((f) => f.category === 'placement_requirement'),
      general: fields.filter((f) => f.category === 'general'),
    };

    return res.status(200).json({
      success: true,
      count: fields.length,
      grouped,
      fields,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/templates
// @desc    Add a dynamic field / template entry and broadcast notification to users
router.post('/templates', async (req, res) => {
  try {
    const { fieldKey, fieldName, category, fieldType, options, isRequired, defaultValue, description, semesterNumber } = req.body;

    if (!fieldKey || !fieldName) {
      return res.status(400).json({ success: false, message: 'fieldKey and fieldName are required.' });
    }

    const cleanKey = fieldKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const existing = await DynamicField.findOne({ fieldKey: cleanKey });
    if (existing) {
      return res.status(400).json({ success: false, message: `A field with key '${cleanKey}' already exists.` });
    }

    const field = new DynamicField({
      fieldKey: cleanKey,
      fieldName: fieldName.trim(),
      category: category || 'student_profile',
      fieldType: fieldType || 'text',
      options: Array.isArray(options) ? options : [],
      isRequired: Boolean(isRequired),
      defaultValue: defaultValue || '',
      description: description || '',
      semesterNumber: semesterNumber ? Number(semesterNumber) : null,
      createdBy: req.user._id,
    });

    await field.save();

    // Broadcast in-app notification to students & coordinators
    const recipients = await User.find({ role: { $in: ['student', 'department_coordinator', 'mentor'] } }).select('_id');
    for (const u of recipients) {
      await createNotification({
        recipientId: u._id,
        senderUser: req.user,
        type: 'announcement',
        title: `Profile Template Updated: New Detail '${field.fieldName}' Added`,
        message: `An administrator has added '${field.fieldName}' to the student profiling template.${field.isRequired ? ' This detail is required.' : ''}`,
        relatedId: field._id,
      });
    }

    await logSystemEvent({
      level: 'info',
      module: 'templates',
      action: 'DYNAMIC_FIELD_CREATED',
      message: `Admin '${req.user.name}' created dynamic field '${field.fieldName}' (${field.fieldKey})`,
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Field '${field.fieldName}' created successfully and users notified.`,
      field,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/admin/templates/:id
// @desc    Update dynamic template field
router.put('/templates/:id', async (req, res) => {
  try {
    const { fieldName, fieldType, options, isRequired, defaultValue, description, isActive } = req.body;
    const field = await DynamicField.findById(req.params.id);

    if (!field) {
      return res.status(404).json({ success: false, message: 'Dynamic field not found.' });
    }

    if (fieldName) field.fieldName = fieldName.trim();
    if (fieldType) field.fieldType = fieldType;
    if (Array.isArray(options)) field.options = options;
    if (isRequired !== undefined) field.isRequired = Boolean(isRequired);
    if (defaultValue !== undefined) field.defaultValue = defaultValue;
    if (description !== undefined) field.description = description;
    if (isActive !== undefined) field.isActive = Boolean(isActive);

    await field.save();

    return res.status(200).json({
      success: true,
      message: `Field '${field.fieldName}' updated successfully.`,
      field,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/admin/templates/:id
// @desc    Delete dynamic template field
router.delete('/templates/:id', async (req, res) => {
  try {
    const field = await DynamicField.findById(req.params.id);
    if (!field) {
      return res.status(404).json({ success: false, message: 'Dynamic field not found.' });
    }

    await DynamicField.findByIdAndDelete(req.params.id);

    await logSystemEvent({
      level: 'warn',
      module: 'templates',
      action: 'DYNAMIC_FIELD_DELETED',
      message: `Admin '${req.user.name}' deleted dynamic field '${field.fieldName}' (${field.fieldKey})`,
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Field '${field.fieldName}' removed from templates.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/admin/templates/semester/add
// @desc    Add new semester SGPA slot, initialize records for all students, update CGPA, and broadcast notification
router.post('/templates/semester/add', async (req, res) => {
  try {
    const { semesterNumber } = req.body;
    const semNum = Number(semesterNumber);

    if (!semNum || semNum < 1 || semNum > 8) {
      return res.status(400).json({
        success: false,
        message: 'Valid semesterNumber between 1 and 8 is required.',
      });
    }

    const fieldKey = `sem_${semNum}_sgpa`;
    const fieldName = `Semester ${semNum} SGPA`;

    // Ensure dynamic field exists
    let dynamicField = await DynamicField.findOne({ fieldKey });
    if (!dynamicField) {
      dynamicField = await DynamicField.create({
        fieldKey,
        fieldName,
        category: 'semester_academics',
        fieldType: 'number',
        semesterNumber: semNum,
        isRequired: true,
        description: `Academic SGPA record for Semester ${semNum}`,
        createdBy: req.user._id,
      });
    }

    // Initialize or append semester slot to all StudentProfiles
    const profiles = await StudentProfile.find({});
    let updatedCount = 0;

    for (const profile of profiles) {
      const semExists = profile.semesters.some((s) => s.semesterNumber === semNum);
      if (!semExists) {
        profile.semesters.push({
          semesterNumber: semNum,
          sgpa: 0,
          cgpa: profile.currentCGPA || 0,
          attendancePercentage: 0,
          arrearStatus: 'No',
          numberOfArrears: 0,
        });
        profile.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);

        // Recalculate CGPA across non-zero SGPAs
        const scoredSems = profile.semesters.filter((s) => s.sgpa > 0);
        if (scoredSems.length > 0) {
          const totalSgpa = scoredSems.reduce((acc, curr) => acc + curr.sgpa, 0);
          profile.currentCGPA = parseFloat((totalSgpa / scoredSems.length).toFixed(2));
        }

        await profile.save();
        updatedCount++;
      }
    }

    // Broadcast in-app notification to all students
    const students = await User.find({ role: 'student' }).select('_id');
    for (const st of students) {
      await createNotification({
        recipientId: st._id,
        senderUser: req.user,
        type: 'announcement',
        title: `Academic Update: Semester ${semNum} SGPA Slot Initialized`,
        message: `Admin has added Semester ${semNum} to the academic records. Please update your SGPA score. Overall CGPA will be automatically recomputed.`,
      });
    }

    await logSystemEvent({
      level: 'info',
      module: 'academics',
      action: 'SEMESTER_SLOT_ADDED',
      message: `Admin '${req.user.name}' activated Semester ${semNum} across ${updatedCount} student profiles.`,
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Semester ${semNum} SGPA slot activated successfully across ${updatedCount} students, and notifications sent.`,
      semesterNumber: semNum,
      updatedStudentsCount: updatedCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
