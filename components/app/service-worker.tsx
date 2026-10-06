'use client';

import { useEffect } from 'react';

/** Registriert den Service Worker (nur im fertigen Build) und meldet geladene Programmdateien zum Speichern. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const version = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
    const report = () => {
      const urls = performance.getEntriesByType('resource')
        .map((e) => { try { return new URL(e.name).pathname; } catch { return ''; } })
        .filter((p) => p.startsWith('/_next/static/'));
      navigator.serviceWorker.controller?.postMessage({ type: 'cache-urls', urls });
    };
    navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(version)}`).then(() => navigator.serviceWorker.ready).then(report).catch(() => {});
    const hidden = () => { if (document.visibilityState === 'hidden') report(); };
    document.addEventListener('visibilitychange', hidden);
    const timer = window.setInterval(report, 60_000);
    return () => { document.removeEventListener('visibilitychange', hidden); window.clearInterval(timer); };
  }, []);
  return null;
}
