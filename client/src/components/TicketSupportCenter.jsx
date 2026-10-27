import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { ticketAPI } from '../services/api';

export default function TicketSupportCenter({ user }) {
  const [currentUser] = useState(() => {
    return user || JSON.parse(localStorage.getItem('user') || '{}');
  });

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals & Active Ticket
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyContent, setReplyContent] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Form State
  const isOfficerOrCoordinator =
    currentUser?.role === 'placement_officer' ||
    currentUser?.role === 'department_coordinator' ||
    currentUser?.role === 'admin';

  const [formData, setFormData] = useState({
    ticketType: 'problem_fix', // Default for all users
    category: 'UI/UX',
    priority: 'Medium',
    subject: '',
    description: '',
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await ticketAPI.getTickets({
        status: statusFilter,
        ticketType: typeFilter,
        search,
      });
      if (res.data.success) {
        setTickets(res.data.tickets || []);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter, typeFilter]);

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) {
      Swal.fire('Required Fields', 'Please fill in subject and description.', 'warning');
      return;
    }

    setSubmittingTicket(true);
    try {
      const res = await ticketAPI.createTicket(formData);
      if (res.data.success) {
        setShowCreateModal(false);
        setFormData({
          ticketType: 'problem_fix',
          category: 'UI/UX',
          priority: 'Medium',
          subject: '',
          description: '',
        });
        loadTickets();
        Swal.fire({
          icon: 'success',
          title: 'Ticket Raised Successfully',
          html: `<p>Your ticket <strong>[${res.data.ticket.ticketNumber}]</strong> has been submitted.</p><p class="small text-muted">The Administration desk has been alerted via email. You will receive notifications when an admin replies.</p>`,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to raise ticket.', 'error');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedTicket) return;

    setSubmittingReply(true);
    try {
      const res = await ticketAPI.replyTicket(selectedTicket._id, { content: replyContent.trim() });
      if (res.data.success) {
        setSelectedTicket(res.data.ticket);
        setReplyContent('');
        loadTickets();
        Swal.fire({
          icon: 'success',
          title: 'Reply Sent',
          text: 'Your response was delivered to the Administration desk.',
          timer: 1600,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send reply.', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <div className="card shadow-sm border-0 rounded-3">
      {/* Header */}
      <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h5 className="fw-bold mb-0 text-slate-800 d-flex align-items-center">
            <i className="bi bi-ticket-detailed-fill text-primary me-2"></i> Support & Help Desk Tickets
          </h5>
          <small className="text-muted">
            Report issues or request features directly to the administration. Follow up and converse with admins in real-time.
          </small>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={loadTickets}>
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
          <button className="btn btn-primary btn-sm shadow-sm" onClick={() => setShowCreateModal(true)}>
            <i className="bi bi-plus-lg me-1"></i> Raise New Ticket
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="p-3 bg-light border-bottom">
        <div className="row g-2 align-items-center">
          <div className="col-12 col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text"><i className="bi bi-search"></i></span>
              <input
                type="text"
                className="form-control"
                placeholder="Search your tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadTickets()}
              />
            </div>
          </div>
          <div className="col-6 col-md-3">
            <select
              className="form-select form-select-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="col-6 col-md-3">
            <select
              className="form-select form-select-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Ticket Types</option>
              <option value="problem_fix">Problem / Bug Fix</option>
              {isOfficerOrCoordinator && (
                <option value="feature_modification">Feature / Modification</option>
              )}
            </select>
          </div>
          <div className="col-12 col-md-2">
            <button className="btn btn-outline-primary btn-sm w-100" onClick={loadTickets}>
              Filter
            </button>
          </div>
        </div>
      </div>

      {/* Tickets List Table */}
      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light text-muted small text-uppercase">
            <tr>
              <th>Ticket #</th>
              <th>Type</th>
              <th>Category</th>
              <th>Subject & Details</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Date</th>
              <th className="text-end">Follow Up</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center py-4 text-muted">
                  <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                  Loading tickets...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center py-5 text-muted">
                  <i className="bi bi-ticket-perforated display-6 d-block mb-2 text-secondary"></i>
                  No tickets raised yet. Click <strong>"Raise New Ticket"</strong> to submit a request or issue.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t._id}>
                  <td className="fw-bold font-monospace text-primary">{t.ticketNumber}</td>
                  <td>
                    <span
                      className="badge text-white"
                      style={{
                        backgroundColor:
                          t.ticketType === 'feature_modification' ? '#7c3aed' : '#ef4444',
                      }}
                    >
                      {t.ticketType === 'feature_modification' ? 'Feature / Mod' : 'Problem / Fix'}
                    </span>
                  </td>
                  <td className="small text-secondary">{t.category}</td>
                  <td style={{ maxWidth: '320px' }}>
                    <div className="fw-semibold text-dark text-truncate">{t.subject}</div>
                    <div className="small text-muted text-truncate">{t.description}</div>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        t.priority === 'Critical'
                          ? 'bg-danger'
                          : t.priority === 'High'
                          ? 'bg-warning text-dark'
                          : 'bg-info text-dark'
                      }`}
                    >
                      {t.priority}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        t.status === 'Open'
                          ? 'bg-danger'
                          : t.status === 'In Progress'
                          ? 'bg-warning text-dark'
                          : t.status === 'Resolved'
                          ? 'bg-success'
                          : 'bg-secondary'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="small text-muted text-nowrap">
                    {new Date(t.createdAt).toLocaleDateString()}
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => setSelectedTicket(t)}
                    >
                      <i className="bi bi-chat-dots me-1"></i> Discussion ({(t.replies || []).length})
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: CREATE TICKET */}
      {showCreateModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-primary text-white">
                <div>
                  <h5 className="modal-title fw-bold">Raise Support Ticket</h5>
                  <small className="opacity-75">Admin receives an email alert and will reply to your thread.</small>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCreateModal(false)}
                ></button>
              </div>

              <form onSubmit={handleCreateTicket}>
                <div className="modal-body p-4">
                  {/* Ticket Type */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Ticket Type *</label>
                    <select
                      className="form-select"
                      value={formData.ticketType}
                      onChange={(e) => setFormData({ ...formData, ticketType: e.target.value })}
                    >
                      <option value="problem_fix">Problem / Bug Fix within Website (Open to All)</option>
                      {isOfficerOrCoordinator ? (
                        <option value="feature_modification">
                          Feature / Modification Request (Placement & Coordinator)
                        </option>
                      ) : (
                        <option value="feature_modification" disabled>
                          Feature / Modification Request (Restricted to Officers & Coordinators)
                        </option>
                      )}
                    </select>
                    {!isOfficerOrCoordinator && (
                      <small className="text-muted d-block mt-1">
                        Note: Feature modification tickets are reserved for Department Coordinators and Placement Officers. Students and mentors can submit Problem/Fix tickets.
                      </small>
                    )}
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Category</label>
                      <select
                        className="form-select"
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      >
                        <option value="UI/UX">UI / Layout Issue</option>
                        <option value="Performance">Performance / Slow Loading</option>
                        <option value="Authentication">Login / Password Issue</option>
                        <option value="Analytics/Dashboard">Dashboard & Statistics</option>
                        <option value="Communication">Communication Hub / Messages</option>
                        <option value="Drive Management">Drive & Rounds Issue</option>
                        <option value="Profile/Data">Student Profile / Academic Record</option>
                        <option value="Other">Other Query</option>
                      </select>
                    </div>

                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select
                        className="form-select"
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                      >
                        <option value="Low">Low - General query</option>
                        <option value="Medium">Medium - Normal issue</option>
                        <option value="High">High - Impeding daily work</option>
                        <option value="Critical">Critical - Urgent blocker</option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Subject *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Concise summary of issue or request..."
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Detailed Description *</label>
                    <textarea
                      className="form-control"
                      rows="4"
                      placeholder="Please explain the details, steps to reproduce, or requested modification..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      required
                    ></textarea>
                  </div>
                </div>

                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-4"
                    disabled={submittingTicket}
                  >
                    {submittingTicket ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW TICKET & FOLLOW-UP CONVERSATION */}
      {selectedTicket && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0" style={{ maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header bg-dark text-white">
                <div>
                  <h5 className="modal-title fw-bold">Ticket: {selectedTicket.ticketNumber}</h5>
                  <span className="small opacity-75">{selectedTicket.subject}</span>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedTicket(null)}
                ></button>
              </div>

              <div className="modal-body p-4" style={{ overflowY: 'auto', flex: 1 }}>
                {/* Status bar */}
                <div className="bg-light p-3 rounded mb-3 border">
                  <div className="row g-2 small">
                    <div className="col-6 col-md-3">
                      <strong>Type:</strong>{' '}
                      <span className="badge bg-secondary">
                        {selectedTicket.ticketType === 'feature_modification' ? 'Feature / Mod' : 'Problem / Fix'}
                      </span>
                    </div>
                    <div className="col-6 col-md-3">
                      <strong>Category:</strong> {selectedTicket.category}
                    </div>
                    <div className="col-6 col-md-3">
                      <strong>Priority:</strong>{' '}
                      <span className="badge bg-warning text-dark">{selectedTicket.priority}</span>
                    </div>
                    <div className="col-6 col-md-3">
                      <strong>Status:</strong>{' '}
                      <span
                        className={`badge ${
                          selectedTicket.status === 'Open'
                            ? 'bg-danger'
                            : selectedTicket.status === 'In Progress'
                            ? 'bg-warning text-dark'
                            : selectedTicket.status === 'Resolved'
                            ? 'bg-success'
                            : 'bg-secondary'
                        }`}
                      >
                        {selectedTicket.status}
                      </span>
                    </div>
                  </div>
                  <hr className="my-2" />
                  <div>
                    <strong>Your Description:</strong>
                    <p className="mt-1 mb-0 text-secondary" style={{ whiteSpace: 'pre-wrap' }}>
                      {selectedTicket.description}
                    </p>
                  </div>
                  {selectedTicket.adminNotes && (
                    <div className="alert alert-info py-2 px-3 small mt-2 mb-0">
                      <strong>Admin Resolution Note:</strong> {selectedTicket.adminNotes}
                    </div>
                  )}
                </div>

                {/* Replies Thread */}
                <h6 className="fw-bold text-dark mb-2">Replies & Updates from Admin</h6>
                <div className="space-y-2 mb-3">
                  {(selectedTicket.replies || []).length === 0 ? (
                    <div className="p-3 text-center bg-light text-muted small rounded">
                      No replies recorded yet. Admin has been alerted and will respond shortly.
                    </div>
                  ) : (
                    selectedTicket.replies.map((rep, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded border mb-2 ${
                          rep.senderRole === 'admin'
                            ? 'bg-primary-subtle border-primary'
                            : 'bg-white border-secondary-subtle'
                        }`}
                      >
                        <div className="d-flex justify-content-between small fw-bold mb-1">
                          <span className={rep.senderRole === 'admin' ? 'text-primary' : 'text-dark'}>
                            {rep.senderName} ({rep.senderRole === 'admin' ? 'Administrator' : rep.senderRole})
                          </span>
                          <span className="text-muted">
                            {new Date(rep.sentAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="small text-secondary" style={{ whiteSpace: 'pre-wrap' }}>
                          {rep.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Follow up form */}
                <form onSubmit={handleSendReply}>
                  <label className="form-label small fw-semibold">
                    Post a Reply / Follow-up to Administration:
                  </label>
                  <textarea
                    className="form-control form-control-sm mb-2"
                    rows="3"
                    placeholder="Type additional details or response..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    required
                  ></textarea>
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedTicket(null)}
                    >
                      Close
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm px-3"
                      disabled={submittingReply}
                    >
                      {submittingReply ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
