'use client';

import { useEffect } from 'react';

export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    navigator.serviceWorker.register(`${basePath}/sw.js`, {
      scope: `${basePath || ''}/`,
      updateViaCache: 'none',
    }).catch(() => {
      // The website remains fully usable when installation is unavailable.
    });
  }, []);

  return null;
}
