import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { lazy, Suspense } from 'react';
import ReminderAlerts from './ReminderAlerts';
import { useTimer } from '../context/TimerContext';

const EndSessionModal = lazy(() => import('./EndSessionModal'));

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
        <Suspense fallback={<div role="status" className="sf-review-loading">Opening session review…</div>}>
          <EndSessionModal
            show={true}
            minutes={pendingSession.minutes}
            seconds={pendingSession.seconds}
            initialStartedAt={pendingSession.startedAt}
            initialEndedAt={pendingSession.endedAt}
            requireTiming={true}
            initialDistractions={pendingSession.distractions}
            onSave={saveSession}
            onDiscard={discardSession}
          />
        </Suspense>
      )}
    </div>
  );
}
