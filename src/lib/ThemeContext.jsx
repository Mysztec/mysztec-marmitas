import React, { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  {
    id: 'orange',
    label: 'Laranja',
    color: '#f97316',
    vars: {
      '--primary': '25 95% 53%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '25 90% 96%',
      '--accent-foreground': '25 95% 40%',
      '--ring': '25 95% 53%',
      '--sidebar-primary': '25 95% 53%',
      '--sidebar-accent': '25 90% 96%',
      '--sidebar-accent-foreground': '25 95% 40%',
      '--sidebar-ring': '25 95% 53%',
    },
  },
  {
    id: 'blue',
    label: 'Azul',
    color: '#3b82f6',
    vars: {
      '--primary': '217 91% 60%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '214 95% 96%',
      '--accent-foreground': '217 91% 40%',
      '--ring': '217 91% 60%',
      '--sidebar-primary': '217 91% 60%',
      '--sidebar-accent': '214 95% 96%',
      '--sidebar-accent-foreground': '217 91% 40%',
      '--sidebar-ring': '217 91% 60%',
    },
  },
  {
    id: 'green',
    label: 'Verde',
    color: '#22c55e',
    vars: {
      '--primary': '142 71% 45%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '142 70% 95%',
      '--accent-foreground': '142 71% 30%',
      '--ring': '142 71% 45%',
      '--sidebar-primary': '142 71% 45%',
      '--sidebar-accent': '142 70% 95%',
      '--sidebar-accent-foreground': '142 71% 30%',
      '--sidebar-ring': '142 71% 45%',
    },
  },
  {
    id: 'purple',
    label: 'Roxo',
    color: '#a855f7',
    vars: {
      '--primary': '270 91% 65%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '270 90% 96%',
      '--accent-foreground': '270 91% 40%',
      '--ring': '270 91% 65%',
      '--sidebar-primary': '270 91% 65%',
      '--sidebar-accent': '270 90% 96%',
      '--sidebar-accent-foreground': '270 91% 40%',
      '--sidebar-ring': '270 91% 65%',
    },
  },
  {
    id: 'rose',
    label: 'Rosa',
    color: '#f43f5e',
    vars: {
      '--primary': '347 89% 60%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '347 90% 96%',
      '--accent-foreground': '347 89% 40%',
      '--ring': '347 89% 60%',
      '--sidebar-primary': '347 89% 60%',
      '--sidebar-accent': '347 90% 96%',
      '--sidebar-accent-foreground': '347 89% 40%',
      '--sidebar-ring': '347 89% 60%',
    },
  },
  {
    id: 'slate',
    label: 'Cinza',
    color: '#64748b',
    vars: {
      '--primary': '215 25% 47%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '215 20% 95%',
      '--accent-foreground': '215 25% 30%',
      '--ring': '215 25% 47%',
      '--sidebar-primary': '215 25% 47%',
      '--sidebar-accent': '215 20% 95%',
      '--sidebar-accent-foreground': '215 25% 30%',
      '--sidebar-ring': '215 25% 47%',
    },
  },
];

const ThemeContext = createContext(null);

function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

function applyDarkMode(dark) {
  if (dark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return localStorage.getItem('app-theme') || 'orange';
  });

  // Sync dark mode with system preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    applyDarkMode(mq.matches);
    const handler = (e) => applyDarkMode(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    applyTheme(themeId);
    localStorage.setItem('app-theme', themeId);
  }, [themeId]);

  return (
    <ThemeContext.Provider value={{ themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}