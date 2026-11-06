import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ApiError } from '../services/api';
import logoImg from '../assets/logo.png';
import './LoginPage.css';

const ROLE_ROUTES: Record<string, string> = {
  ADMIN: '/admin',
  DIRECTOR: '/approver',
  MEDICAL_SUPERINTENDENT: '/approver',
  HOD: '/approver',
  HR: '/approver',
  PURCHASE_OFFICER: '/approver',
  MAINTENANCE_OFFICER: '/approver',
  FINANCE_OFFICER: '/approver',
  EMPLOYEE: '/dashboard',
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await login(email, password);

      // Read user from localStorage since login just set it
      const storedUser = localStorage.getItem('mediflow_user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        const targetRoute = ROLE_ROUTES[user.role] || '/dashboard';
        navigate(targetRoute, { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.message || 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src={logoImg} alt="Jubilee Mission Medical College e-OFFICE Logo" className="login-logo-img" />
          </div>
          <h1>E-Office</h1>
          <p className="login-subtitle">Jubilee Mission Medical College &amp; Research Institute</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form" id="login-form" noValidate>
          {error && (
            <div className="login-error" role="alert" id="login-error">
              <svg viewBox="0 0 20 20" fill="currentColor" className="error-icon" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <svg viewBox="0 0 20 20" fill="currentColor" className="input-icon" aria-hidden="true">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mediflow.com"
                autoComplete="email"
                disabled={isSubmitting}
                aria-describedby={error ? 'login-error' : undefined}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <svg viewBox="0 0 20 20" fill="currentColor" className="input-icon" aria-hidden="true">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={isSubmitting}
                aria-describedby={error ? 'login-error' : undefined}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path
                      fillRule="evenodd"
                      d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                      clipRule="evenodd"
                    />
                    <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path
                      fillRule="evenodd"
                      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            id="login-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="button-spinner" aria-hidden="true" />
                <span>Signing in…</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="demo-accounts-panel">
          <div className="demo-accounts-title">Demo account access</div>
          <div className="demo-pills-grid" role="group" aria-label="Quick demo credentials">
            <button
              type="button"
              className="demo-pill-btn"
              onClick={() => { setEmail('dr.employee@mediflow.com'); setPassword('password123'); }}
              aria-label="Demo login as Staff Doctor, Requester in Cardiology"
            >
              <span className="demo-pill-name">Staff Doctor</span>
              <span className="demo-pill-role">Requester · Cardio</span>
            </button>
            <button
              type="button"
              className="demo-pill-btn"
              onClick={() => { setEmail('hod.cardio@mediflow.com'); setPassword('password123'); }}
              aria-label="Demo login as Dr. Cardio Head, HOD Approver"
            >
              <span className="demo-pill-name">Dr. Cardio Head</span>
              <span className="demo-pill-role">HOD Approver</span>
            </button>
            <button
              type="button"
              className="demo-pill-btn"
              onClick={() => { setEmail('finance@mediflow.com'); setPassword('password123'); }}
              aria-label="Demo login as Finance Officer, Finance Approver"
            >
              <span className="demo-pill-name">Finance Officer</span>
              <span className="demo-pill-role">Finance Approver</span>
            </button>
            <button
              type="button"
              className="demo-pill-btn"
              onClick={() => { setEmail('admin@mediflow.com'); setPassword('password123'); }}
              aria-label="Demo login as System Admin, Administrator"
            >
              <span className="demo-pill-name">System Admin</span>
              <span className="demo-pill-role">Administrator</span>
            </button>
          </div>
        </div>

        <div className="login-footer">
          <p>Jubilee Mission Medical College &middot; E-Office v1.0</p>
        </div>
      </div>
    </div>
  );
}
