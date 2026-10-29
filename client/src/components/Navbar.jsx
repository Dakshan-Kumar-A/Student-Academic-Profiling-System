import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { authAPI, notificationAPI } from '../services/api';

export default function Navbar({ user, activeTab, setActiveTab }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(() => {
    return user || JSON.parse(localStorage.getItem('user') || '{}');
  });

  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Notification Service State
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  // Profile Edit State (Name and Email editable; Role and Department locked)
  const [profileName, setProfileName] = useState(currentUser.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await notificationAPI.getNotifications();
      if (res.data.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch {
      // Non-blocking notification check
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (notif) => {
    try {
      await notificationAPI.markAsRead(notif._id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setShowNotifications(false);
      if (typeof setActiveTab === 'function') {
        setActiveTab('communication');
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleLogout = () => {
    setShowDropdown(false);
    Swal.fire({
      title: 'Sign Out?',
      text: 'Are you sure you want to log out of your session?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1e3a8a',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Sign Out',
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
      }
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim() || !profileEmail.trim()) {
      Swal.fire('Required Fields', 'Name and email cannot be empty.', 'warning');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await authAPI.updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
      });
      if (res.data.success) {
        const updated = { ...currentUser, ...res.data.user };
        setCurrentUser(updated);
        localStorage.setItem('user', JSON.stringify(updated));
        setShowProfileModal(false);
        Swal.fire({
          icon: 'success',
          title: 'Profile Updated',
          text: 'Your personal profile details have been saved.',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Update Failed', err.response?.data?.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="badge badge-role-admin px-2 py-1"><i className="bi bi-shield-lock me-1"></i>Administrator</span>;
      case 'placement_officer':
        return <span className="badge badge-role-officer px-2 py-1"><i className="bi bi-briefcase me-1"></i>Placement Officer</span>;
      case 'department_coordinator':
        return <span className="badge badge-role-coordinator px-2 py-1"><i className="bi bi-person-workspace me-1"></i>Dept Coordinator</span>;
      case 'mentor':
        return <span className="badge bg-info text-dark px-2 py-1"><i className="bi bi-person-check me-1"></i>Faculty Mentor</span>;
      default:
        return <span className="badge badge-role-student px-2 py-1"><i className="bi bi-mortarboard me-1"></i>Student</span>;
    }
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark px-3 py-2 shadow-sm" style={{ backgroundColor: '#0f172a' }}>
        <div className="container-fluid">
          <span className="navbar-brand fw-bold d-flex align-items-center">
            <i className="bi bi-mortarboard-fill text-primary me-2 fs-4"></i>
            <span>Academic & Career Profiling</span>
          </span>

          {currentUser?.role === 'admin' && setActiveTab && (
            <div className="d-flex align-items-center me-auto ms-4">
              <button
                className={`btn btn-sm me-2 ${activeTab === 'staff' ? 'btn-primary' : 'btn-outline-light'}`}
                onClick={() => setActiveTab('staff')}
              >
                <i className="bi bi-people-fill me-1"></i> Staff Management
              </button>
              <button
                className={`btn btn-sm ${activeTab === 'logs' ? 'btn-danger' : 'btn-outline-light'}`}
                onClick={() => setActiveTab('logs')}
              >
                <i className="bi bi-journal-code me-1"></i> System Logs & Errors
              </button>
            </div>
          )}

          {/* Top Right Notification Center & Profile Avatar */}
          <div className="d-flex align-items-center ms-auto position-relative">
            {/* Notification Bell */}
            <div className="position-relative me-3">
              <button
                type="button"
                className="btn btn-link text-white position-relative p-1"
                style={{ textDecoration: 'none' }}
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowDropdown(false);
                }}
                title="Notifications"
              >
                <i className={`bi ${unreadCount > 0 ? 'bi-bell-fill text-warning' : 'bi-bell'} fs-5`}></i>
                {unreadCount > 0 && (
                  <span
                    className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger border border-light"
                    style={{ fontSize: '10px', padding: '3px 6px' }}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {showNotifications && (
                <div
                  className="dropdown-menu dropdown-menu-end show position-absolute shadow-lg border-0 rounded-3 p-0 mt-2 end-0 animate__animated animate__fadeIn"
                  style={{ top: '100%', width: '340px', maxWidth: '90vw', zIndex: 1060 }}
                >
                  <div className="p-3 bg-light border-bottom d-flex justify-content-between align-items-center rounded-top-3">
                    <div className="d-flex align-items-center gap-2">
                      <i className="bi bi-bell-fill text-primary"></i>
                      <span className="fw-bold small text-dark">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="badge bg-danger rounded-pill" style={{ fontSize: '10px' }}>
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-primary p-0 text-decoration-none small"
                        style={{ fontSize: '11px' }}
                        onClick={handleMarkAllAsRead}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="overflow-auto" style={{ maxHeight: '360px' }}>
                    {notifications.length === 0 ? (
                      <div className="text-center py-4 text-muted small">
                        <i className="bi bi-bell-slash fs-3 d-block text-secondary mb-1"></i>
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          className={`p-3 border-bottom d-flex align-items-start gap-2 cursor-pointer ${
                            notif.isRead ? 'bg-white text-muted' : 'bg-primary-subtle bg-opacity-25'
                          }`}
                          style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                          onClick={() => handleMarkAsRead(notif)}
                        >
                          <div className="mt-1">
                            {notif.type === 'message_reply' ? (
                              <span className="badge bg-info-subtle text-info rounded-circle p-2">
                                <i className="bi bi-reply-fill"></i>
                              </span>
                            ) : notif.type === 'circular' ? (
                              <span className="badge bg-warning-subtle text-warning rounded-circle p-2">
                                <i className="bi bi-megaphone-fill"></i>
                              </span>
                            ) : (
                              <span className="badge bg-primary-subtle text-primary rounded-circle p-2">
                                <i className="bi bi-chat-left-text-fill"></i>
                              </span>
                            )}
                          </div>
                          <div className="flex-grow-1" style={{ fontSize: '12px' }}>
                            <div className={`fw-bold ${notif.isRead ? 'text-dark' : 'text-primary'}`}>
                              {notif.title}
                            </div>
                            <div className="text-secondary mt-1 lh-sm">{notif.message}</div>
                            <small className="text-muted mt-1 d-block" style={{ fontSize: '10px' }}>
                              {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' • '}
                              {new Date(notif.createdAt).toLocaleDateString()}
                            </small>
                          </div>
                          {!notif.isRead && (
                            <span className="p-1 bg-primary rounded-circle mt-2" style={{ width: '8px', height: '8px' }}></span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-2 text-center bg-light border-top rounded-bottom-3">
                    <small className="text-muted" style={{ fontSize: '11px' }}>
                      Clicking any notification opens Communication Hub
                    </small>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar Trigger */}
            <div
              className="d-flex align-items-center text-white cursor-pointer px-2 py-1 rounded"
              onClick={() => {
                setShowDropdown(!showDropdown);
                setShowNotifications(false);
              }}
              style={{ cursor: 'pointer', transition: 'background-color 0.2s' }}
            >
              {/* Default Profile Avatar */}
              <div className="position-relative me-2">
                <div
                  className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center shadow-sm border border-light"
                  style={{ width: '38px', height: '38px', fontSize: '1rem', fontWeight: 'bold' }}
                >
                  {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <i className="bi bi-person-fill"></i>}
                </div>
                <span className="position-absolute bottom-0 end-0 p-1 bg-success border border-light rounded-circle" style={{ width: '10px', height: '10px' }}></span>
              </div>

              <div className="text-end d-none d-md-block me-2">
                <div className="fw-semibold small lh-sm">{currentUser.name || 'User'}</div>
                <div className="text-light opacity-75" style={{ fontSize: '0.72rem' }}>
                  {currentUser.department ? `${currentUser.department} • ` : ''}{currentUser.role?.replace('_', ' ')}
                </div>
              </div>
              <i className="bi bi-chevron-down small text-light opacity-75"></i>
            </div>

            {/* Profile Dropdown Menu */}
            {showDropdown && (
              <div
                className="dropdown-menu dropdown-menu-end show position-absolute shadow-lg border-0 rounded-3 p-2 mt-2 end-0"
                style={{ top: '100%', minWidth: '240px', zIndex: 1050 }}
              >
                <div className="p-2 border-bottom mb-1">
                  <div className="fw-bold text-dark">{currentUser.name}</div>
                  <div className="text-muted small text-truncate">{currentUser.email}</div>
                  <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                </div>

                <button
                  className="dropdown-item py-2 rounded d-flex align-items-center small"
                  onClick={() => {
                    setShowDropdown(false);
                    setProfileName(currentUser.name || '');
                    setProfileEmail(currentUser.email || '');
                    setShowProfileModal(true);
                  }}
                >
                  <i className="bi bi-person-gear text-primary me-2 fs-6"></i>
                  <span>My Profile & Edit</span>
                </button>

                <div className="dropdown-divider my-1"></div>

                <button
                  className="dropdown-item py-2 rounded d-flex align-items-center text-danger small"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-2 fs-6"></i>
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Backdrop for closing dropdown */}
      {showDropdown && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ zIndex: 1040 }}
          onClick={() => setShowDropdown(false)}
        ></div>
      )}

      {/* UNIVERSAL PROFILE MODAL (View simple details & edit name/email) */}
      {showProfileModal && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0 rounded-3">
              <div className="modal-header bg-primary text-white py-3">
                <h5 className="modal-title fw-bold d-flex align-items-center">
                  <i className="bi bi-person-circle me-2"></i> User Profile
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setShowProfileModal(false)}
                ></button>
              </div>
              <form onSubmit={handleUpdateProfile}>
                <div className="modal-body p-4">
                  {/* Default Profile Avatar Preview */}
                  <div className="text-center mb-4">
                    <div
                      className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center shadow border border-3 border-white mb-2"
                      style={{ width: '70px', height: '70px', fontSize: '1.8rem', fontWeight: 'bold' }}
                    >
                      {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : <i className="bi bi-person-fill"></i>}
                    </div>
                    <h5 className="fw-bold mb-0 text-dark">{currentUser.name}</h5>
                    <div className="text-muted small">{currentUser.email}</div>
                    <div className="mt-1">{getRoleBadge(currentUser.role)}</div>
                  </div>

                  {/* Read-Only Locked Fields */}
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-muted">Role (System Locked)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light text-muted"
                        value={currentUser.role?.replace('_', ' ').toUpperCase()}
                        disabled
                        readOnly
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold text-muted">Department (Locked)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-light text-muted"
                        value={currentUser.department || 'Not Applicable'}
                        disabled
                        readOnly
                      />
                    </div>
                  </div>

                  {/* Editable Fields (Name and Email) */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Full Name *</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-white"><i className="bi bi-person"></i></span>
                      <input
                        type="text"
                        className="form-control"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email Address *</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-white"><i className="bi bi-envelope"></i></span>
                      <input
                        type="email"
                        className="form-control"
                        value={profileEmail}
                        onChange={(e) => setProfileEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="alert alert-secondary py-2 small mb-0">
                    <i className="bi bi-shield-lock me-1"></i>
                    Role and Department assignments can only be modified by the Administrator.
                  </div>
                </div>
                <div className="modal-footer bg-light py-2">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowProfileModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm fw-semibold"
                    disabled={savingProfile}
                  >
                    {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
