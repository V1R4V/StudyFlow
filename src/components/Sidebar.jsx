import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const IconDashboard = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="7" height="7" rx="1.5" />
    <rect x="11" y="2" width="7" height="7" rx="1.5" />
    <rect x="2" y="11" width="7" height="7" rx="1.5" />
    <rect x="11" y="11" width="7" height="7" rx="1.5" />
  </svg>
);

const IconSubjects = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" />
    <path d="M7 4v12" />
    <path d="M10 8h4" />
    <path d="M10 11h4" />
  </svg>
);

const IconSessions = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="10" r="7.5" />
    <path d="M10 6v4l2.5 2.5" />
  </svg>
);

const IconStatistics = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17V11" />
    <path d="M8 17V7" />
    <path d="M13 17V13" />
    <path d="M18 17V4" />
  </svg>
);

const IconPlanner = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="14" height="13" rx="2" />
    <path d="M3 8h14M7 2.5v3M13 2.5v3" />
    <path d="M7.5 11.5h2M12 11.5h.5M7.5 14h2M12 14h.5" />
  </svg>
);

const IconBrand = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
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

const IconSignOut = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconGrip = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <circle cx="3" cy="2.5" r="1" />
    <circle cx="9" cy="2.5" r="1" />
    <circle cx="3" cy="6" r="1" />
    <circle cx="9" cy="6" r="1" />
    <circle cx="3" cy="9.5" r="1" />
    <circle cx="9" cy="9.5" r="1" />
  </svg>
);

// Each item has a stable `key` used to look it up; the on-disk order is
// stored as an array of keys so adding new nav items doesn't break.
const NAV_ITEMS = {
  dashboard:  { key: 'dashboard',  to: '/',           label: 'Dashboard',  icon: <IconDashboard />,  end: true },
  command:    { key: 'command',    to: '/command',    label: 'Planner',    icon: <IconPlanner /> },
  subjects:   { key: 'subjects',   to: '/subjects',   label: 'Subjects',   icon: <IconSubjects /> },
  sessions:   { key: 'sessions',   to: '/sessions',   label: 'Sessions',   icon: <IconSessions /> },
  statistics: { key: 'statistics', to: '/statistics', label: 'Statistics', icon: <IconStatistics /> },
};
const DEFAULT_ORDER = ['dashboard', 'command', 'subjects', 'sessions', 'statistics'];
const NAV_ORDER_KEY = 'sf-nav-order';

function readNavOrder() {
  try {
    const saved = JSON.parse(localStorage.getItem(NAV_ORDER_KEY) || 'null');
    if (!Array.isArray(saved)) return DEFAULT_ORDER;
    // Keep only known keys, then append any new ones (for future-proofing).
    const known = saved.filter(k => NAV_ITEMS[k]);
    const missing = DEFAULT_ORDER.filter(k => !known.includes(k));
    return [...known, ...missing];
  } catch {
    return DEFAULT_ORDER;
  }
}

export default function Sidebar() {
  const { user, signOut } = useAuthContext();
  const { theme, toggleTheme } = useTheme();
  const [order, setOrder] = useState(readNavOrder);
  const [draggingKey, setDraggingKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);

  useEffect(() => {
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
  }, [order]);

  function handleDragStart(e, key) {
    setDraggingKey(key);
    // Required by Firefox to actually start the drag.
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  }

  function handleDragOver(e, key) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (key !== dragOverKey) setDragOverKey(key);
  }

  function handleDrop(e, dropKey) {
    e.preventDefault();
    const sourceKey = draggingKey || e.dataTransfer.getData('text/plain');
    if (!sourceKey || sourceKey === dropKey) {
      setDraggingKey(null);
      setDragOverKey(null);
      return;
    }
    setOrder(prev => {
      const next = prev.filter(k => k !== sourceKey);
      const insertAt = next.indexOf(dropKey);
      next.splice(insertAt, 0, sourceKey);
      return next;
    });
    setDraggingKey(null);
    setDragOverKey(null);
  }

  function handleDragEnd() {
    setDraggingKey(null);
    setDragOverKey(null);
  }

  return (
    <aside className="sf-sidebar">
      <Link to="/" className="sf-brand" aria-label="StudyFlow home">
        <div className="sf-brand-icon" aria-hidden="true">
          <IconBrand />
        </div>
        <div>
          <div className="sf-brand-name">StudyFlow</div>
          <div className="sf-brand-sub">Deep Work Engine</div>
        </div>
      </Link>

      <nav className="sf-nav" aria-label="Primary">
        {order.map(key => {
          const item = NAV_ITEMS[key];
          if (!item) return null;
          const isDragging = draggingKey === key;
          const isDragOver = dragOverKey === key && draggingKey !== key;
          return (
            <div
              key={key}
              draggable
              onDragStart={e => handleDragStart(e, key)}
              onDragOver={e => handleDragOver(e, key)}
              onDrop={e => handleDrop(e, key)}
              onDragEnd={handleDragEnd}
              className={`sf-navlink-wrap${isDragging ? ' sf-navlink-dragging' : ''}${isDragOver ? ' sf-navlink-dragover' : ''}`}
            >
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? 'sf-navlink sf-navlink-active' : 'sf-navlink'
                }
              >
                <span className="sf-navlink-grip" aria-hidden="true">
                  <IconGrip />
                </span>
                <span className="sf-navlink-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="sf-sidebar-footer">
        {user ? (
          <div className="sf-user-section">
            <div className="sf-user-avatar" aria-hidden="true">
              {(user.displayName || user.email || '?')[0].toUpperCase()}
            </div>
            <div className="sf-user-info">
              <div className="sf-user-email" title={user.email}>
                {user.displayName || user.email}
              </div>
            </div>
            <button
              onClick={toggleTheme}
              className="sf-icon-btn"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <button
              onClick={signOut}
              className="sf-icon-btn sf-icon-btn-danger"
              aria-label="Sign out"
              title="Sign out"
            >
              <IconSignOut />
            </button>
          </div>
        ) : (
          <div className="sf-footer-guest">
            <button
              onClick={toggleTheme}
              className="sf-icon-btn"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <IconSun /> : <IconMoon />}
            </button>
            <NavLink to="/login" className="sf-signin-btn">
              Sign In
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}
