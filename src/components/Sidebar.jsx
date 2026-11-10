import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useReminders } from '../context/RemindersContext';
import { badgeCount } from '../utils/reminders';
import Icon from './Icon';

const IconBrand = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M12 1.5l2.6 8.4L23 12l-8.4 2.1L12 23l-2.1-8.9L1 12l8.9-2.1L12 1.5z" />
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
  dashboard:  { key: 'dashboard',  to: '/app',            label: 'Dashboard',      icon: <Icon name="dashboard" size={18} />,  end: true },
  command:    { key: 'command',    to: '/app/command',    label: 'Command Center', icon: <Icon name="command" size={18} /> },
  subjects:   { key: 'subjects',   to: '/app/subjects',   label: 'Subjects',       icon: <Icon name="book" size={18} /> },
  sessions:   { key: 'sessions',   to: '/app/sessions',   label: 'Sessions',       icon: <Icon name="clock" size={18} /> },
  statistics: { key: 'statistics', to: '/app/statistics', label: 'Statistics',     icon: <Icon name="statistics" size={18} /> },
  reminders:  { key: 'reminders',  to: '/app/reminders',  label: 'Reminders',      icon: <Icon name="bell" size={18} /> },
};
const DEFAULT_ORDER = ['dashboard', 'command', 'subjects', 'sessions', 'statistics', 'reminders'];
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
  const { reminders, now } = useReminders();
  const dueCount = badgeCount(reminders, now);
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }
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
      <Link to="/app" className="sf-brand" aria-label="StudyFlow home">
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
                {key === 'reminders' && dueCount > 0 && (
                  <span className="sf-nav-badge" aria-label={`${dueCount} due`}>{dueCount}</span>
                )}
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="sf-sidebar-footer">
        <NavLink to="/app/settings" className="sf-settings-link"><Icon name="settings" size={18} /> Settings</NavLink>
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
              {theme === 'dark' ? <Icon name="sun" size={18} /> : <Icon name="moon" size={18} />}
            </button>
            <button
              onClick={handleSignOut}
              className="sf-icon-btn sf-icon-btn-danger"
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="signOut" size={18} />
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
              {theme === 'dark' ? <Icon name="sun" size={18} /> : <Icon name="moon" size={18} />}
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
