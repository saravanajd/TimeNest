import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

type AuthMode = 'signIn' | 'createAccount' | 'resetPassword';

function getAuthErrorMessage(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error) || !('message' in error)) {
    return error instanceof Error ? error.message : 'The request could not be completed.';
  }

  const { code, message } = error;
  if (typeof code !== 'string' || typeof message !== 'string') {
    return 'The request could not be completed.';
  }

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':
      return 'An account already exists for this email.';
    case 'auth/weak-password':
      return 'Choose a password with at least 6 characters.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a little and try again.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in the Firebase console.';
    default:
      return message;
  }
}

function SignIn() {
  const { createAccount, resetPassword, signIn } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSubmitting(true);

    try {
      if (mode === 'createAccount') {
        await createAccount(email.trim(), password);
      } else if (mode === 'resetPassword') {
        await resetPassword(email.trim());
        setNotice('If an account exists for that email, a password-reset link has been sent.');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (authError) {
      setError(getAuthErrorMessage(authError));
    } finally {
      setSubmitting(false);
    }
  }

  const isResetMode = mode === 'resetPassword';
  const title = isResetMode ? 'Reset your password' : mode === 'createAccount' ? 'Create your account' : 'Welcome back';

  return (
    <section className="auth-card" aria-labelledby="auth-title">
      <span className="page-placeholder__icon" aria-hidden="true">
        <i className="bi bi-person-lock" />
      </span>
      <h1 id="auth-title" className="h3 text-center">{title}</h1>
      <p className="text-secondary text-center mb-4">
        {isResetMode ? 'We’ll email you a secure password-reset link.' : 'Sign in to keep your projects and settings private.'}
      </p>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label" htmlFor="auth-email">Email address</label>
          <input
            autoComplete="email"
            className="form-control"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        {!isResetMode && (
          <div className="mb-3">
            <label className="form-label" htmlFor="auth-password">Password</label>
            <input
              autoComplete={mode === 'createAccount' ? 'new-password' : 'current-password'}
              className="form-control"
              id="auth-password"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </div>
        )}
        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
        {notice && <div className="alert alert-success py-2" role="status">{notice}</div>}
        <button className="btn btn-primary w-100" disabled={submitting} type="submit">
          {submitting ? 'Please wait...' : isResetMode ? 'Send reset link' : mode === 'createAccount' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <div className="auth-actions">
        {mode !== 'resetPassword' && (
          <button
            className="btn btn-link btn-sm"
            onClick={() => { setError(''); setNotice(''); setMode(mode === 'createAccount' ? 'signIn' : 'createAccount'); }}
            type="button"
          >
            {mode === 'createAccount' ? 'Already have an account? Sign in' : 'Create an account'}
          </button>
        )}
        {mode === 'signIn' && (
          <button className="btn btn-link btn-sm" onClick={() => { setError(''); setMode('resetPassword'); }} type="button">
            Forgot password?
          </button>
        )}
        {isResetMode && (
          <button className="btn btn-link btn-sm" onClick={() => { setError(''); setNotice(''); setMode('signIn'); }} type="button">
            Back to sign in
          </button>
        )}
      </div>
    </section>
  );
}

export default SignIn;
