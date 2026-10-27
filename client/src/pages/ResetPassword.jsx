import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { authAPI } from '../services/api';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [isTempValid, setIsTempValid] = useState(false);
  const [validating, setValidating] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const qEmail = searchParams.get('email');
    if (qEmail) {
      setEmail(qEmail);
    }
  }, [searchParams]);

  // Step 1: Validate temporary password
  const handleValidateTemp = async (e) => {
    if (e) e.preventDefault();

    if (!email || !tempPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Input',
        text: 'Please provide both your registered email and the temporary password received.',
      });
      return;
    }

    setValidating(true);
    try {
      const res = await authAPI.verifyTempPassword({ email, tempPassword });
      if (res.data.success) {
        setIsTempValid(true);
        Swal.fire({
          icon: 'success',
          title: 'Validated!',
          text: 'Temporary password is valid. Please enter your new permanent password below.',
          timer: 1800,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      setIsTempValid(false);
      Swal.fire({
        icon: 'error',
        title: 'Validation Failed',
        text: err.response?.data?.message || 'Invalid or expired temporary password.',
        confirmButtonColor: '#1e3a8a',
      });
    } finally {
      setValidating(false);
    }
  };

  // Step 2: Save new password & redirect
  const handleSavePassword = async (e) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Password',
        text: 'Please enter and confirm your new permanent password.',
      });
      return;
    }

    if (newPassword.length < 6) {
      Swal.fire({
        icon: 'warning',
        title: 'Password Too Short',
        text: 'New password must be at least 6 characters long.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: 'Passwords Do Not Match',
        text: 'The confirmation password does not match your new password.',
      });
      return;
    }

    setSaving(true);
    try {
      const res = await authAPI.resetPassword({
        email,
        tempPassword,
        newPassword,
      });

      if (res.data.success) {
        // Requirement: "after typin and the temporary passwors and its validation ask for new password and save that password and the redirect back to login page."
        await Swal.fire({
          icon: 'success',
          title: 'Password Reset Successful!',
          text: 'Your new password has been saved. Please log in with your updated credentials.',
          confirmButtonColor: '#1e3a8a',
        });

        navigate('/login');
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Reset Failed',
        text: err.response?.data?.message || 'Failed to update password.',
        confirmButtonColor: '#1e3a8a',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center px-3" style={{ background: 'var(--bg-gradient)' }}>
      <div className="card auth-card shadow-lg p-4 p-md-5" style={{ width: '100%', maxWidth: '460px' }}>
        <div className="text-center mb-4">
          <div className="d-inline-flex p-3 bg-light rounded-circle shadow-sm mb-2 text-primary">
            <i className="bi bi-shield-lock-fill fs-2"></i>
          </div>
          <h4 className="fw-bold" style={{ color: '#1e3a8a' }}>Reset Your Password</h4>
          <p className="text-muted small">
            Validate your single-use 24-hr temporary password to create a new one
          </p>
        </div>

        {/* Step 1: Verify Temp Password */}
        <div className="mb-3">
          <label className="form-label small fw-semibold text-secondary">Email Address</label>
          <input
            type="email"
            className="form-control"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isTempValid}
            required
          />
        </div>

        <div className="mb-4">
          <label className="form-label small fw-semibold text-secondary">Temporary Password</label>
          <div className="input-group">
            <span className="input-group-text bg-light text-muted"><i className="bi bi-key"></i></span>
            <input
              type="text"
              className="form-control font-monospace"
              placeholder="e.g. Tr9#mK2p"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              disabled={isTempValid}
              required
            />
            {!isTempValid && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleValidateTemp}
                disabled={validating || !tempPassword}
              >
                {validating ? <span className="spinner-border spinner-border-sm"></span> : 'Validate'}
              </button>
            )}
          </div>
          {isTempValid && (
            <div className="text-success small mt-1">
              <i className="bi bi-check-circle-fill me-1"></i> Temporary password validated successfully!
            </div>
          )}
        </div>

        {/* Step 2: Set New Password (Enabled after validation) */}
        {isTempValid ? (
          <form onSubmit={handleSavePassword} className="border-top pt-3">
            <div className="mb-3">
              <label className="form-label small fw-semibold text-secondary">New Permanent Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted"><i className="bi bi-lock-fill"></i></span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
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

            <div className="mb-4">
              <label className="form-label small fw-semibold text-secondary">Confirm New Password</label>
              <div className="input-group">
                <span className="input-group-text bg-light text-muted"><i className="bi bi-lock"></i></span>
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

            <button
              type="submit"
              className="btn btn-success w-100 py-2 mb-3 fw-semibold"
              disabled={saving}
            >
              {saving ? (
                <span><span className="spinner-border spinner-border-sm me-2"></span>Saving New Password...</span>
              ) : (
                <span><i className="bi bi-save2 me-1"></i> Save Password & Return to Login</span>
              )}
            </button>
          </form>
        ) : (
          <div className="alert alert-secondary py-2 small text-center text-muted">
            <i className="bi bi-info-circle me-1"></i>
            Please validate your temporary password to unlock password setup.
          </div>
        )}

        <div className="text-center mt-2">
          <Link to="/login" className="small text-decoration-none fw-semibold text-secondary">
            <i className="bi bi-arrow-left me-1"></i> Return to Login Page
          </Link>
        </div>
      </div>
    </div>
  );
}
