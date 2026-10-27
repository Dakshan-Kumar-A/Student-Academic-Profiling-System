import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { authAPI } from '../services/api';
import ForcePasswordChangeModal from '../components/ForcePasswordChangeModal';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [tempAuthUser, setTempAuthUser] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      Swal.fire({
        icon: 'warning',
        title: 'Missing Fields',
        text: 'Please enter both your email address and password.',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await authAPI.login({ email, password });

      if (res.data.success) {
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));

        // If the user used a temporary password or must change password on first login
        if (user.mustChangePassword) {
          setTempAuthUser(user);
          setLoading(false);
          return;
        }

        // Direct user to their respective window based on their role in DB
        routeUserByRole(user.role);
      }
    } catch (err) {
      const status = err.response?.status;
      const errorType = err.response?.data?.errorType;
      const errorMsg = err.response?.data?.message || 'Authentication error';

      if (status === 404 || errorType === 'USER_NOT_FOUND') {
        // Requirement: "If not present , give an alert box showing user did not exist and clear the fields."
        await Swal.fire({
          icon: 'error',
          title: 'User did not exist',
          text: 'No account was found with this email address.',
          confirmButtonColor: '#1e3a8a',
        });
        setEmail('');
        setPassword('');
      } else if (status === 401 || errorType === 'INCORRECT_PASSWORD') {
        // Requirement: "If the password is wrong, give an alert box showing incorrect password and clear the password field"
        await Swal.fire({
          icon: 'error',
          title: 'Incorrect password',
          text: 'The password entered is incorrect. Please try again.',
          confirmButtonColor: '#1e3a8a',
        });
        setPassword('');
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Login Error',
          text: errorMsg,
          confirmButtonColor: '#1e3a8a',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const routeUserByRole = (role) => {
    switch (role) {
      case 'admin':
        navigate('/admin');
        break;
      case 'placement_officer':
        navigate('/placement');
        break;
      case 'department_coordinator':
        navigate('/coordinator');
        break;
      case 'mentor':
        navigate('/mentor');
        break;
      case 'student':
        navigate('/student');
        break;
      default:
        navigate('/');
    }
  };

  const handlePasswordChangeComplete = (updatedUser) => {
    setTempAuthUser(null);
    routeUserByRole(updatedUser.role);
  };

  return (
    <div className="min-vh-100 d-flex flex-column justify-content-center align-items-center px-3" style={{ background: 'var(--bg-gradient)' }}>
      <div className="text-center mb-4">
        <div className="d-inline-flex p-3 bg-white rounded-circle shadow-sm mb-2 text-primary">
          <i className="bi bi-mortarboard-fill fs-1"></i>
        </div>
        <h3 className="fw-bold text-slate-800 mb-1" style={{ color: '#0f172a' }}>
          Student Academic & Career Profiling System
        </h3>
        <p className="text-muted small">Sign in to access your role-based portal</p>
      </div>

      <div className="card auth-card shadow-lg p-4 p-md-5" style={{ width: '100%', maxWidth: '440px' }}>
        <h4 className="fw-bold mb-4 text-center" style={{ color: '#1e3a8a' }}>Portal Sign In</h4>

        <form onSubmit={handleLogin}>
          {/* Email input */}
          <div className="mb-3">
            <label className="form-label small fw-semibold text-secondary">Email Address</label>
            <div className="input-group">
              <span className="input-group-text bg-light text-muted"><i className="bi bi-envelope"></i></span>
              <input
                type="email"
                className="form-control"
                placeholder="name@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password input */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="form-label small fw-semibold text-secondary mb-0">Password</label>
              <Link
                to="/forgot-password"
                className="small text-decoration-none fw-semibold"
                style={{ color: '#0284c7' }}
              >
                Forgot Password?
              </Link>
            </div>
            <div className="input-group">
              <span className="input-group-text bg-light text-muted"><i className="bi bi-lock"></i></span>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary-custom w-100 py-2 mt-3 mb-2"
            disabled={loading}
          >
            {loading ? (
              <span><span className="spinner-border spinner-border-sm me-2" role="status"></span>Authenticating...</span>
            ) : (
              <span><i className="bi bi-box-arrow-in-right me-2"></i>Sign In</span>
            )}
          </button>
        </form>

        <div className="mt-4 pt-3 border-top text-center text-muted small">
          <div><i className="bi bi-shield-check text-success me-1"></i> Role-Based Access Control</div>
          <div className="text-secondary mt-1" style={{ fontSize: '0.78rem' }}>
            Supports Admin, Placement Officers, Department Coordinators & Students
          </div>
        </div>
      </div>

      {/* Force Password Change Modal if temporary password was used */}
      {tempAuthUser && (
        <ForcePasswordChangeModal
          user={tempAuthUser}
          onSuccess={handlePasswordChangeComplete}
        />
      )}
    </div>
  );
}
