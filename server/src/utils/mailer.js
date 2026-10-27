const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Development / fallback: nodemailer test ethereal account
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('Ethereal test mailer initialized:', testAccount.user);
    } catch (e) {
      // In case of network isolation, use dummy transport
      transporter = {
        sendMail: async (options) => {
          console.log('\n--- [SIMULATED EMAIL SENT] ---');
          console.log(`To: ${options.to}`);
          console.log(`Subject: ${options.subject}`);
          console.log(`Body:\n${options.text || options.html}`);
          console.log('------------------------------\n');
          return { messageId: 'simulated-' + Date.now() };
        },
      };
    }
  }
  return transporter;
};

// Generate an 8-character secure alphanumeric temporary password
const generateTempPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$';
  let tempPass = '';
  for (let i = 0; i < 8; i++) {
    tempPass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tempPass;
};

// Send temporary password email
const sendTempPasswordEmail = async ({ toEmail, recipientName, tempPassword, purpose = 'account_creation' }) => {
  const transport = await getTransporter();

  const isInvite = purpose === 'account_creation';
  const subject = isInvite
    ? 'Your Account Invitation - Student Academic & Career Profiling System'
    : 'Password Reset - Student Academic & Career Profiling System';

  const actionText = isInvite
    ? 'An administrator has created an account for you in the Student Academic, Personal and Career Profiling System.'
    : 'We received a request to reset your password.';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e3a8a; margin-top: 0;">Academic & Career Profiling System</h2>
      <p>Hello <strong>${recipientName || 'User'}</strong>,</p>
      <p>${actionText}</p>
      <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 15px; margin: 20px 0; text-align: center;">
        <span style="font-size: 14px; color: #64748b; display: block; margin-bottom: 6px;">Your Single-Use Temporary Password:</span>
        <span style="font-family: monospace; font-size: 24px; font-weight: bold; color: #0f172a; letter-spacing: 2px;">${tempPassword}</span>
      </div>
      <ul style="color: #475569; font-size: 14px; line-height: 1.6;">
        <li><strong>Single Use Only:</strong> This temporary password will be invalidated immediately after you set your new password.</li>
        <li><strong>Validity:</strong> Usable for only <strong>24 hours</strong> from receiving this email.</li>
        <li>You will be required to create your own new permanent password upon login.</li>
      </ul>
      <p style="font-size: 13px; color: #94a3b8; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 10px;">
        If you did not request this, please contact your department administrator immediately.
      </p>
    </div>
  `;

  const info = await transport.sendMail({
    from: process.env.SMTP_FROM || '"Academic Profiling System" <no-reply@profiling-system.edu>',
    to: toEmail,
    subject,
    text: `Hello ${recipientName},\n\nYour single-use temporary password is: ${tempPassword}\n\nIt is valid for 24 hours only. Please log in and set a new password.`,
    html,
  });

  const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) {
    console.log(`[Email Preview Link for ${toEmail}]: ${previewUrl}`);
  }

  return {
    success: true,
    messageId: info.messageId,
    previewUrl: previewUrl || null,
  };
};

// Send email notification to Admin when a new Ticket is raised
const sendTicketNotificationEmail = async ({
  toEmail,
  ticketNumber,
  ticketType,
  raisedByName,
  raisedByRole,
  subject: ticketSubject,
  description,
  priority,
}) => {
  const transport = await getTransporter();

  const typeLabel =
    ticketType === 'feature_modification' ? 'Feature / Modification Request' : 'Problem / Bug Report';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #dc2626; margin-top: 0;">New Support Ticket: [${ticketNumber}]</h2>
      <p>A new ticket has been submitted to the Administration desk.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
        <tr><td style="padding: 6px; font-weight: bold; width: 30%;">Ticket ID:</td><td style="padding: 6px;">${ticketNumber}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold;">Type:</td><td style="padding: 6px;">${typeLabel}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold;">Priority:</td><td style="padding: 6px;">${priority}</td></tr>
        <tr><td style="padding: 6px; font-weight: bold;">Submitted By:</td><td style="padding: 6px;">${raisedByName} (${raisedByRole})</td></tr>
        <tr><td style="padding: 6px; font-weight: bold;">Subject:</td><td style="padding: 6px;">${ticketSubject}</td></tr>
      </table>
      <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px; margin: 15px 0;">
        <strong>Description:</strong><br/>
        <p style="white-space: pre-wrap; margin-top: 6px; color: #334155;">${description}</p>
      </div>
      <p style="font-size: 13px; color: #64748b;">Log in to the Admin Dashboard to review and respond via the Communication Hub.</p>
    </div>
  `;

  return await transport.sendMail({
    from: process.env.SMTP_FROM || '"Academic Profiling System" <no-reply@profiling-system.edu>',
    to: toEmail || process.env.ADMIN_EMAIL || 'admin@college.edu',
    subject: `[Ticket ${ticketNumber}] ${typeLabel}: ${ticketSubject}`,
    text: `New Ticket [${ticketNumber}]\nType: ${typeLabel}\nBy: ${raisedByName} (${raisedByRole})\nPriority: ${priority}\nSubject: ${ticketSubject}\n\n${description}`,
    html,
  });
};

