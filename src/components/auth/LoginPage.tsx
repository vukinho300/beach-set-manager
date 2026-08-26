import { useState, type FormEvent } from 'react';

export function LoginPage({
  error,
  submitting,
  onSignIn,
}: {
  error: string | null;
  submitting: boolean;
  onSignIn: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    try {
      await onSignIn(email, password);
    } finally {
      setPassword('');
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-heading">
        <header className="auth-card-header">
          <p className="eyebrow">Camp Petalon</p>
          <h1 id="login-heading">Beach Set Manager</h1>
          <p>Sign in with your assigned account to continue.</p>
        </header>

        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={submitting}
              required
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </label>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          {error ? <p className="auth-error" role="alert">{error}</p> : null}
        </form>
      </section>
    </main>
  );
}

export function AuthStatusPage({
  title,
  message,
  loading = false,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  loading?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="auth-shell">
      <section className="auth-card auth-status-card" aria-live="polite">
        {loading ? <span className="auth-spinner" aria-hidden="true" /> : null}
        <p className="eyebrow">Camp Petalon</p>
        <h1>{title}</h1>
        <p>{message}</p>
        {actionLabel && onAction ? (
          <button className="auth-submit auth-status-action" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </section>
    </main>
  );
}
