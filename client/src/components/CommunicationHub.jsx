import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../services/api';

const ALL_CHANNELS = [
  {
    id: 'placement_announcements',
    name: 'Placement Announcements',
    icon: 'bi-megaphone-fill',
    badgeColor: 'bg-danger text-white',
    description: 'Official drive postings and updates by the Placement Cell. Further details are continued on each drive thread.',
    canPost: (role) => role === 'placement_officer' || role === 'admin',
    canReply: (role) => role === 'placement_officer' || role === 'admin',
  },
  {
    id: 'placement_queries',
    name: 'Placement Queries',
    icon: 'bi-question-diamond-fill',
    badgeColor: 'bg-primary text-white',
    description: 'Q&A threads for each drive company name. Students ask doubts and queries; Placement Officers provide answers.',
    canPost: (role) => role === 'student' || role === 'placement_officer' || role === 'admin',
    canReply: (role) => role === 'student' || role === 'placement_officer' || role === 'admin',
  },
  {
    id: 'department_channel',
    name: 'Department Channel',
    icon: 'bi-building-fill',
    badgeColor: 'bg-success text-white',
    description: 'Departmental notices, academic schedules, and coordinator announcements. Filter by section or audience.',
    canPost: (role) => role === 'department_coordinator' || role === 'mentor' || role === 'admin',
    canReply: (role) => true,
  },
  {
    id: 'mentorship_channel',
    name: 'Mentorship Channel',
    icon: 'bi-mortarboard-fill',
    badgeColor: 'bg-info text-dark',
    description: 'Dedicated mentoring group guidance notes. Mentors can restrict messages to their assigned mentees.',
    canPost: (role) => role === 'mentor' || role === 'department_coordinator' || role === 'admin',
    canReply: (role) => true,
  },
  {
    id: 'general_channel',
    name: 'General Discussion',
    icon: 'bi-chat-dots-fill',
    badgeColor: 'bg-secondary text-white',
    description: 'Open discussion across college. Filter audience by department, role, or send 1-on-1 direct messages.',
    canPost: () => true,
    canReply: () => true,
  },
];

const DEPARTMENTS = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS'];
const ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'mentor', label: 'Faculty Mentor' },
  { value: 'department_coordinator', label: 'Department Coordinator' },
  { value: 'placement_officer', label: 'Placement Officer' },
];

