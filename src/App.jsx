import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { trackPageView } from './services/firebase';
import { TimerProvider } from './context/TimerContext';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { StudyDataProvider } from './context/StudyDataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CommandCenter from './pages/CommandCenter';
import Sessions from './pages/Sessions';
import SubjectManager from './pages/SubjectManager';
import Statistics from './pages/Statistics';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Landing from './pages/Landing';

// Logs a GA4 page_view on every client-side route change. GA4 only auto-logs
// the initial load, so SPA navigations would otherwise be invisible. Must live
// inside <BrowserRouter> to read the location.
function RouteAnalytics() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}

function AuthGate({ children }) {
  const { loading } = useAuthContext();
  if (loading) {
    return (
      <div
        className="d-flex align-items-center justify-content-center"
        style={{ height: '100vh' }}
      >
        <Spinner animation="border" role="status" style={{ color: 'var(--primary)' }}>
          <span className="visually-hidden">Loading…</span>
        </Spinner>
      </div>
    );
  }
  return children;
}

// Routing. The marketing landing page lives at "/" for logged-out visitors.
// The app itself lives under "/app/*" so guests (unauthenticated users) and
// signed-in users share one consistent base path. Authenticated users hitting
// "/" are sent straight to their dashboard.
function AppRoutes() {
  const { user } = useAuthContext();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={user ? <Navigate to="/app" replace /> : <Landing />}
      />
      <Route path="/app" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="command" element={<CommandCenter />} />
        <Route path="subjects" element={<SubjectManager />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="statistics" element={<Statistics />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StudyDataProvider>
          <TimerProvider>
            <BrowserRouter>
              <RouteAnalytics />
              <AuthGate>
                <AppRoutes />
              </AuthGate>
            </BrowserRouter>
          </TimerProvider>
        </StudyDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
