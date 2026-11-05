'use client';
import { useSyncExternalStore } from 'react';
import { Sun, Moon } from 'lucide-react';
import {
  currentTheme,
  setTheme,
  subscribeTheme,
  type Theme,
} from '@/lib/theme';
const serverTheme = (): Theme => 'light';
const labels = {
  lv: {
    dark: 'Tumšā tēma',
    light: 'Ieslēgt gaišo tēmu',
    night: 'Ieslēgt tumšo tēmu',
  },
  en: {
    dark: 'Dark theme',
    light: 'Switch to light theme',
    night: 'Switch to dark theme',
  },
  ru: {
    dark: 'Тёмная тема',
    light: 'Включить светлую тему',
    night: 'Включить тёмную тему',
  },
};
export default function ThemeToggle({ locale = 'lv' }: { locale?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, serverTheme);
  const text = labels[locale as keyof typeof labels] ?? labels.lv;
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={text.dark}
      aria-pressed={theme === 'dark'}
      title={theme === 'dark' ? text.light : text.night}
      onClick={() => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')}
    >
      <Sun className="theme-sun" size={18} aria-hidden="true" />
      <Moon className="theme-moon" size={18} aria-hidden="true" />
    </button>
  );
}
