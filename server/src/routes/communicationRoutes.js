const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const CommunicationMessage = require('../models/CommunicationMessage');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DepartmentDrive = require('../models/DepartmentDrive');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');

// All communication routes require valid login
router.use(protect);

// Helper: Check if a user role is permitted to access a channel
const isChannelAllowedForRole = (role, channel) => {
  if (role === 'admin') return true;

  if (role === 'placement_officer') {
    // 1) placement officer: only Placement Announcements, Placement Queries, General Discussion
    return ['placement_announcements', 'placement_queries', 'general_channel'].includes(channel);
  }

  if (role === 'department_coordinator') {
    // 2) department coordinator: Placement Announcements, Department Channel, General Discussion
    return ['placement_announcements', 'department_channel', 'general_channel'].includes(channel);
  }

  if (role === 'mentor') {
    // 3) mentor: Placement Announcements, Department Channel, Mentorship channel, General Discussion
    return ['placement_announcements', 'department_channel', 'mentorship_channel', 'general_channel'].includes(channel);
  }

  if (role === 'student') {
    // Students have access to all 5 channels appropriate for students
    return ['placement_announcements', 'placement_queries', 'department_channel', 'mentorship_channel', 'general_channel'].includes(channel);
  }

  return false;
};

// Helper: Check if user role can post top-level message in a channel
const canUserPostInChannel = (role, channel) => {
  if (role === 'admin') return true;

  if (channel === 'placement_announcements') {
    // Only placement officers & admin
    return role === 'placement_officer';
  }

  if (channel === 'placement_queries') {
    // Only students & placement officers
    return role === 'student' || role === 'placement_officer';
  }

  if (channel === 'department_channel') {
    // Coordinators & Mentors of that dept
    return role === 'department_coordinator' || role === 'mentor';
  }

  if (channel === 'mentorship_channel') {
    // Mentors & Coordinators of that dept
    return role === 'mentor' || role === 'department_coordinator';
  }

  if (channel === 'general_channel') {
    // Anyone can post in general channel
    return true;
  }

  return false;
};

// Helper: Check if user role can reply in a channel
const canUserReplyInChannel = (role, thread, userId) => {
  if (role === 'admin') return true;

  if (thread.channel === 'placement_announcements') {
    // Only placement officer can continue further details on drive announcements thread
    return role === 'placement_officer';
  }

  if (thread.channel === 'placement_queries') {
    // Only students and placement officers can message/reply here
    return role === 'student' || role === 'placement_officer';
  }

  if (thread.channel === 'general_channel' && thread.isDirectMessage) {
    // Only the sender and direct recipient can reply in a 1-on-1 direct message
    const isSender = String(thread.sender?.userId) === String(userId);
    const isDirectRecipient = String(thread.directRecipient?.userId) === String(userId);
    const isInRecipients = (thread.recipients || []).some(r => String(r.userId) === String(userId));
    return isSender || isDirectRecipient || isInRecipients;
  }

  return true;
};

