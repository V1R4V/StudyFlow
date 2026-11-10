import { MantineProvider, createTheme } from '@mantine/core';
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const componentTheme = createTheme({
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  primaryColor: 'indigo',
  defaultRadius: 'md',
  respectReducedMotion: true,
  focusRing: 'auto',
});

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('studyflow-theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    // Bootstrap 5.3 dark mode
    root.setAttribute('data-bs-theme', theme);
    localStorage.setItem('studyflow-theme', theme);
  }, [theme]);


  function toggleTheme() {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <MantineProvider theme={componentTheme} forceColorScheme={theme}>{children}</MantineProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
