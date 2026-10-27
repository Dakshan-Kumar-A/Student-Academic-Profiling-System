import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { authAPI } from '../services/api';

export default function ForcePasswordChangeModal({ user, onSuccess }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please enter and confirm your new permanent password.',
      });
      return;
    }

    if (newPassword.length < 6) {
      Swal.fire({
        icon: 'warning',
        title: 'Weak Password',
        text: 'Password must be at least 6 characters long.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Mismatch',
        text: 'New password and confirmation password do not match.',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.setFirstPassword({ newPassword });
      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));

        await Swal.fire({
          icon: 'success',
          title: 'Password Created!',
          text: 'Your permanent password has been set successfully. You can now access your dashboard.',
          timer: 2000,
          showConfirmButton: false,
        });

        onSuccess(res.data.user);
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: err.response?.data?.message || 'Failed to update permanent password.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)' }}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border-0 rounded-3">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">
              <i className="bi bi-shield-check me-2"></i> Set Permanent Password
            </h5>
          </div>
          <div className="modal-body p-4">
            <div className="alert alert-info py-2 small mb-3">
              <i className="bi bi-info-circle me-1"></i>
              You logged in with a <strong>single-use temporary password</strong>. For security reasons, please create your permanent personal password to proceed.
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">New Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock-fill"></i></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter new permanent password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                  </button>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold text-muted">Confirm New Password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="bi bi-lock"></i></span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="text-muted small mb-4">
                <i className="bi bi-shield-exclamation me-1"></i>
                Password must be at least 6 characters long.
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 py-2 fw-semibold"
                disabled={loading}
              >
                {loading ? (
                  <span><span className="spinner-border spinner-border-sm me-2"></span>Saving...</span>
                ) : (
                  <span><i className="bi bi-check2-circle me-1"></i> Set Password & Continue</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
