import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { authAPI } from '../services/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Email',
        text: 'Please enter your registered email address.',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await authAPI.forgotPassword({ email });

      if (res.data.success) {
        let textMsg = 'A single-use temporary password (valid for 24 hours) has been sent to your email address.';
        if (res.data.demoTempPassword) {
          textMsg += `\n\n[Dev Preview Code]: ${res.data.demoTempPassword}`;
        }

        await Swal.fire({
          icon: 'success',
          title: 'Temporary Password Sent!',
          text: textMsg,
          confirmButtonColor: '#1e3a8a',
          confirmButtonText: 'Proceed to Reset Page',
        });

        // Redirect to Reset Password page with email prefilled
        navigate(`/reset-password?email=${encodeURIComponent(email)}`);
      }
    } catch (err) {
      const status = err.response?.status;
      const errorType = err.response?.data?.errorType;

      if (status === 404 || errorType === 'USER_NOT_FOUND') {
        // Requirement: "if user email does not exist give the same alert box"
        await Swal.fire({
          icon: 'error',
          title: 'User did not exist',
          text: 'No account was found with this email address.',
          confirmButtonColor: '#1e3a8a',
        });
        setEmail('');
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: err.response?.data?.message || 'Failed to process password reset request.',
          confirmButtonColor: '#1e3a8a',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center px-3" style={{ background: 'var(--bg-gradient)' }}>
      <div className="card auth-card shadow-lg p-4 p-md-5" style={{ width: '100%', maxWidth: '440px' }}>
        <div className="text-center mb-4">
          <div className="d-inline-flex p-3 bg-light rounded-circle shadow-sm mb-2 text-primary">
            <i className="bi bi-key-fill fs-2"></i>
          </div>
          <h4 className="fw-bold" style={{ color: '#1e3a8a' }}>Forgot Password</h4>
          <p className="text-muted small">
            Enter your email to receive a single-use 24-hour temporary password
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="form-label small fw-semibold text-secondary">Registered Email Address</label>
            <div className="input-group">
              <span className="input-group-text bg-light text-muted"><i className="bi bi-envelope"></i></span>
              <input
                type="email"
                className="form-control"
                placeholder="name@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary-custom w-100 py-2 mb-3"
            disabled={loading}
          >
            {loading ? (
              <span><span className="spinner-border spinner-border-sm me-2" role="status"></span>Dispatching Email...</span>
            ) : (
              <span><i className="bi bi-send me-2"></i>Send Temporary Password</span>
            )}
          </button>

          <div className="text-center">
            <Link to="/login" className="small text-decoration-none fw-semibold text-secondary">
              <i className="bi bi-arrow-left me-1"></i> Back to Login
            </Link>
          </div>
        </form>

        <div className="mt-4 pt-3 border-top text-muted small" style={{ fontSize: '0.8rem' }}>
          <i className="bi bi-clock-history me-1 text-primary"></i>
          Temporary passwords expire strictly in <strong>24 hours</strong> and can only be used once.
        </div>
      </div>
    </div>
  );
}
