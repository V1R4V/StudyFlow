import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { TimerProvider } from './context/TimerContext';
import { AuthProvider, useAuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { StudyDataProvider } from './context/StudyDataContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import SubjectManager from './pages/SubjectManager';
import Statistics from './pages/Statistics';
import NotFound from './pages/NotFound';
import Login from './pages/Login';

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
console.log("Firebase env check", {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StudyDataProvider>
          <TimerProvider>
            <BrowserRouter>
              <AuthGate>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
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
