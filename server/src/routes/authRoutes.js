const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { generateTempPassword, sendTempPasswordEmail } = require('../utils/mailer');
const { logSystemEvent } = require('../utils/logger');
const { protect } = require('../middleware/auth');

// Generate JWT token
const generateToken = (user, mustChangePassword = false) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      email: user.email,
      name: user.name,
      department: user.department,
      mustChangePassword,
    },
    process.env.JWT_SECRET || 'antigravity_jwt_secret_key_student_academic_profiling_2026',
    { expiresIn: process.env.JWT_EXPIRE || '24h' }
  );
};

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Please provide both email and password.',
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Requirement: "If not present , give an alert box showing user did not exist and clear the fields."
    if (!user) {
      await logSystemEvent({
        level: 'warn',
        isError: true,
        module: 'auth',
        action: 'LOGIN_FAILED_USER_NOT_FOUND',
        message: `Login failed: user not found with email '${normalizedEmail}'`,
        req,
        details: { attemptedEmail: normalizedEmail },
      });

      return res.status(404).json({
        success: false,
        errorType: 'USER_NOT_FOUND',
        message: 'User does not exist',
      });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        errorType: 'ACCOUNT_DEACTIVATED',
        message: 'Your account is currently deactivated. Please contact the administrator.',
      });
    }

    // Check normal password
    let passwordMatches = await user.matchPassword(password);
    let usedTempPassword = false;

    // If regular password fails, check if user entered a valid single-use temporary password
    if (!passwordMatches && user.tempPassword && user.tempPassword.codeHash) {
      const tempCheck = await user.validateTempPassword(password);
      if (tempCheck.valid) {
        passwordMatches = true;
        usedTempPassword = true;
      }
    }

    // Requirement: "If the password is wrong, give an alert box showing incorrect password and clear the password field"
    if (!passwordMatches) {
      await logSystemEvent({
        level: 'warn',
        isError: true,
        module: 'auth',
        action: 'LOGIN_FAILED_WRONG_PASSWORD',
        message: `Login failed: incorrect password for user '${user.email}'`,
        performedBy: { userId: user._id, name: user.name, email: user.email, role: user.role },
        req,
      });

      return res.status(401).json({
        success: false,
        errorType: 'INCORRECT_PASSWORD',
        message: 'Incorrect password',
      });
    }

    // If they used a temporary password or mustChangePassword is true
    const requirePasswordChange = user.mustChangePassword || usedTempPassword;

    user.lastLogin = new Date();
    await user.save();

    await logSystemEvent({
      level: 'info',
      module: 'auth',
      action: 'LOGIN_SUCCESS',
      message: `User '${user.name}' (${user.email}) logged in successfully as [${user.role}]`,
      performedBy: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
      details: { usedTempPassword, requirePasswordChange },
    });

    const token = generateToken(user, requirePasswordChange);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        mustChangePassword: requirePasswordChange,
      },
    });
  } catch (error) {
    await logSystemEvent({
      level: 'error',
      isError: true,
      module: 'auth',
      action: 'LOGIN_SERVER_ERROR',
      message: `Server error during login: ${error.message}`,
      error,
      req,
    });

    return res.status(500).json({
      success: false,
      message: 'Server error during authentication.',
      error: error.message,
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Initiate forgot password, generates and sends single-use 24hr temp password
// @access  Public
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Please provide your email address.',
    });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Requirement: "if user email does not exist give the same alert box"
    if (!user) {
      await logSystemEvent({
        level: 'warn',
        isError: true,
        module: 'auth',
        action: 'FORGOT_PASSWORD_USER_NOT_FOUND',
        message: `Forgot password request failed: email not found '${normalizedEmail}'`,
        req,
      });

      return res.status(404).json({
        success: false,
        errorType: 'USER_NOT_FOUND',
        message: 'User does not exist',
      });
    }

    // Generate single-use temporary password (valid for 24 hours)
    const tempPassword = generateTempPassword();
    const salt = await bcrypt.genSalt(10);
    const codeHash = await bcrypt.hash(tempPassword, salt);

    user.tempPassword = {
      codeHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isUsed: false,
      purpose: 'forgot_password',
    };
    user.mustChangePassword = true;
    await user.save();

    // Send email
    const mailResult = await sendTempPasswordEmail({
      toEmail: user.email,
      recipientName: user.name,
      tempPassword,
      purpose: 'forgot_password',
    });

    await logSystemEvent({
      level: 'info',
      module: 'auth',
      action: 'FORGOT_PASSWORD_REQUEST',
      message: `Temporary password generated & dispatched to '${user.email}'`,
      targetUser: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
      details: { expiresAt: user.tempPassword.expiresAt },
    });

    return res.status(200).json({
      success: true,
      message: 'A single-use temporary password valid for 24 hours has been sent to your email.',
      email: user.email,
      previewUrl: mailResult.previewUrl || null,
      // In local development / testing demo, return the temp password as well so developer can test without opening inbox
      demoTempPassword: process.env.NODE_ENV !== 'production' ? tempPassword : undefined,
    });
  } catch (error) {
    await logSystemEvent({
      level: 'error',
      isError: true,
      module: 'auth',
      action: 'FORGOT_PASSWORD_ERROR',
      message: `Failed to process forgot password: ${error.message}`,
      error,
      req,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to process request. Please try again.',
      error: error.message,
    });
  }
});

