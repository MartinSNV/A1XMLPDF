
import React, { useState, useEffect } from 'react';

const ThemeSwitcher: React.FC = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');

  useEffect(() => {
    const root = window.document.documentElement;
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.toggle('dark', mediaQuery.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const getButtonClass = (buttonTheme: string) => {
    return `px-3 py-1 text-sm font-medium rounded-md transition-colors ${
      theme === buttonTheme
        ? 'bg-blue-600 text-white'
        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
    }`;
  };

  return (
    <div className="absolute top-4 right-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm p-1 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center space-x-1 z-10">
      <button onClick={() => setTheme('light')} className={getButtonClass('light')} aria-label="Svetlý režim">Svetlý</button>
      <button onClick={() => setTheme('dark')} className={getButtonClass('dark')} aria-label="Tmavý režim">Tmavý</button>
      <button onClick={() => setTheme('system')} className={getButtonClass('system')} aria-label="Systémový režim">Systém</button>
    </div>
  );
};

export default ThemeSwitcher;
