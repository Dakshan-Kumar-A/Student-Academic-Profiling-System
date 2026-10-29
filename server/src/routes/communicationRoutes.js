const express = require('express');
const router = express.Router();
const CommunicationMessage = require('../models/CommunicationMessage');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

// All communication routes require valid login
router.use(protect);

// Helper: Determine if user can post in given channel
const canUserPostInChannel = (role, channel) => {
  if (channel === 'placement_announcements') {
    return role === 'placement_officer' || role === 'admin';
  }
  if (channel === 'department_channel') {
    return role === 'department_coordinator' || role === 'mentor' || role === 'admin';
  }
  if (channel === 'mentorship_channel') {
    return role === 'mentor' || role === 'department_coordinator' || role === 'admin';
  }
  // placement_queries & general_channel: open to all authenticated roles
  return true;
};

// @route   GET /api/communication/messages
// @desc    Retrieve messages in the requested channel with optional search and filter
router.get('/messages', async (req, res) => {
  try {
    const { channel = 'placement_announcements', search = '', driveId } = req.query;

    const query = { channel };

    if (driveId) {
      query.driveId = driveId;
    }

    // For department channel, allow user to see department messages or global messages
    if (channel === 'department_channel') {
      const userDept = req.user.department;
      if (userDept && req.user.role !== 'admin' && req.user.role !== 'placement_officer') {
        query.$or = [
          { department: userDept },
          { department: 'All' },
          { department: 'Placement Cell' },
          { 'sender.userId': req.user._id },
        ];
      }
    }

    if (search && search.trim()) {
      const q = search.trim();
      const searchConditions = [
        { subject: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } },
        { 'sender.name': { $regex: q, $options: 'i' } },
      ];
      if (query.$or) {
        query.$and = [{ $or: query.$or }, { $or: searchConditions }];
        delete query.$or;
      } else {
        query.$or = searchConditions;
      }
    }

    const messages = await CommunicationMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();

    return res.status(200).json({
      success: true,
      channel,
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error('Error fetching communication messages:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/communication/messages
// @desc    Create a new thread / message in the specified channel
router.post('/messages', async (req, res) => {
  try {
    const { channel = 'general_channel', subject, content, priority = 'Normal', driveId = null } = req.body;

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message content are required.',
      });
    }

    if (!canUserPostInChannel(req.user.role, channel)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${req.user.role.replace('_', ' ')}) is not permitted to create top-level posts in this channel.`,
      });
    }

    const userDept = req.user.department || (req.user.role === 'placement_officer' ? 'Placement Cell' : 'General');

    const newMessage = new CommunicationMessage({
      sender: {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
      department: userDept,
      channel,
      driveId: driveId || null,
      isReadOnly: channel === 'placement_announcements',
      subject: subject.trim(),
      content: content.trim(),
      priority,
      targetGroup: 'all',
      messageType: channel === 'placement_announcements' ? 'announcement' : channel === 'placement_queries' ? 'enquiry' : 'message',
    });

    await newMessage.save();

    // Notify relevant users depending on channel
    try {
      if (channel === 'placement_announcements') {
        const studentUsers = await User.find({ role: 'student', isActive: true }).select('_id');
        for (const st of studentUsers) {
          await createNotification({
            recipientId: st._id,
            senderUser: req.user,
            type: 'announcement',
            title: `Placement Announcement: ${subject}`,
            message: content.length > 120 ? content.slice(0, 120) + '...' : content,
            relatedId: newMessage._id,
          });
        }
      } else if (channel === 'placement_queries') {
        const placementOfficers = await User.find({ role: { $in: ['placement_officer', 'admin'] } }).select('_id');
        for (const po of placementOfficers) {
          await createNotification({
            recipientId: po._id,
            senderUser: req.user,
            type: 'message',
            title: `New Placement Query: ${subject}`,
            message: `From ${req.user.name} (${req.user.role}): ${content.slice(0, 100)}`,
            relatedId: newMessage._id,
          });
        }
      }
    } catch (notifErr) {
      console.warn('Communication notification error:', notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Message published successfully.',
      communicationMessage: newMessage,
    });
  } catch (error) {
    console.error('Error posting communication message:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/communication/messages/:id/reply
// @desc    Reply to a thread
router.post('/messages/:id/reply', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const thread = await CommunicationMessage.findById(req.params.id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Message thread not found.' });
    }

    // Only broadcast announcements marked strict read-only block student replies
    if (thread.channel === 'placement_announcements' && thread.isReadOnly && req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'This announcement channel is broadcast-only. Please use the Placement Queries channel for inquiries.',
      });
    }

    const replyObj = {
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content: content.trim(),
      sentAt: new Date(),
    };

    thread.replies.push(replyObj);
    await thread.save();

    // Notify thread author if someone else replied
    if (thread.sender.userId && thread.sender.userId.toString() !== req.user._id.toString()) {
      await createNotification({
        recipientId: thread.sender.userId,
        senderUser: req.user,
        type: 'message',
        title: `Reply on: ${thread.subject}`,
        message: `${req.user.name} replied: "${content.trim().slice(0, 90)}..."`,
        relatedId: thread._id,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reply posted successfully.',
      thread,
    });
  } catch (error) {
    console.error('Error replying to communication message:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
