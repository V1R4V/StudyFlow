import { useState, useEffect } from 'react';

/**
 * useState backed by localStorage. Auto-syncs across the app when any code
 * dispatches a `studyflow:data-changed` event (the timer fires this after
 * saving a session).
 */
export function useLocalStorageState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  useEffect(() => {
    function refresh() {
      try {
        const saved = localStorage.getItem(key);
        setValue(saved !== null ? JSON.parse(saved) : defaultValue);
      } catch {
        // ignore parse errors
      }
    }
    window.addEventListener('studyflow:data-changed', refresh);
    return () => window.removeEventListener('studyflow:data-changed', refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [value, setValue];
}