export default function CommunicationHub({ user }) {
  const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = currentUser.role || '';
  const userDept = currentUser.department || '';

  // 1) Role Channel Visibility Constraints
  // Placement officer: only Placement Announcements, Placement Queries, General Discussion
  // Department coordinator: Placement Announcements, Department Channel, General Discussion
  // Mentor: Placement Announcements, Department Channel, Mentorship channel, General Discussion
  // Student & Admin: All 5 channels
  const availableChannels = ALL_CHANNELS.filter((ch) => {
    if (userRole === 'admin') return true;
    if (userRole === 'placement_officer') {
      return ['placement_announcements', 'placement_queries', 'general_channel'].includes(ch.id);
    }
    if (userRole === 'department_coordinator') {
      return ['placement_announcements', 'department_channel', 'general_channel'].includes(ch.id);
    }
    if (userRole === 'mentor') {
      return ['placement_announcements', 'department_channel', 'mentorship_channel', 'general_channel'].includes(ch.id);
    }
    if (userRole === 'student') {
      return ['placement_announcements', 'placement_queries', 'department_channel', 'mentorship_channel', 'general_channel'].includes(ch.id);
    }
    return true;
  });

  const defaultChannelId = availableChannels[0]?.id || 'placement_announcements';
  const [activeChannelId, setActiveChannelId] = useState(defaultChannelId);

  // If user role changes or activeChannelId is not permitted, switch
  useEffect(() => {
    if (!availableChannels.some((c) => c.id === activeChannelId)) {
      setActiveChannelId(availableChannels[0]?.id || 'general_channel');
    }
  }, [userRole]);

  const activeChannel = availableChannels.find((c) => c.id === activeChannelId) || availableChannels[0] || ALL_CHANNELS[0];
  const userCanPost = activeChannel.canPost(userRole);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Detailed Filter State for General Discussion
  const [generalFilterMode, setGeneralFilterMode] = useState('all'); // 'all' | 'direct' | 'public' | 'sent'
  const [generalDeptFilter, setGeneralDeptFilter] = useState('all');
  const [generalRoleFilter, setGeneralRoleFilter] = useState('all');

  // Compose State
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);

  // Audience Filtering Fields for Compose
  // Department Channel Audience options: 'all_department', 'all_students', 'all_mentors', 'section'
  const [deptAudienceType, setDeptAudienceType] = useState('all_department');
  const [deptTargetSection, setDeptTargetSection] = useState('A');

  // Mentorship Channel Audience: menteesOnly toggle
  const [menteesOnly, setMenteesOnly] = useState(false);

  // General Channel Audience options: 'public', 'filter', 'direct'
  const [generalAudienceMode, setGeneralAudienceMode] = useState('public');
  const [targetDept, setTargetDept] = useState('all');
  const [targetRole, setTargetRole] = useState('all');
  const [directRecipientUserId, setDirectRecipientUserId] = useState('');

  // Recipients list for direct messages / user selection
  const [recipientsList, setRecipientsList] = useState([]);
  const [recipientSearchText, setRecipientSearchText] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Thread Reply State
  const [expandedThreadId, setExpandedThreadId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  // Initial Sync of Drives into Announcement & Query Threads
  useEffect(() => {
    api.post('/communication/sync-drive-threads').catch(() => {});
  }, []);

  // Fetch recipients list when needed
  const fetchRecipients = async (search = '') => {
    try {
      setLoadingRecipients(true);
      const res = await api.get('/communication/recipients', {
        params: { channel: activeChannelId, search },
      });
      if (res.data.success) {
        setRecipientsList(res.data.users || []);
      }
    } catch (err) {
      console.error('Failed to load recipients:', err);
    } finally {
      setLoadingRecipients(false);
    }
  };

  useEffect(() => {
    if (showCompose && (generalAudienceMode === 'direct' || activeChannelId === 'mentorship_channel')) {
      fetchRecipients(recipientSearchText);
    }
  }, [showCompose, generalAudienceMode, activeChannelId, recipientSearchText]);

  // Fetch Channel Messages
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const params = {
        channel: activeChannelId,
        search: searchQuery,
      };

      if (activeChannelId === 'general_channel') {
        params.filterMode = generalFilterMode;
        params.filterDept = generalDeptFilter;
        params.filterRole = generalRoleFilter;
      }

      const res = await api.get('/communication/messages', { params });
      if (res.data.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error('Failed to fetch channel messages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 15000);
    return () => clearInterval(interval);
  }, [activeChannelId, searchQuery, generalFilterMode, generalDeptFilter, generalRoleFilter]);

  // Handle Post Message with Audience Filtering
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) {
      Swal.fire('Required', 'Please enter both subject and message content.', 'warning');
      return;
    }

    if (activeChannelId === 'general_channel' && generalAudienceMode === 'direct' && !directRecipientUserId) {
      Swal.fire('Recipient Required', 'Please select a recipient for your direct message.', 'warning');
      return;
    }

    setPosting(true);
    try {
      const payload = {
        channel: activeChannelId,
        subject: subject.trim(),
        content: content.trim(),
        priority,
      };

      // 1. Department Channel Audience
      if (activeChannelId === 'department_channel') {
        if (deptAudienceType === 'all_students') {
          payload.targetGroup = 'all_students';
        } else if (deptAudienceType === 'all_mentors') {
          payload.targetGroup = 'all_mentors';
        } else if (deptAudienceType === 'section') {
          payload.targetGroup = 'all_students';
          payload.targetSection = deptTargetSection;
        } else {
          payload.targetGroup = 'all_department';
        }
      }

      // 2. Mentorship Channel Audience
      if (activeChannelId === 'mentorship_channel') {
        payload.menteesOnly = Boolean(menteesOnly);
        payload.targetGroup = menteesOnly ? 'all_mentees' : 'all_department';
      }

      // 3. General Channel Audience
      if (activeChannelId === 'general_channel') {
        if (generalAudienceMode === 'direct') {
          payload.isDirectMessage = true;
          payload.targetGroup = 'direct_message';
          payload.directRecipientUserId = directRecipientUserId;
        } else if (generalAudienceMode === 'filter') {
          payload.targetGroup = 'all';
          payload.targetDepartment = targetDept;
          payload.targetRole = targetRole;
        } else {
          payload.targetGroup = 'all';
        }
      }

      const res = await api.post('/communication/messages', payload);

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Message Published',
          text: `Message published to ${activeChannel.name}.`,
          timer: 1500,
          showConfirmButton: false,
        });
        setSubject('');
        setContent('');
        setDirectRecipientUserId('');
        setShowCompose(false);
        fetchMessages();
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to post message.', 'error');
    } finally {
      setPosting(false);
    }
  };

  // Handle Send Reply
  const handleSendReply = async (messageId) => {
    if (!replyText.trim()) return;

    setReplying(true);
    try {
      const res = await api.post(`/communication/messages/${messageId}/reply`, {
        content: replyText.trim(),
      });

      if (res.data.success) {
        setReplyText('');
        fetchMessages();
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send reply.', 'error');
    } finally {
      setReplying(false);
    }
  };

  return (
    <div className="card border-0 shadow-sm rounded-3">
      {/* Channel Header Tabs */}
      <div className="card-header bg-white border-bottom p-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div>
            <h5 className="fw-bold mb-1 d-flex align-items-center gap-2 text-dark">
              <i className="bi bi-chat-left-quote-fill text-primary"></i>
              Central Communication Hub
            </h5>
            <small className="text-muted">
              Role: <span className="badge bg-primary-subtle text-primary text-capitalize">{userRole.replace('_', ' ')}</span>
              {userDept && <span> • Dept: <strong className="text-dark">{userDept}</strong></span>}
            </small>
          </div>

          <div className="d-flex align-items-center gap-2">
            {/* Live Search */}
            <div className="input-group input-group-sm" style={{ width: '220px' }}>
              <span className="input-group-text bg-light border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control form-control-sm border-start-0 bg-light"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="btn btn-outline-secondary border-start-0" onClick={() => setSearchQuery('')}>
                  <i className="bi bi-x"></i>
                </button>
              )}
            </div>

            {/* Compose Button if permitted */}
            {userCanPost && (
              <button
                className={`btn btn-sm ${showCompose ? 'btn-outline-secondary' : 'btn-primary'} fw-semibold d-flex align-items-center gap-1`}
                onClick={() => setShowCompose(!showCompose)}
              >
                <i className={`bi ${showCompose ? 'bi-x-lg' : 'bi-plus-circle'}`}></i>
                {showCompose ? 'Cancel' : 'New Thread / Message'}
              </button>
            )}
          </div>
        </div>

        {/* Channel Navigation Pills (Strictly limited to user's permitted channels) */}
        <div className="nav nav-pills flex-nowrap overflow-auto gap-2 pb-1">
          {availableChannels.map((ch) => {
            const isActive = ch.id === activeChannelId;
            return (
              <button
                key={ch.id}
                className={`nav-link text-nowrap d-flex align-items-center gap-2 py-2 px-3 rounded-pill fw-semibold border ${
                  isActive ? 'bg-primary text-white border-primary shadow-sm' : 'bg-light text-dark border-secondary-subtle'
                }`}
                style={{ fontSize: '0.85rem' }}
                onClick={() => {
                  setActiveChannelId(ch.id);
                  setShowCompose(false);
                }}
              >
                <i className={`bi ${ch.icon}`}></i>
                <span>{ch.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="card-body p-3 p-md-4">
        {/* Channel Info Banner */}
        <div className="alert alert-light border rounded-3 p-3 mb-3 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <span className={`badge rounded-pill ${activeChannel.badgeColor} p-2`}>
              <i className={`bi ${activeChannel.icon} fs-6`}></i>
            </span>
            <div>
              <div className="fw-bold small text-dark">{activeChannel.name}</div>
              <small className="text-secondary">{activeChannel.description}</small>
            </div>
          </div>
          {!userCanPost && (
            <span className="badge bg-secondary-subtle text-secondary border small">
              <i className="bi bi-eye-fill me-1"></i> View Only
            </span>
          )}
        </div>

        {/* DETAILED SEARCH & FILTER TOOLBAR FOR GENERAL DISCUSSION */}
        {activeChannelId === 'general_channel' && (
          <div className="card border-0 bg-light p-3 rounded-3 mb-4 shadow-sm">
            <div className="row g-2 align-items-center">
              <div className="col-12 col-md-auto d-flex align-items-center gap-1">
                <span className="small fw-bold text-muted me-1">Filter View:</span>
                <div className="btn-group btn-group-sm">
                  <button
                    className={`btn ${generalFilterMode === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setGeneralFilterMode('all')}
                  >
                    All Messages
                  </button>
                  <button
                    className={`btn ${generalFilterMode === 'direct' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setGeneralFilterMode('direct')}
                  >
                    <i className="bi bi-chat-heart-fill me-1"></i> Direct (1-on-1)
                  </button>
                  <button
                    className={`btn ${generalFilterMode === 'public' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setGeneralFilterMode('public')}
                  >
                    Public Broadcasts
                  </button>
                  <button
                    className={`btn ${generalFilterMode === 'sent' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setGeneralFilterMode('sent')}
                  >
                    My Posts
                  </button>
                </div>
              </div>

              <div className="col-6 col-md-3 ms-auto">
                <select
                  className="form-select form-select-sm"
                  value={generalDeptFilter}
                  onChange={(e) => setGeneralDeptFilter(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="Placement Cell">Placement Cell</option>
                </select>
              </div>

              <div className="col-6 col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={generalRoleFilter}
                  onChange={(e) => setGeneralRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* COMPOSE FORM WITH AUDIENCE FILTERING */}
        {showCompose && userCanPost && (
          <form onSubmit={handleSendMessage} className="bg-light p-4 rounded-3 border mb-4 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-pencil-square text-primary"></i> Create New Thread in {activeChannel.name}
              </h6>
              <span className="badge bg-white text-secondary border small">Recipient Filtering Active</span>
            </div>

            {/* AUDIENCE SELECTOR BASED ON ACTIVE CHANNEL */}

            {/* 1. Department Channel Audience Filter */}
            {activeChannelId === 'department_channel' && (
              <div className="card p-3 border rounded-3 bg-white mb-3 shadow-sm">
                <label className="form-label small fw-bold text-muted mb-2">
                  <i className="bi bi-funnel-fill text-success me-1"></i> Who gets to view this message in {userDept || 'Department'}?
                </label>
                <div className="row g-2 align-items-center">
                  <div className="col-md-6">
                    <select
                      className="form-select form-select-sm"
                      value={deptAudienceType}
                      onChange={(e) => setDeptAudienceType(e.target.value)}
                    >
                      <option value="all_department">All Members (Students, Mentors, Coordinator)</option>
                      <option value="all_students">All Students in Department</option>
                      <option value="section">Specific Section (e.g. Section A)</option>
                      <option value="all_mentors">Faculty Mentors Only</option>
                    </select>
                  </div>
                  {deptAudienceType === 'section' && (
                    <div className="col-md-4">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-light">Section:</span>
                        <select
                          className="form-select form-select-sm"
                          value={deptTargetSection}
                          onChange={(e) => setDeptTargetSection(e.target.value)}
                        >
                          <option value="A">Section A</option>
                          <option value="B">Section B</option>
                          <option value="C">Section C</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. Mentorship Channel Audience Filter */}
            {activeChannelId === 'mentorship_channel' && (
              <div className="card p-3 border rounded-3 bg-white mb-3 shadow-sm">
                <div className="form-check form-switch mb-0">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="menteesOnlyToggle"
                    checked={menteesOnly}
                    onChange={(e) => setMenteesOnly(e.target.checked)}
                  />
                  <label className="form-check-label fw-bold text-dark small" htmlFor="menteesOnlyToggle">
                    <i className="bi bi-person-check-fill text-info me-1"></i> Restrict visibility to my assigned mentees only
                  </label>
                </div>
                <small className="text-muted d-block mt-1">
                  {menteesOnly
                    ? 'Only students allocated under your mentorship will be able to view and participate in this thread.'
                    : 'Visible to all students and mentors of the same department.'}
                </small>
              </div>
            )}

            {/* 3. General Channel Audience Filter */}
            {activeChannelId === 'general_channel' && (
              <div className="card p-3 border rounded-3 bg-white mb-3 shadow-sm">
                <label className="form-label small fw-bold text-muted mb-2">
                  <i className="bi bi-people-fill text-primary me-1"></i> Target Audience & Message Type
                </label>
                <div className="d-flex flex-wrap gap-3 mb-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="generalMode"
                      id="gm_public"
                      value="public"
                      checked={generalAudienceMode === 'public'}
                      onChange={(e) => setGeneralAudienceMode(e.target.value)}
                    />
                    <label className="form-check-label small fw-semibold text-dark" htmlFor="gm_public">
                      Public Discussion (Everyone in college)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="generalMode"
                      id="gm_filter"
                      value="filter"
                      checked={generalAudienceMode === 'filter'}
                      onChange={(e) => setGeneralAudienceMode(e.target.value)}
                    />
                    <label className="form-check-label small fw-semibold text-dark" htmlFor="gm_filter">
                      Filtered Broadcast (Specific Dept / Role)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="radio"
                      name="generalMode"
                      id="gm_direct"
                      value="direct"
                      checked={generalAudienceMode === 'direct'}
                      onChange={(e) => setGeneralAudienceMode(e.target.value)}
                    />
                    <label className="form-check-label small fw-semibold text-dark" htmlFor="gm_direct">
                      One-on-One Direct Message
                    </label>
                  </div>
                </div>

                {/* Filter Options */}
                {generalAudienceMode === 'filter' && (
                  <div className="row g-2 pt-2 border-top">
                    <div className="col-md-6">
                      <label className="form-label small text-muted mb-1">Target Department:</label>
                      <select
                        className="form-select form-select-sm"
                        value={targetDept}
                        onChange={(e) => setTargetDept(e.target.value)}
                      >
                        <option value="all">All Departments</option>
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small text-muted mb-1">Target Role:</label>
                      <select
                        className="form-select form-select-sm"
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value)}
                      >
                        <option value="all">All Roles</option>
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Direct Message Recipient Picker */}
                {generalAudienceMode === 'direct' && (
                  <div className="pt-2 border-top">
                    <label className="form-label small fw-semibold text-dark mb-1">
                      Choose Recipient (Student, Mentor, Coordinator, Officer):
                    </label>
                    <div className="row g-2">
                      <div className="col-md-5">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Search recipient name / email..."
                          value={recipientSearchText}
                          onChange={(e) => setRecipientSearchText(e.target.value)}
                        />
                      </div>
                      <div className="col-md-7">
                        <select
                          className="form-select form-select-sm"
                          value={directRecipientUserId}
                          onChange={(e) => setDirectRecipientUserId(e.target.value)}
                          required={generalAudienceMode === 'direct'}
                        >
                          <option value="">-- Select Person to Message --</option>
                          {recipientsList.map((u) => (
                            <option key={u._id} value={u._id}>
                              {u.name} ({u.role.replace('_', ' ')} • {u.department || 'General'}) - {u.email}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <small className="text-muted d-block mt-1">
                      <i className="bi bi-shield-lock-fill text-warning me-1"></i>
                      Only you and the selected recipient will be able to view and exchange messages in this thread.
                    </small>
                  </div>
                )}
              </div>
            )}

            {/* Standard Subject & Content Inputs */}
            <div className="row g-2 mb-2">
              <div className="col-md-9">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Thread Subject / Title *"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="Normal">Priority: Normal</option>
                  <option value="Important">Priority: Important</option>
                  <option value="Urgent">Priority: Urgent</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <textarea
                className="form-control form-control-sm"
                rows="3"
                placeholder="Type your message, announcement, or question here..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              ></textarea>
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => setShowCompose(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm fw-semibold"
                disabled={posting}
              >
                {posting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1"></span> Posting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send-fill me-1"></i> Publish Thread
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* MESSAGE THREAD LIST */}
        {loading && messages.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <span className="spinner-border text-primary spinner-border-sm me-2"></span> Loading conversation feed...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-5 text-muted bg-light rounded-3">
            <i className="bi bi-chat-square-dots fs-1 d-block mb-2 text-secondary opacity-50"></i>
            <div className="fw-semibold">No messages in this channel</div>
            <small>New announcements and threads matching your recipient filters will appear here.</small>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {messages.map((msg) => {
              const isExpanded = expandedThreadId === msg._id;
              const repliesCount = Array.isArray(msg.replies) ? msg.replies.length : 0;
              const isUrgent = msg.priority === 'Urgent';
              const isImportant = msg.priority === 'Important';
              const canReplyThisThread = activeChannel.canReply(userRole);

              return (
                <div
                  key={msg._id}
                  className={`border rounded-3 p-3 transition-shadow ${
                    isUrgent
                      ? 'border-danger-subtle bg-danger-subtle bg-opacity-10'
                      : isImportant
                      ? 'border-warning-subtle bg-warning-subtle bg-opacity-10'
                      : 'bg-white shadow-sm'
                  }`}
                >
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <div
                        className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                        style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}
                      >
                        {msg.sender?.name ? msg.sender.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <div className="fw-bold small text-dark d-flex align-items-center gap-2">
                          <span>{msg.sender?.name || 'Authorized Member'}</span>
                          <span className="badge bg-light text-secondary border" style={{ fontSize: '0.7rem' }}>
                            {msg.sender?.role ? msg.sender.role.replace('_', ' ') : 'Member'}
                          </span>
                        </div>
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                          <span>{msg.department}</span> • <span>{new Date(msg.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-1">
                      {/* Audience Badge Indicators */}
                      {msg.isDirectMessage && (
                        <span className="badge bg-dark text-white" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-person-fill me-1"></i> Direct Message (1-on-1)
                        </span>
                      )}
                      {msg.menteesOnly && (
                        <span className="badge bg-info text-dark" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-mortarboard-fill me-1"></i> Mentees Only
                        </span>
                      )}
                      {msg.targetSection && msg.targetSection !== 'all' && (
                        <span className="badge bg-success-subtle text-success border border-success-subtle" style={{ fontSize: '0.7rem' }}>
                          Section {msg.targetSection}
                        </span>
                      )}
                      {msg.driveId && (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle" style={{ fontSize: '0.7rem' }}>
                          <i className="bi bi-briefcase-fill me-1"></i> Drive Thread
                        </span>
                      )}
                      {isUrgent && <span className="badge bg-danger">Urgent</span>}
                      {isImportant && <span className="badge bg-warning text-dark">Important</span>}
                    </div>
                  </div>

                  <h6 className="fw-bold text-dark mb-1">{msg.subject}</h6>
                  <p className="text-secondary small mb-3" style={{ whiteSpace: 'pre-line' }}>{msg.content}</p>

                  {/* Thread Action Footer */}
                  <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                    <button
                      className="btn btn-link btn-sm p-0 text-decoration-none fw-semibold d-flex align-items-center gap-1"
                      onClick={() => setExpandedThreadId(isExpanded ? null : msg._id)}
                    >
                      <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-chat-text'}`}></i>
                      {repliesCount > 0 ? `${repliesCount} ${repliesCount === 1 ? 'Reply' : 'Replies'}` : 'Reply / Discuss'}
                    </button>
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>
                      Thread ID: {String(msg._id).substring(0, 8)}
                    </small>
                  </div>

                  {/* Expanded Thread Replies & Input */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-top bg-light p-3 rounded-2">
                      {/* Replies List */}
                      {repliesCount > 0 ? (
                        <div className="d-flex flex-column gap-2 mb-3">
                          {msg.replies.map((rep, rIdx) => (
                            <div key={rIdx} className="bg-white p-2 rounded border small">
                              <div className="d-flex justify-content-between align-items-center mb-1">
                                <span className="fw-bold text-dark" style={{ fontSize: '0.8rem' }}>
                                  {rep.sender?.name || rep.senderName || 'Participant'}
                                  <span className="badge bg-light text-secondary border ms-1" style={{ fontSize: '0.65rem' }}>
                                    {(rep.sender?.role || rep.senderRole || 'user').replace('_', ' ')}
                                  </span>
                                </span>
                                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                                  {new Date(rep.sentAt || rep.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </small>
                              </div>
                              <div className="text-secondary" style={{ fontSize: '0.82rem' }}>{rep.content}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-muted small mb-2 fst-italic">No replies yet. Be the first to answer.</div>
                      )}

                      {/* Reply Box if permitted */}
                      {canReplyThisThread ? (
                        <div className="input-group input-group-sm">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Type your reply here..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendReply(msg._id);
                            }}
                          />
                          <button
                            className="btn btn-primary fw-semibold"
                            disabled={replying || !replyText.trim()}
                            onClick={() => handleSendReply(msg._id)}
                          >
                            {replying ? 'Sending...' : 'Send'}
                          </button>
                        </div>
                      ) : (
                        <div className="alert alert-secondary small py-2 mb-0">
                          <i className="bi bi-lock-fill me-1"></i>
                          {activeChannelId === 'placement_announcements'
                            ? 'Placement announcements are broadcast-only. Only placement officers can continue updates here.'
                            : 'You are not authorized to reply on this channel.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
