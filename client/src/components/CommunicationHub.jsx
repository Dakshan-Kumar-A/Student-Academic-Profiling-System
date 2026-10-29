import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import api from '../services/api';

const CHANNELS = [
  {
    id: 'placement_announcements',
    name: 'Placement Announcements',
    icon: 'bi-megaphone-fill',
    badgeColor: 'bg-danger',
    description: 'Official broadcast channel by Placement Cell. Read-only for students.',
    canPost: (role) => role === 'placement_officer' || role === 'admin',
  },
  {
    id: 'placement_queries',
    name: 'Placement Queries',
    icon: 'bi-question-diamond-fill',
    badgeColor: 'bg-primary',
    description: 'Post placement-related questions, eligibility clarifications, and process queries.',
    canPost: () => true, // Everyone can post
  },
  {
    id: 'department_channel',
    name: 'Department Channel',
    icon: 'bi-building-fill',
    badgeColor: 'bg-success',
    description: 'Departmental updates, academic notices, and coordinator announcements.',
    canPost: (role) => role === 'department_coordinator' || role === 'mentor' || role === 'admin',
  },
  {
    id: 'mentorship_channel',
    name: 'Mentorship Channel',
    icon: 'bi-mortarboard-fill',
    badgeColor: 'bg-info text-dark',
    description: 'Dedicated mentoring group communications and guidance notes.',
    canPost: (role) => role === 'mentor' || role === 'department_coordinator' || role === 'admin',
  },
  {
    id: 'general_channel',
    name: 'General Discussion',
    icon: 'bi-chat-dots-fill',
    badgeColor: 'bg-secondary',
    description: 'Open discussion forum for all registered students, faculty, and coordinators.',
    canPost: () => true,
  },
];

export default function CommunicationHub({ user }) {
  const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  const userRole = currentUser.role || '';

  const [activeChannelId, setActiveChannelId] = useState('placement_announcements');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Compose State
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);

  // Thread Reply State
  const [expandedThreadId, setExpandedThreadId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const activeChannel = CHANNELS.find(c => c.id === activeChannelId) || CHANNELS[0];
  const userCanPost = activeChannel.canPost(userRole);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const res = await api.get('/communication/messages', {
        params: { channel: activeChannelId, search: searchQuery },
      });

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
  }, [activeChannelId, searchQuery]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) {
      Swal.fire('Required', 'Please enter both subject and message content.', 'warning');
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

      const res = await api.post('/communication/messages', payload);

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Message Posted',
          text: `Message published to ${activeChannel.name}.`,
          timer: 1500,
          showConfirmButton: false,
        });
        setSubject('');
        setContent('');
        setShowCompose(false);
        fetchMessages();
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to post message.', 'error');
    } finally {
      setPosting(false);
    }
  };

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
            <small className="text-muted">Universal purpose-driven announcement and query channels</small>
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
                placeholder="Search messages..."
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
                {showCompose ? 'Cancel' : 'Post Message'}
              </button>
            )}
          </div>
        </div>

        {/* Channel Navigation Pills */}
        <div className="nav nav-pills flex-nowrap overflow-auto gap-2 pb-1">
          {CHANNELS.map((ch) => {
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
              <i className="bi bi-lock-fill me-1"></i> Read-Only for Your Role
            </span>
          )}
        </div>

        {/* Compose Form */}
        {showCompose && userCanPost && (
          <form onSubmit={handleSendMessage} className="bg-light p-3 rounded-3 border mb-4 animate__animated animate__fadeIn">
            <div className="fw-bold text-dark small mb-2 d-flex align-items-center gap-2">
              <i className="bi bi-pencil-square text-primary"></i> Compose Message to {activeChannel.name}
            </div>

            <div className="row g-2 mb-2">
              <div className="col-md-9">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Subject / Title *"
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
                placeholder="Write message details or query..."
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
                    <i className="bi bi-send-fill me-1"></i> Broadcast Message
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Message Thread List */}
        {loading && messages.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <span className="spinner-border text-primary spinner-border-sm me-2"></span> Loading conversation feed...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-5 text-muted bg-light rounded-3">
            <i className="bi bi-chat-square-dots fs-1 d-block mb-2 text-secondary opacity-50"></i>
            <div className="fw-semibold">No messages in this channel yet</div>
            <small>New announcements and queries will appear here in real-time.</small>
          </div>
        ) : (
          <div className="d-flex flex-column gap-3">
            {messages.map((msg) => {
              const isExpanded = expandedThreadId === msg._id;
              const repliesCount = Array.isArray(msg.replies) ? msg.replies.length : 0;
              const isUrgent = msg.priority === 'Urgent';
              const isImportant = msg.priority === 'Important';

              return (
                <div
                  key={msg._id}
                  className={`border rounded-3 p-3 transition-shadow ${
                    isUrgent ? 'border-danger-subtle bg-danger-subtle bg-opacity-10' :
                    isImportant ? 'border-warning-subtle bg-warning-subtle bg-opacity-10' :
                    'bg-white shadow-sm'
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
                        <div className="fw-bold small text-dark">{msg.sender?.name || 'Authorized User'}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          <span className="text-capitalize badge bg-light text-dark border me-1">
                            {msg.sender?.role?.replace('_', ' ') || 'Staff'}
                          </span>
                          {msg.department ? `${msg.department} • ` : ''}
                          {new Date(msg.createdAt).toLocaleDateString()} at{' '}
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      {isUrgent && <span className="badge bg-danger">Urgent</span>}
                      {isImportant && <span className="badge bg-warning text-dark">Important</span>}
                      {msg.driveId && <span className="badge bg-info text-dark">Drive Update</span>}
                    </div>
                  </div>

                  <h6 className="fw-bold text-dark mt-2 mb-1">{msg.subject}</h6>
                  <p className="text-secondary small mb-2 lh-base" style={{ whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </p>

                  {/* Reply Action & Count */}
                  <div className="d-flex align-items-center justify-content-between pt-2 border-top mt-2">
                    <button
                      className="btn btn-link btn-sm text-decoration-none text-primary p-0 d-flex align-items-center gap-1 small fw-semibold"
                      onClick={() => setExpandedThreadId(isExpanded ? null : msg._id)}
                    >
                      <i className={`bi ${isExpanded ? 'bi-chevron-up' : 'bi-reply-fill'}`}></i>
                      <span>{repliesCount > 0 ? `${repliesCount} ${repliesCount === 1 ? 'Reply' : 'Replies'}` : 'Reply to Thread'}</span>
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

                      {/* Reply Box */}
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
