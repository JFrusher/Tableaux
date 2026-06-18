import { useState, useEffect } from 'react'
import { supabase, isDev, devAuthBypass, devSignIn } from '../api/supabase.js'
import { useAuth } from './AuthProvider.jsx'
import Button from '../components/ui/Button.jsx'
import styles from './AuthGate.module.css'

/**
 * Gates the app behind sign-in when Supabase is configured. Supports
 * email + password (sign in / sign up) and a passwordless magic link.
 * In legacy (no-auth) mode it renders the app directly.
 */
export default function AuthGate({ children }) {
  const { session, loading, authEnabled } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'magic'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  // Optional dev-only auto-skip: sign into the dev account on load.
  useEffect(() => {
    if (devAuthBypass && authEnabled && !session && !loading) {
      devSignIn().catch((err) => setError(err.message || 'Dev sign-in failed'))
    }
  }, [authEnabled, session, loading])

  if (!authEnabled) return children
  if (loading) {
    return (
      <div className={styles.screen}>
        <p className={styles.loading}>Loading…</p>
      </div>
    )
  }

  // Signed in but email not yet confirmed: the server blocks all data access
  // (403) until verified, so hold the user on a verify screen rather than a
  // broken editor.
  if (session && !session.user?.email_confirmed_at) {
    const resend = async () => {
      setError(null)
      setNotice(null)
      setBusy(true)
      try {
        const { error: err } = await supabase.auth.resend({
          type: 'signup',
          email: session.user.email,
        })
        if (err) throw err
        setNotice('Verification email sent — check your inbox.')
      } catch (err) {
        setError(err.message || 'Could not resend the email.')
      } finally {
        setBusy(false)
      }
    }
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <h1 className={styles.brand}>Tableaux</h1>
          <p className={styles.subtitle}>Verify your email</p>
          <p className={styles.loading}>
            We sent a confirmation link to <strong>{session.user.email}</strong>. Click it, then
            return here to start planning.
          </p>
          {error && <p className={styles.error}>{error}</p>}
          {notice && <p className={styles.notice}>{notice}</p>}
          <Button variant="primary" disabled={busy} onClick={resend}>
            {busy ? 'Working…' : 'Resend verification email'}
          </Button>
          <div className={styles.switches}>
            <button
              type="button"
              className={styles.link}
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
          <AuthFooter />
        </div>
      </div>
    )
  }
  if (session) return children

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'magic') {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        })
        if (err) throw err
        setNotice('Check your email for a sign-in link.')
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        setNotice('Account created — check your email to verify before signing in.')
        setMode('signin')
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'signup' ? 'Create your account' : mode === 'magic' ? 'Magic link sign-in' : 'Welcome back'
  const cta = mode === 'signup' ? 'Sign up' : mode === 'magic' ? 'Email me a link' : 'Sign in'

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={submit}>
        <h1 className={styles.brand}>Tableaux</h1>
        <p className={styles.subtitle}>{title}</p>

        <label className={styles.field}>
          <span className={styles.label}>Email</span>
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {mode !== 'magic' && (
          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}

        {error && <p className={styles.error}>{error}</p>}
        {notice && <p className={styles.notice}>{notice}</p>}

        <Button variant="primary" disabled={busy}>
          {busy ? 'Working…' : cta}
        </Button>

        <div className={styles.switches}>
          {mode !== 'signin' && (
            <button type="button" className={styles.link} onClick={() => setMode('signin')}>
              Have an account? Sign in
            </button>
          )}
          {mode !== 'signup' && (
            <button type="button" className={styles.link} onClick={() => setMode('signup')}>
              Create an account
            </button>
          )}
          {mode !== 'magic' && (
            <button type="button" className={styles.link} onClick={() => setMode('magic')}>
              Use a magic link instead
            </button>
          )}
        </div>

        {isDev && (
          <button
            type="button"
            className={styles.devSkip}
            disabled={busy}
            onClick={() => {
              setError(null)
              setBusy(true)
              devSignIn()
                .catch((err) => setError(err.message || 'Dev sign-in failed'))
                .finally(() => setBusy(false))
            }}
          >
            ⚡ Skip sign-in (dev)
          </button>
        )}
        <AuthFooter />
      </form>
    </div>
  )
}

/** Legal links shown under the auth card. */
function AuthFooter() {
  return (
    <footer className={styles.footer}>
      <a href="/privacy-policy.html">Privacy</a>
      <span aria-hidden="true">·</span>
      <a href="/terms-of-service.html">Terms</a>
    </footer>
  )
}