// @route   POST /api/auth/verify-temp-password
// @desc    Verify if temporary password is valid, unused and within 24 hours
// @access  Public
router.post('/verify-temp-password', async (req, res) => {
  const { email, tempPassword } = req.body;

  if (!email || !tempPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email and temporary password are required.',
    });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        errorType: 'USER_NOT_FOUND',
        message: 'User does not exist',
      });
    }

    const check = await user.validateTempPassword(tempPassword);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.reason,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Temporary password verified successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Verification failed.',
      error: error.message,
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password after validating single-use temporary password
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { email, tempPassword, newPassword } = req.body;

  if (!email || !tempPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Email, temporary password, and new password are required.',
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long.',
    });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User does not exist.',
      });
    }

    // Validate single-use & 24hr expiration
    const check = await user.validateTempPassword(tempPassword);
    if (!check.valid) {
      return res.status(400).json({
        success: false,
        message: check.reason,
      });
    }

    // Hash new permanent password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);

    // Invalidate temporary password (single-use enforcement)
    user.tempPassword.isUsed = true;
    user.tempPassword.codeHash = null;
    user.mustChangePassword = false;

    await user.save();

    await logSystemEvent({
      level: 'info',
      module: 'auth',
      action: 'PASSWORD_RESET_SUCCESS',
      message: `Password successfully updated and temporary password invalidated for '${user.email}'`,
      targetUser: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Password has been updated successfully. Please log in with your new password.',
    });
  } catch (error) {
    await logSystemEvent({
      level: 'error',
      isError: true,
      module: 'auth',
      action: 'PASSWORD_RESET_ERROR',
      message: `Password reset error: ${error.message}`,
      error,
      req,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to reset password.',
      error: error.message,
    });
  }
});

// @route   POST /api/auth/set-first-password
// @desc    Authenticated endpoint for first-time login to set new permanent password
// @access  Private
router.post('/set-first-password', protect, async (req, res) => {
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 6 characters long.',
    });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.mustChangePassword = false;
    if (user.tempPassword) {
      user.tempPassword.isUsed = true;
      user.tempPassword.codeHash = null;
    }

    await user.save();

    await logSystemEvent({
      level: 'info',
      module: 'auth',
      action: 'FIRST_PASSWORD_SET_SUCCESS',
      message: `User '${user.name}' (${user.email}) successfully created permanent password upon first login.`,
      performedBy: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
    });

    // Generate new clean token without mustChangePassword flag
    const token = generateToken(user, false);

    return res.status(200).json({
      success: true,
      message: 'Permanent password created successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        mustChangePassword: false,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to set password.',
      error: error.message,
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile (name and email only; role and department are locked)
// @access  Private
router.put('/profile', protect, async (req, res) => {
  const { name, email } = req.body;

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name) user.name = name.trim();

    if (email && email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = email.toLowerCase().trim();
      const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email address already in use.' });
      }
      user.email = normalizedEmail;
    }

    await user.save();

    // If user is a student, sync StudentProfile
    if (user.role === 'student') {
      const StudentProfile = require('../models/StudentProfile');
      await StudentProfile.findOneAndUpdate(
        { userId: user._id },
        { name: user.name, email: user.email }
      );
    }

    await logSystemEvent({
      level: 'info',
      module: 'auth',
      action: 'USER_PROFILE_UPDATED',
      message: `User '${user.name}' updated their profile information.`,
      performedBy: { userId: user._id, name: user.name, email: user.email, role: user.role },
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        rollNumber: user.rollNumber,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user,
  });
});

module.exports = router;
