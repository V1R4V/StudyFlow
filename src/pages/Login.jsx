import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, Tab, Tabs } from 'react-bootstrap';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { initializeUserProfile } from '../services/firebaseService';

const IconBrand = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M12 1.5l2.6 8.4L23 12l-8.4 2.1L12 23l-2.1-8.9L1 12l8.9-2.1L12 1.5z" />
  </svg>
);

const IconSun = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="4" />
    <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.22 4.22l1.42 1.42M14.36 14.36l1.42 1.42M4.22 15.78l1.42-1.42M14.36 5.64l1.42-1.42" />
  </svg>
);

const IconMoon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.5 11.5A7.5 7.5 0 0 1 8.5 2.5a7.5 7.5 0 1 0 9 9z" />
  </svg>
);

export default function Login() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function friendlyError(err) {
    if (err.code === 'auth/configuration-not-found') {
      return 'This sign-in method is not enabled in Firebase Console. Enable it under Authentication → Sign-in method.';
    }
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
      return 'Invalid email or password.';
    }
    if (err.code === 'auth/email-already-in-use') {
      return 'An account with this email already exists.';
    }
    if (err.code === 'auth/weak-password') {
      return 'Password must be at least 6 characters.';
    }
    if (err.code === 'auth/popup-closed-by-user') {
      return 'Sign-in window closed before completing.';
    }
    return err.message || 'Authentication failed. Please try again.';
  }

  async function handleGoogle() {
    setError('');
    setLoading(true);
    try {
      const user = await signInWithGoogle();
      await initializeUserProfile(user.uid, {
        displayName: user.displayName,
        email: user.email,
      });
      navigate('/');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let user;
      if (tab === 'signin') {
        user = await signInWithEmail(email, password);
      } else {
        user = await signUpWithEmail(email, password);
        await initializeUserProfile(user.uid, {
          displayName: user.displayName || '',
          email: user.email,
        });
      }
      navigate('/');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sf-login-bg">
      {/* Theme toggle, fixed top-right corner of viewport */}
      <button
        onClick={toggleTheme}
        className="sf-theme-toggle sf-theme-toggle-fixed"
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>

      <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Brand header */}
          <div className="text-center mb-4">
            <div className="sf-login-brand-icon mx-auto mb-3" aria-hidden="true">
              <IconBrand />
            </div>
            <h1 className="h3 fw-bold mb-1" style={{ letterSpacing: '-0.03em' }}>StudyFlow</h1>
            <p className="text-muted mb-0">Your personal deep work engine</p>
          </div>

          <Card className="shadow-sm">
            <Card.Body className="p-4">
              {error && (
                <Alert variant="danger" onClose={() => setError('')} dismissible>
                  {error}
                </Alert>
              )}

              {/* Google sign-in */}
              <Button
                variant="outline-secondary"
                className="w-100 d-flex align-items-center justify-content-center gap-2 mb-3"
                onClick={handleGoogle}
                disabled={loading}
              >
                {/* Google "G" SVG logo */}
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                </svg>
                Continue with Google
              </Button>

              <div className="sf-divider mb-3">
                <span>or</span>
              </div>

              {/* Email/password tabs */}
              <Tabs
                activeKey={tab}
                onSelect={k => { setTab(k); setError(''); }}
                className="mb-3 sf-login-tabs"
              >
                <Tab eventKey="signin" title="Sign In">
                  <Form onSubmit={handleEmailSubmit} noValidate>
                    <Form.Group className="mb-3" controlId="login-email">
                      <Form.Label>Email address</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </Form.Group>
                    <Form.Group className="mb-4" controlId="login-password">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                      />
                    </Form.Group>
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-100"
                      disabled={loading}
                    >
                      {loading ? 'Signing in…' : 'Sign In'}
                    </Button>
                  </Form>
                </Tab>

                <Tab eventKey="signup" title="Create Account">
                  <Form onSubmit={handleEmailSubmit} noValidate>
                    <Form.Group className="mb-3" controlId="signup-email">
                      <Form.Label>Email address</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </Form.Group>
                    <Form.Group className="mb-4" controlId="signup-password">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                      />
                    </Form.Group>
                    <Button
                      type="submit"
                      variant="primary"
                      className="w-100"
                      disabled={loading}
                    >
                      {loading ? 'Creating account…' : 'Create Account'}
                    </Button>
                  </Form>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>

          <div className="text-center mt-4">
            <button
              className="sf-guest-link"
              onClick={() => navigate('/')}
            >
              Continue as guest →
            </button>
          </div>
        </div>
      </Container>
    </div>
  );
}
