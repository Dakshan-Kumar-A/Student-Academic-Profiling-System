const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const CommunicationMessage = require('../models/CommunicationMessage');
const { protect } = require('../middleware/auth');
const { createNotification } = require('../services/notificationService');
const { sendTicketNotificationEmail } = require('../utils/mailer');
const { logSystemEvent } = require('../utils/logger');

router.use(protect);

// @route   POST /api/tickets
// @desc    Raise a support or feature request ticket
//          - 'problem_fix': open to all roles
//          - 'feature_modification': restricted to placement_officer, department_coordinator, and admin
router.post('/', async (req, res) => {
  try {
    const { ticketType, category, subject, description, priority } = req.body;

    if (!ticketType || !subject || !description) {
      return res.status(400).json({
        success: false,
        message: 'ticketType, subject, and description are required.',
      });
    }

    // Role Enforcement for Feature/Modification tickets
    if (ticketType === 'feature_modification') {
      const allowedRoles = ['placement_officer', 'department_coordinator', 'admin'];
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Only Placement Officers and Department Coordinators can raise Feature / Modification tickets. For issues or bugs, please submit a Problem/Fix ticket.',
        });
      }
    }

    const ticket = new Ticket({
      ticketType,
      category: category || 'Other',
      subject: subject.trim(),
      description: description.trim(),
      priority: priority || 'Medium',
      raisedBy: {
        userId: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        department: req.user.department || '',
      },
    });

    await ticket.save();

    // Notify all admins via system notification & email
    const admins = await User.find({ role: 'admin' }).select('_id email name');
    for (const adm of admins) {
      await createNotification({
        recipientId: adm._id,
        senderUser: req.user,
        type: 'announcement',
        title: `[Ticket ${ticket.ticketNumber}] ${ticket.ticketType === 'feature_modification' ? 'Feature Request' : 'Problem Report'}`,
        message: `${req.user.name} (${req.user.role}): ${ticket.subject}`,
        relatedId: ticket._id,
        link: '/admin',
      });
    }

    // Trigger email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || (admins.length > 0 ? admins[0].email : 'admin@college.edu');
      await sendTicketNotificationEmail({
        toEmail: adminEmail,
        ticketNumber: ticket.ticketNumber,
        ticketType: ticket.ticketType,
        raisedByName: req.user.name,
        raisedByRole: req.user.role,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
      });
    } catch (mailErr) {
      console.warn('Failed to dispatch ticket email to admin:', mailErr.message);
    }

    await logSystemEvent({
      level: 'info',
      module: 'tickets',
      action: 'TICKET_CREATED',
      message: `Ticket ${ticket.ticketNumber} created by ${req.user.name} (${ticket.ticketType})`,
      req,
    });

    return res.status(201).json({
      success: true,
      message: `Ticket ${ticket.ticketNumber} has been successfully raised. Admin has been notified.`,
      ticket,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/tickets
// @desc    Get tickets list: Admin gets all tickets; other roles get their own raised tickets
router.get('/', async (req, res) => {
  try {
    const { status, ticketType, search } = req.query;
    let query = {};

    if (req.user.role !== 'admin') {
      query['raisedBy.userId'] = req.user._id;
    }

    if (status && status !== 'all') {
      query.status = status;
    }

    if (ticketType && ticketType !== 'all') {
      query.ticketType = ticketType;
    }

    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { ticketNumber: { $regex: s, $options: 'i' } },
        { subject: { $regex: s, $options: 'i' } },
        { 'raisedBy.name': { $regex: s, $options: 'i' } },
        { 'raisedBy.email': { $regex: s, $options: 'i' } },
      ];
    }

    const tickets = await Ticket.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const counts = {
      total: tickets.length,
      open: tickets.filter((t) => t.status === 'Open').length,
      inProgress: tickets.filter((t) => t.status === 'In Progress').length,
      resolved: tickets.filter((t) => t.status === 'Resolved').length,
      closed: tickets.filter((t) => t.status === 'Closed').length,
    };

    return res.status(200).json({
      success: true,
      counts,
      tickets,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/tickets/:id
// @desc    Get ticket by ID
router.get('/:id', async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (req.user.role !== 'admin' && ticket.raisedBy.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/tickets/:id/reply
// @desc    Reply to a ticket. Admin replies cross-post via Communication Hub messages & notifications
router.post('/:id/reply', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Reply content cannot be empty.' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const isRaiser = ticket.raisedBy.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && !isRaiser) {
      return res.status(403).json({ success: false, message: 'Not authorized to reply to this ticket.' });
    }

    const reply = {
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      content: content.trim(),
      sentAt: new Date(),
    };

    ticket.replies.push(reply);
    if (isAdmin && ticket.status === 'Open') {
      ticket.status = 'In Progress';
    }
    await ticket.save();

    // If Admin is replying: notify raiser and cross-post into Communication Hub
    if (isAdmin && !isRaiser) {
      // 1. In-app notification
      await createNotification({
        recipientId: ticket.raisedBy.userId,
        senderUser: req.user,
        type: 'message_reply',
        title: `Admin Response on Ticket [${ticket.ticketNumber}]`,
        message: `${content.substring(0, 100)}...`,
        relatedId: ticket._id,
        link: ticket.raisedBy.role === 'placement_officer' ? '/placement' : ticket.raisedBy.role === 'department_coordinator' ? '/coordinator' : ticket.raisedBy.role === 'mentor' ? '/mentor' : '/student',
      });

      // 2. Cross-post communication message so raiser receives reply in Communication Hub
      try {
        const commMsg = new CommunicationMessage({
          sender: {
            userId: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
          },
          department: ticket.raisedBy.department || 'Administration',
          messageType: 'message',
          channel: 'general',
          subject: `Admin Response: [Ticket ${ticket.ticketNumber}] ${ticket.subject}`,
          content: `Regarding your ticket [${ticket.ticketNumber}] "${ticket.subject}":\n\n${content}`,
          priority: ticket.priority === 'Critical' ? 'Urgent' : 'Normal',
          targetGroup: 'individual',
          recipients: [
            {
              userId: ticket.raisedBy.userId,
              name: ticket.raisedBy.name,
              email: ticket.raisedBy.email,
              role: ticket.raisedBy.role,
            },
          ],
        });
        await commMsg.save();
      } catch (commErr) {
        console.warn('Failed to mirror ticket response to Communication Hub:', commErr.message);
      }
    } else if (isRaiser && !isAdmin) {
      // Raiser replied, notify admins
      const admins = await User.find({ role: 'admin' }).select('_id');
      for (const adm of admins) {
        await createNotification({
          recipientId: adm._id,
          senderUser: req.user,
          type: 'message_reply',
          title: `Reply on Ticket [${ticket.ticketNumber}] from ${ticket.raisedBy.name}`,
          message: `${content.substring(0, 90)}...`,
          relatedId: ticket._id,
          link: '/admin',
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Reply submitted successfully.',
      ticket,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   PUT /api/tickets/:id/status
// @desc    Admin updates ticket status, admin notes
router.put('/:id/status', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only administrators can update ticket status.' });
    }

    const { status, adminNotes } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    if (status) {
      ticket.status = status;
      if (status === 'Resolved' || status === 'Closed') {
        ticket.resolvedAt = new Date();
      }
    }
    if (adminNotes !== undefined) {
      ticket.adminNotes = adminNotes;
    }

    await ticket.save();

    // Notify ticket raiser
    await createNotification({
      recipientId: ticket.raisedBy.userId,
      senderUser: req.user,
      type: 'announcement',
      title: `Ticket [${ticket.ticketNumber}] Status: ${ticket.status}`,
      message: `Admin updated your ticket status to ${ticket.status}.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
      relatedId: ticket._id,
      link: '/admin',
    });

    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${ticket.status}.`,
      ticket,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
