import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StudyDataProvider>
          <TimerProvider>
            <BrowserRouter>
              <RouteAnalytics />
              <AuthGate>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="command" element={<CommandCenter />} />
                    <Route path="subjects" element={<SubjectManager />} />
                    <Route path="sessions" element={<Sessions />} />
                    <Route path="statistics" element={<Statistics />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </AuthGate>
            </BrowserRouter>
          </TimerProvider>
        </StudyDataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