// Send placement round outcome or absent notification
const sendPlacementRoundEmail = async ({
  toEmail,
  recipientName,
  companyName,
  roundName,
  status,
  instructions = '',
}) => {
  const transport = await getTransporter();

  let subject = `Update: ${companyName} Placement Drive - Round ${roundName}`;
  let bannerColor = '#2563eb';

  if (status === 'Passed') {
    subject = `Congratulations! You cleared ${roundName} for ${companyName}`;
    bannerColor = '#16a34a';
  } else if (status === 'Absent') {
    subject = `ACTION REQUIRED: Marked Absent in ${companyName} - ${roundName}`;
    bannerColor = '#dc2626';
  } else if (status === 'Placed') {
    subject = `🎉 HEARTY CONGRATULATIONS! You have been PLACED at ${companyName}!`;
    bannerColor = '#059669';
  }

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: ${bannerColor}; margin-top: 0;">${subject}</h2>
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>This is an official communication from the Placement Cell regarding your participation in <strong>${companyName}</strong>.</p>
      <div style="background-color: #f8fafc; border-radius: 6px; padding: 14px; margin: 15px 0; border: 1px solid #e2e8f0;">
        <p style="margin: 4px 0;"><strong>Company:</strong> ${companyName}</p>
        <p style="margin: 4px 0;"><strong>Round:</strong> ${roundName}</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> <span style="font-weight: bold; color: ${bannerColor};">${status}</span></p>
      </div>
      ${instructions ? `<div style="background-color: #eff6ff; padding: 12px; border-radius: 6px; margin: 15px 0; color: #1e40af;"><strong>Instructions:</strong> ${instructions}</div>` : ''}
      ${status === 'Absent' ? '<p style="color: #b91c1c;"><strong>Note:</strong> You must submit valid medical or academic proof via email to the Placement Cell within 24 hours. Failure to submit proof will result in suspension from upcoming placement drives.</p>' : ''}
      <p style="font-size: 13px; color: #94a3b8; margin-top: 25px;">Training & Placement Cell, Academic Profiling System</p>
    </div>
  `;

  return await transport.sendMail({
    from: process.env.SMTP_FROM || '"Placement Cell" <placement@profiling-system.edu>',
    to: toEmail,
    subject,
    text: `Hello ${recipientName},\n\nUpdate on ${companyName} - ${roundName}:\nStatus: ${status}\n\n${instructions}`,
    html,
  });
};

module.exports = {
  generateTempPassword,
  sendTempPasswordEmail,
  sendTicketNotificationEmail,
  sendPlacementRoundEmail,
};
