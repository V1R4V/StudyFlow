import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import EndSessionModal from './EndSessionModal';
import { useTimer } from '../context/TimerContext';

export default function Layout() {
  const { pendingSession, saveSession, discardSession } = useTimer();

  return (
    <div className="sf-app">
      <Sidebar />
      <main id="main-content" className="sf-main" tabIndex={-1}>
        <Outlet />
      </main>
      {pendingSession && (
        <EndSessionModal
          show={true}
          minutes={pendingSession.minutes}
          seconds={pendingSession.seconds}
          onSave={saveSession}
          onDiscard={discardSession}
        />
      )}
    </div>
  );
}
