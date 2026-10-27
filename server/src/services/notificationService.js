const Notification = require('../models/Notification');

/**
 * Dispatch a single in-app notification
 */
const createNotification = async ({
  recipientId,
  sender,
  type = 'message_received',
  title,
  message,
  relatedId = null,
  link = '',
}) => {
  if (!recipientId || !title || !message) return null;

  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: {
        userId: sender?.userId || sender?._id,
        name: sender?.name || 'System',
        role: sender?.role || '',
      },
      type,
      title,
      message,
      relatedId,
      link,
      isRead: false,
    });

    await notification.save();
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
};

/**
 * Dispatch bulk notifications to a list of recipient IDs
 */
const createBulkNotifications = async ({
  recipientIds = [],
  sender,
  type = 'message_received',
  title,
  message,
  relatedId = null,
  link = '',
}) => {
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) return [];

  try {
    const docs = recipientIds.map((rId) => ({
      recipient: rId,
      sender: {
        userId: sender?.userId || sender?._id,
        name: sender?.name || 'System',
        role: sender?.role || '',
      },
      type,
      title,
      message,
      relatedId,
      link,
      isRead: false,
    }));

    const result = await Notification.insertMany(docs);
    return result;
  } catch (err) {
    console.error('Failed to create bulk notifications:', err.message);
    return [];
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
};
