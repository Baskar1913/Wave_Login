import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { api, setToken } from '../lib/api';
import type { AuthResponse, LoginAs } from '../types';

type Mode = 'login' | 'signup';

export function AuthModal({
  mode,
  onClose,
  onAuth,
}: {
  mode: Mode;
  onClose: () => void;
  onAuth: (a: AuthResponse) => void;
}) {
  const [view, setView] = useState(mode);
  const [loginAs, setLoginAs] = useState<LoginAs>('USER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirm_password: '',
  });

  const update = (
    key: keyof typeof form,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  // Fill the public demo Super Admin credentials
  const fillSuperAdminCredentials = () => {
    setForm((current) => ({
      ...current,
      username: 'superadmin@gmail.com',
      password: 'Superadmin@123',
    }));
    setError('');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    /*
     * SIGNUP VALIDATION
     */
    if (view === 'signup') {
      if (form.password.length < 8) {
        setError(
          'Password must contain at least 8 characters.',
        );
        return;
      }

      if (form.password !== form.confirm_password) {
        setError('Passwords do not match.');
        return;
      }

      if (!/^\d{10}$/.test(form.phone)) {
        setError(
          'Mobile number must contain exactly 10 digits.',
        );
        return;
      }
    }

    setBusy(true);

    try {
      /*
       * LOGIN
       *
       * Sends username/email, password and selected
       * login mode to the FastAPI backend.
       */
      const response =
        view === 'login'
          ? await api.login({
              username_or_email: form.username.trim(),
              password: form.password,
              login_as: loginAs,
            })
          : await api.signup({
              name: form.name.trim(),
              email: form.email.trim(),
              phone: form.phone.trim(),
              username: form.username.trim(),
              password: form.password,
              confirm_password:
                form.confirm_password,
            });

      /*
       * SUCCESSFUL AUTHENTICATION
       *
       * Store the JWT token using the existing Wave
       * token storage mechanism.
       */
      setToken(response.access_token);

      /*
       * Pass the complete authentication response
       * to the application.
       *
       * This contains the authenticated user's details
       * returned by the backend.
       */
      onAuth(response);
    } catch (err: any) {
      /*
       * LOGIN ERROR
       *
       * api.ts now converts a login 401 into:
       *
       * "Invalid username/email or password"
       *
       * Therefore that message appears directly
       * inside this login form.
       */
      setError(
        err?.message ||
          'Unable to complete the request.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) =>
        event.currentTarget === event.target &&
        onClose()
      }
    >
      <div className="auth-card">
        <section className="auth-side">
          <div className="auth-side-logo">
            <LogoGlyph />
          </div>

          <span className="auth-side-kicker">
            WAVE
          </span>

          <h2>
            Manage People.
            <br />
            <em>Build Possibilities.</em>
          </h2>

          <p>
            One simple workspace for users,
            administrators and business roles.
          </p>

          <div className="auth-side-features">
            <div>
              <span>
                <Icon name="users" size={19} />
              </span>

              <div>
                <strong>Organize Users</strong>
                <small>
                  Add and manage accounts.
                </small>
              </div>
            </div>

            <div>
              <span>
                <Icon name="role" size={19} />
              </span>

              <div>
                <strong>Control Access</strong>
                <small>
                  Assign business roles with ease.
                </small>
              </div>
            </div>

            <div>
              <span>
                <Icon name="shield" size={19} />
              </span>

              <div>
                <strong>Stay In Control</strong>
                <small>
                  Clear administration in one place.
                </small>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-main">
          <button
            className="auth-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <Icon name="x" size={20} />
          </button>

          <div className="auth-main-brand">
            <LogoGlyph />
            <b>WAVE</b>
          </div>

          <div className="auth-title">
            <span className="eyebrow">
              {view === 'login'
                ? 'SIGN IN'
                : 'CREATE ACCOUNT'}
            </span>

            <h1>
              {view === 'login'
                ? 'Welcome back'
                : 'Create your account'}
            </h1>

            <p>
              {view === 'login'
                ? 'Sign in to continue to your Wave workspace.'
                : 'Create a standard user account. A role can be assigned later by an Admin or Super Admin.'}
            </p>
          </div>

          {view === 'login' && (
            <div className="login-type">
              <button
                type="button"
                className={
                  loginAs === 'USER'
                    ? 'selected'
                    : ''
                }
                onClick={() => {
                  setLoginAs('USER');
                  setError('');
                }}
              >
                <Icon name="user" size={18} />
                User
              </button>

              <button
                type="button"
                className={
                  loginAs === 'ADMIN'
                    ? 'selected'
                    : ''
                }
                onClick={() => {
                  setLoginAs('ADMIN');
                  setError('');
                }}
              >
                <Icon name="users" size={18} />
                Admin
              </button>

              <button
                type="button"
                className={
                  loginAs === 'SUPER_ADMIN'
                    ? 'selected'
                    : ''
                }
                onClick={() => {
                  setLoginAs('SUPER_ADMIN');
                  setError('');
                }}
              >
                <Icon name="shield" size={18} />
                Super Admin
              </button>
            </div>
          )}

          {/* Super Admin demo credentials */}
          {view === 'login' &&
            loginAs === 'SUPER_ADMIN' && (
              <div className="super-admin-demo">
                <div className="super-admin-demo-title">
                  <Icon name="shield" size={18} />
                  <strong>
                    Super Admin Demo Access
                  </strong>
                </div>

                <div className="super-admin-demo-info">
                  <div>
                    <span>Email</span>
                    <strong>
                      superadmin@gmail.com
                    </strong>
                  </div>

                  <div>
                    <span>Password</span>
                    <strong>
                      Superadmin@123
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="super-admin-use"
                  onClick={fillSuperAdminCredentials}
                >
                  Use Demo Credentials
                </button>
              </div>
            )}

          <form
            className="auth-form"
            onSubmit={submit}
          >
            {view === 'signup' && (
              <>
                <Field
                  label="Full name"
                  value={form.name}
                  onChange={(v) =>
                    update('name', v)
                  }
                  placeholder="Enter your full name"
                  required
                />

                <div className="auth-two">
                  <Field
                    label="Email"
                    value={form.email}
                    onChange={(v) =>
                      update('email', v)
                    }
                    placeholder="name@example.com"
                    type="email"
                    required
                  />

                  <Field
                    label="Mobile"
                    value={form.phone}
                    onChange={(v) =>
                      update('phone', v)
                    }
                    placeholder="10-digit mobile"
                    required
                  />
                </div>
              </>
            )}

            <Field
              label={
                view === 'login'
                  ? 'Username or Email'
                  : 'Username'
              }
              value={form.username}
              onChange={(v) =>
                update('username', v)
              }
              placeholder={
                view === 'login'
                  ? 'Enter your username or email'
                  : 'Choose a username'
              }
              required
            />

            <label className="auth-field">
              Password

              <div className="password-box">
                <input
                  type={show ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) =>
                    update(
                      'password',
                      e.target.value,
                    )
                  }
                  placeholder="Enter your password"
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShow((v) => !v)
                  }
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            {view === 'signup' && (
              <Field
                label="Confirm password"
                value={form.confirm_password}
                onChange={(v) =>
                  update(
                    'confirm_password',
                    v,
                  )
                }
                placeholder="Repeat your password"
                type="password"
                required
              />
            )}

            {error && (
              <div className="form-error">
                <Icon name="x" size={16} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="auth-submit"
              disabled={busy}
              type="submit"
            >
              {busy
                ? 'Please wait…'
                : view === 'login'
                  ? 'Sign in'
                  : 'Create account'}

              <Icon name="arrow" size={18} />
            </button>
          </form>

          <div className="auth-footer">
            {view === 'login'
              ? 'New to Wave?'
              : 'Already have an account?'}

            {' '}

            <button
              type="button"
              onClick={() => {
                setView(
                  view === 'login'
                    ? 'signup'
                    : 'login',
                );
                setError('');
              }}
            >
              {view === 'login'
                ? 'Create account'
                : 'Sign in'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="auth-field">
      {label}

      <input
        type={type}
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function LogoGlyph() {
  return (
    <span className="auth-glyph">
      <i />
      <i />
      <i />
    </span>
  );
}