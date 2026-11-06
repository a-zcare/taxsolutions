'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import type { Locale } from '@/lib/i18n';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const labels = {
  lv: { install: 'Instalēt lietotni', ios: 'iPhone vai iPad: atveriet Kopīgot un izvēlieties “Pievienot sākuma ekrānam”.', hide: 'Paslēpt' },
  en: { install: 'Install app', ios: 'On iPhone or iPad, tap Share, then choose “Add to Home Screen”.', hide: 'Hide' },
  ru: { install: 'Установить приложение', ios: 'На iPhone или iPad нажмите «Поделиться», затем «На экран Домой».', hide: 'Скрыть' },
} satisfies Record<Locale, { install: string; ios: string; hide: string }>;

export default function InstallApp({ locale }: { locale: Locale }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const standalone = matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    let hidden = false;
    try { hidden = localStorage.getItem('tax-pwa-install-dismissed') === '1'; } catch { /* storage can be disabled by browser policy */ }
    if (standalone || hidden) {
      setDismissed(!standalone);
      return;
    }
    const ua = navigator.userAgent;
    setIos(/iPad|iPhone|iPod/.test(ua) && !('MSStream' in window));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const hide = () => {
    try { localStorage.setItem('tax-pwa-install-dismissed', '1'); } catch { /* prompt dismissal is best effort */ }
    setDismissed(true);
    setPrompt(null);
  };
  if (dismissed || (!ios && !prompt)) return null;
  if (ios) return <details className="install-app"><summary><Download size={16} />{labels[locale].install}</summary><p>{labels[locale].ios}</p><button type="button" onClick={hide}>{labels[locale].hide}</button></details>;
  return <button className="install-app" type="button" onClick={async () => { if (!prompt) return; await prompt.prompt(); const choice = await prompt.userChoice; if (choice.outcome === 'dismissed') hide(); else setPrompt(null); }}><Download size={16} />{labels[locale].install}</button>;
}
