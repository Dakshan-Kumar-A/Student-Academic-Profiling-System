const SystemLog = require('../models/SystemLog');

const logSystemEvent = async ({
  level = 'info',
  isError = false,
  module = 'system',
  action,
  message,
  performedBy = null,
  targetUser = null,
  req = null,
  details = {},
  error = null,
}) => {
  try {
    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '';
      userAgent = req.headers['user-agent'] || '';
      if (!performedBy && req.user) {
        performedBy = {
          userId: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: req.user.role,
        };
      }
    }

    let errorDetails = { message: '', stack: '', code: '' };
    if (error) {
      isError = true;
      level = 'error';
      errorDetails = {
        message: error.message || String(error),
        stack: error.stack || '',
        code: error.code || error.statusCode || 'ERR_INTERNAL',
      };
    }

    const logEntry = new SystemLog({
      level,
      isError,
      module,
      action,
      message,
      performedBy: performedBy || { name: 'System', role: 'system' },
      targetUser: targetUser || {},
      ipAddress,
      userAgent,
      details,
      errorDetails,
    });

    await logEntry.save();
    return logEntry;
  } catch (err) {
    console.error('Failed to write system log to MongoDB:', err.message);
  }
};

module.exports = { logSystemEvent };
