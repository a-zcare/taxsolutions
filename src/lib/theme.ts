export type Theme = 'light' | 'dark';
export const THEME_STORAGE_KEY = 'taxsolutions-theme';
// Runs synchronously in <head>, before body content can paint. Only the
// explicit saved choice is used; the first visit always stays light.
export const themeInitializationScript = `(()=>{let theme='light';try{if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark')theme='dark'}catch{}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme})();`;
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
export function setTheme(theme: Theme) {
  applyTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private storage may be unavailable. */
  }
  window.dispatchEvent(new Event('taxsolutions-theme-change'));
}
export function subscribeTheme(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    applyTheme(event.newValue === 'dark' ? 'dark' : 'light');
    notify();
  };
  window.addEventListener('taxsolutions-theme-change', notify);
  window.addEventListener('storage', sync);
  return () => {
    window.removeEventListener('taxsolutions-theme-change', notify);
    window.removeEventListener('storage', sync);
  };
}