// @route   GET /api/communication/recipients
// @desc    Get eligible recipient users for direct messaging or custom audience selection
router.get('/recipients', async (req, res) => {
  try {
    const { channel = 'general_channel', search = '' } = req.query;
    const userRole = req.user.role;
    const userDept = req.user.department || '';

    let query = { isActive: { $ne: false }, _id: { $ne: req.user._id } };

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { rollNumber: { $regex: q, $options: 'i' } },
      ];
    }

    // Channel specific scoping:
    if (channel === 'department_channel' || channel === 'mentorship_channel') {
      if (userRole !== 'admin' && userDept) {
        query.department = userDept;
      }
    }

    const users = await User.find(query)
      .select('_id name email role department rollNumber mentorId')
      .sort({ name: 1 })
      .limit(100)
      .lean();

    return res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('Error fetching communication recipients:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/communication/messages
// @desc    Retrieve messages in the requested channel with audience visibility & search filtering
router.get('/messages', async (req, res) => {
  try {
    const {
      channel = 'placement_announcements',
      search = '',
      driveId,
      filterMode = 'all', // For general discussion: 'all', 'public', 'direct', 'sent'
      filterDept = 'all',
      filterRole = 'all',
    } = req.query;

    const user = req.user;
    const userRole = user.role;
    const userDept = user.department || '';

    // 1. Role-based channel access control
    if (!isChannelAllowedForRole(userRole, channel)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${userRole.replace('_', ' ')}) is not permitted to access ${channel.replace('_', ' ')}.`,
        messages: [],
      });
    }

    // Build Mongoose base query for this channel
    const query = { channel };

    if (driveId) {
      query.driveId = driveId;
    }

    // Retrieve current student profile if user is a student (needed for section and mentor matching)
    let studentProfile = null;
    if (userRole === 'student') {
      studentProfile = await StudentProfile.findOne({ userId: user._id }).lean();
    }

    // Find all raw messages in channel, sorted newest first
    const rawMessages = await CommunicationMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // 2. Audience Filtering: Only those who are filtered to receive the message can view it!
    const filteredMessages = rawMessages.filter((msg) => {
      const isSender = String(msg.sender?.userId) === String(user._id);

      // Admin always sees everything
      if (userRole === 'admin') return true;

      // Sender can always see their own messages
      if (isSender) {
        if (channel === 'general_channel' && filterMode === 'direct') {
          return msg.isDirectMessage || msg.targetGroup === 'direct_message';
        }
        return true;
      }

      // -------------------------------------------------------------
      // CHANNEL 1: PLACEMENT ANNOUNCEMENTS
      // -------------------------------------------------------------
      if (channel === 'placement_announcements') {
        // Open broadcast visible to all permitted roles (officer, coordinator, mentor, student)
        return true;
      }

      // -------------------------------------------------------------
      // CHANNEL 2: PLACEMENT QUERIES
      // -------------------------------------------------------------
      if (channel === 'placement_queries') {
        // Only students and placement officers can view/message here
        return userRole === 'student' || userRole === 'placement_officer';
      }

      // -------------------------------------------------------------
      // CHANNEL 3: DEPARTMENT CHANNEL
      // "only students, mentors and department coordinators of that department can view the messages posted here. can filter who receives the message."
      // -------------------------------------------------------------
      if (channel === 'department_channel') {
        // Must belong to the same department
        const msgDept = msg.department || '';
        if (msgDept !== 'All' && msgDept !== 'Placement Cell' && userDept && msgDept.toUpperCase() !== userDept.toUpperCase()) {
          return false;
        }

        // If target is all mentors, students cannot view
        if (msg.targetGroup === 'all_mentors' && userRole === 'student') {
          return false;
        }

        // Section filtering: If targetSection is set (e.g. 'A', 'B'), student's section must match
        if (msg.targetSection && msg.targetSection !== 'all' && userRole === 'student') {
          const studentSec = studentProfile?.section || 'A';
          if (studentSec.toUpperCase() !== msg.targetSection.toUpperCase()) {
            return false;
          }
        }

        // Custom selected students: if specified, student must be in recipients
        if ((msg.targetGroup === 'custom_selection' || msg.targetGroup === 'selected_students') && (msg.recipients && msg.recipients.length > 0)) {
          const isRecipient = msg.recipients.some(r => String(r.userId) === String(user._id));
          if (!isRecipient && userRole === 'student') {
            return false;
          }
        }

        return true;
      }

      // -------------------------------------------------------------
      // CHANNEL 4: MENTORSHIP CHANNEL
      // "only students and mentors of same department can view messages here. can select if only their mentees can view the messages."
      // -------------------------------------------------------------
      if (channel === 'mentorship_channel') {
        // Must belong to the same department
        const msgDept = msg.department || '';
        if (msgDept !== 'All' && userDept && msgDept.toUpperCase() !== userDept.toUpperCase()) {
          return false;
        }

        // If menteesOnly is selected:
        if (msg.menteesOnly || msg.targetGroup === 'all_mentees') {
          if (userRole === 'student') {
            const studentMentorId = studentProfile?.mentorId || user.mentorId;
            // Student can only view if their assigned mentor is the sender of this message
            return studentMentorId && String(studentMentorId) === String(msg.sender?.userId);
          }
          if (userRole === 'mentor') {
            // Other mentors do not see private mentee discussions
            return isSender;
          }
          // Coordinator & Admin can view for departmental supervision
          return userRole === 'department_coordinator';
        }

        return true;
      }

      // -------------------------------------------------------------
      // CHANNEL 5: GENERAL DISCUSSION CHANNEL
      // "Anyone can view and post messages here. only those who are filtered to receive the message can view the message, others won't receive the messages. can even do one on one messages."
      // -------------------------------------------------------------
      if (channel === 'general_channel') {
        // Direct message / 1-on-1:
        if (msg.isDirectMessage || msg.targetGroup === 'direct_message') {
          const isDirectRecipient = msg.directRecipient && String(msg.directRecipient.userId) === String(user._id);
          const isInRecipients = (msg.recipients || []).some(r => String(r.userId) === String(user._id));
          return isSender || isDirectRecipient || isInRecipients;
        }

        // Filtered Broadcast by Department:
        if (msg.targetDepartment && msg.targetDepartment !== 'all') {
          if (userDept && msg.targetDepartment.toUpperCase() !== userDept.toUpperCase()) {
            return false;
          }
        }

        // Filtered Broadcast by Role:
        if (msg.targetRole && msg.targetRole !== 'all') {
          if (userRole !== msg.targetRole) {
            return false;
          }
        }

        // Custom selected users:
        if ((msg.targetGroup === 'custom_selection' || msg.targetGroup === 'selected_students') && (msg.recipients && msg.recipients.length > 0)) {
          const isInList = msg.recipients.some(r => String(r.userId) === String(user._id));
          if (!isInList) return false;
        }

        return true;
      }

      return true;
    });

    // 3. Search and Detailed Filtering
    let results = filteredMessages;

    // Detailed search filtering for general discussion
    if (channel === 'general_channel') {
      if (filterMode === 'direct') {
        results = results.filter(m => m.isDirectMessage || m.targetGroup === 'direct_message');
      } else if (filterMode === 'public') {
        results = results.filter(m => !m.isDirectMessage && m.targetGroup !== 'direct_message');
      } else if (filterMode === 'sent') {
        results = results.filter(m => String(m.sender?.userId) === String(user._id));
      }

      if (filterDept && filterDept !== 'all') {
        results = results.filter(m =>
          (m.department && m.department.toUpperCase() === filterDept.toUpperCase()) ||
          (m.targetDepartment && m.targetDepartment.toUpperCase() === filterDept.toUpperCase())
        );
      }

      if (filterRole && filterRole !== 'all') {
        results = results.filter(m =>
          (m.sender?.role === filterRole) || (m.targetRole === filterRole)
        );
      }
    }

    // Text search (for all channels)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = results.filter(m =>
        (m.subject && m.subject.toLowerCase().includes(q)) ||
        (m.content && m.content.toLowerCase().includes(q)) ||
        (m.sender?.name && m.sender.name.toLowerCase().includes(q)) ||
        (m.directRecipient?.name && m.directRecipient.name.toLowerCase().includes(q))
      );
    }

    return res.status(200).json({
      success: true,
      channel,
      count: results.length,
      messages: results,
    });
  } catch (error) {
    console.error('Error fetching communication messages:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/communication/messages
// @desc    Create a new thread / message with audience filtering
router.post('/messages', async (req, res) => {
  try {
    const {
      channel = 'general_channel',
      subject,
      content,
      priority = 'Normal',
      driveId = null,
      targetGroup = 'all',
      targetSection = 'all',
      menteesOnly = false,
      targetRole = 'all',
      targetDepartment = 'all',
      isDirectMessage = false,
      directRecipientUserId = null,
      selectedUserIds = [],
    } = req.body;

    const user = req.user;

    if (!subject || !content) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message content are required.',
      });
    }

    if (!canUserPostInChannel(user.role, channel)) {
      return res.status(403).json({
        success: false,
        message: `Your role (${user.role.replace('_', ' ')}) is not permitted to create posts in ${channel.replace('_', ' ')}.`,
      });
    }

    const userDept = user.department || (user.role === 'placement_officer' ? 'Placement Cell' : 'General');

    // Build recipient list if direct message or custom selection
    let recipientsList = [];
    let directRecipientObj = null;

    if (isDirectMessage && directRecipientUserId) {
      const directUser = await User.findById(directRecipientUserId).lean();
      if (directUser) {
        directRecipientObj = {
          userId: directUser._id,
          name: directUser.name,
          email: directUser.email,
          role: directUser.role,
        };
        recipientsList.push(directRecipientObj);
      }
    } else if (Array.isArray(selectedUserIds) && selectedUserIds.length > 0) {
      const selectedUsers = await User.find({ _id: { $in: selectedUserIds } }).lean();
      recipientsList = selectedUsers.map(u => ({
        userId: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
      }));
    }

    // Determine safe valid enum for targetGroup
    let safeTargetGroup = targetGroup;
    if (isDirectMessage) {
      safeTargetGroup = 'direct_message';
    } else if (![
      'all', 'all_students', 'all_mentors', 'all_department', 'all_mentees',
      'selected_students', 'selected_mentors', 'custom_selection', 'individual',
      'direct_message', 'admin'
    ].includes(safeTargetGroup)) {
      safeTargetGroup = 'all';
    }

    const newMessage = new CommunicationMessage({
      sender: {
        userId: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      department: userDept,
      channel,
      driveId: driveId || null,
      isReadOnly: channel === 'placement_announcements', // Only placement team can reply on announcements
      subject: subject.trim(),
      content: content.trim(),
      priority,
      targetGroup: safeTargetGroup,
      targetSection: targetSection || 'all',
      menteesOnly: Boolean(menteesOnly),
      targetRole: targetRole || 'all',
      targetDepartment: targetDepartment || 'all',
      isDirectMessage: Boolean(isDirectMessage),
      directRecipient: directRecipientObj,
      recipients: recipientsList,
      messageType: channel === 'placement_announcements' ? 'announcement' : channel === 'placement_queries' ? 'enquiry' : 'message',
    });

    await newMessage.save();

    // Notify relevant recipients
    try {
      if (isDirectMessage && directRecipientObj?.userId) {
        await createNotification({
          recipientId: directRecipientObj.userId,
          senderUser: user,
          type: 'message',
          title: `Direct Message from ${user.name}`,
          message: `${subject}: ${content.slice(0, 100)}`,
          relatedId: newMessage._id,
        });
      } else if (channel === 'placement_announcements') {
        const studentUsers = await User.find({ role: 'student', isActive: true }).select('_id');
        for (const st of studentUsers) {
          await createNotification({
            recipientId: st._id,
            senderUser: user,
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
            senderUser: user,
            type: 'message',
            title: `Placement Query: ${subject}`,
            message: `From ${user.name}: ${content.slice(0, 100)}`,
            relatedId: newMessage._id,
          });
        }
      } else if (channel === 'department_channel') {
        const deptUsers = await User.find({
          department: userDept,
          role: safeTargetGroup === 'all_mentors' ? 'mentor' : { $in: ['student', 'mentor'] },
          isActive: true,
          _id: { $ne: user._id },
        }).select('_id');
        for (const u of deptUsers) {
          await createNotification({
            recipientId: u._id,
            senderUser: user,
            type: 'message',
            title: `${userDept} Notice: ${subject}`,
            message: content.slice(0, 100),
            relatedId: newMessage._id,
          });
        }
      } else if (channel === 'mentorship_channel' && menteesOnly) {
        const mentees = await StudentProfile.find({ mentorId: user._id }).select('userId');
        for (const m of mentees) {
          if (m.userId) {
            await createNotification({
              recipientId: m.userId,
              senderUser: user,
              type: 'message',
              title: `Mentor Guidance: ${subject}`,
              message: content.slice(0, 100),
              relatedId: newMessage._id,
            });
          }
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
// @desc    Reply to a thread with role permission checks
router.post('/messages/:id/reply', async (req, res) => {
  try {
    const { content } = req.body;
    const user = req.user;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const thread = await CommunicationMessage.findById(req.params.id);
    if (!thread) {
      return res.status(404).json({ success: false, message: 'Message thread not found.' });
    }

    if (!canUserReplyInChannel(user.role, thread, user._id)) {
      if (thread.channel === 'placement_announcements') {
        return res.status(403).json({
          success: false,
          message: 'Placement Announcements channel is read-only for students. Inquiries should be posted in Placement Queries.',
        });
      }
      if (thread.channel === 'placement_queries') {
        return res.status(403).json({
          success: false,
          message: 'Only students and placement officers can message in Placement Queries.',
        });
      }
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to reply to this conversation.',
      });
    }

    const replyObj = {
      senderId: user._id,
      senderName: user.name,
      senderRole: user.role,
      content: content.trim(),
      sentAt: new Date(),
    };

    thread.replies.push(replyObj);
    await thread.save();

    // Notify thread author if someone else replied
    if (thread.sender.userId && thread.sender.userId.toString() !== user._id.toString()) {
      await createNotification({
        recipientId: thread.sender.userId,
        senderUser: user,
        type: 'message',
        title: `Reply on: ${thread.subject}`,
        message: `${user.name} replied: "${content.trim().slice(0, 90)}..."`,
        relatedId: thread._id,
      });
    }

    // In direct message, notify the other participant if author is replying
    if (thread.isDirectMessage && thread.directRecipient?.userId) {
      const otherId = String(thread.sender.userId) === String(user._id)
        ? thread.directRecipient.userId
        : thread.sender.userId;
      if (String(otherId) !== String(user._id)) {
        await createNotification({
          recipientId: otherId,
          senderUser: user,
          type: 'message',
          title: `New Direct Message Reply from ${user.name}`,
          message: `"${content.trim().slice(0, 90)}..."`,
          relatedId: thread._id,
        });
      }
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

// Auto-sync: Ensure existing active drives have corresponding announcement and query threads
router.post('/sync-drive-threads', async (req, res) => {
  try {
    const drives = await DepartmentDrive.find({ status: { $ne: 'Cancelled' } }).lean();
    let createdCount = 0;

    for (const drive of drives) {
      // Check announcement thread
      const existingAnn = await CommunicationMessage.findOne({
        channel: 'placement_announcements',
        driveId: drive._id,
      });
      if (!existingAnn) {
        await CommunicationMessage.create({
          sender: {
            userId: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
          },
          department: 'Placement Cell',
          channel: 'placement_announcements',
          driveId: drive._id,
          isReadOnly: true,
          messageType: 'announcement',
          subject: `[Drive Announcement] ${drive.companyName} - Campus Recruitment Details & Schedules`,
          content: `Official announcement thread for ${drive.companyName}.\nOffer Type: ${drive.offerType || 'Full Time'}\nLocation: ${drive.jobLocation || 'Campus'}\nOpt-in Deadline: ${new Date(drive.optInDeadline).toLocaleString()}.\nFurther updates and shortlisted lists will be posted on this thread.`,
          priority: 'Important',
          targetGroup: 'all',
        });
        createdCount++;
      }

      // Check query thread
      const existingQuery = await CommunicationMessage.findOne({
        channel: 'placement_queries',
        driveId: drive._id,
      });
      if (!existingQuery) {
        await CommunicationMessage.create({
          sender: {
            userId: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
          },
          department: 'Placement Cell',
          channel: 'placement_queries',
          driveId: drive._id,
          isReadOnly: false,
          messageType: 'enquiry',
          subject: `[Queries] ${drive.companyName} - Student Doubts & Clarifications`,
          content: `Official doubt resolution thread for ${drive.companyName}. Students can ask any questions regarding eligibility, roles, or drive rounds here. The placement office will reply.`,
          priority: 'Normal',
          targetGroup: 'all',
        });
        createdCount++;
      }
    }

    return res.status(200).json({ success: true, createdCount });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
