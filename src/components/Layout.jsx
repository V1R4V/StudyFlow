import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import EndSessionModal from './EndSessionModal';
import ReminderAlerts from './ReminderAlerts';
import { useTimer } from '../context/TimerContext';

export default function Layout() {
  const { pendingSession, saveSession, discardSession } = useTimer();

  return (
    <div className="sf-app">
      <Sidebar />
      <main id="main-content" className="sf-main" tabIndex={-1}>
        <Outlet />
      </main>
      <ReminderAlerts />
      {pendingSession && (
        <EndSessionModal
          show={true}
          minutes={pendingSession.minutes}
          seconds={pendingSession.seconds}
          initialDistractions={pendingSession.distractions}
          onSave={saveSession}
          onDiscard={discardSession}
        />
      )}
    </div>
  );
}
