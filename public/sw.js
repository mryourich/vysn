/* VYSN One – Service Worker für den Offline-Modus
 *
 * - Programmdateien (/_next/static, unveränderlich) bleiben auf dem Gerät (cache-first).
 * - Seiten des Arbeitsbereichs (/app/…): Netz zuerst, bei Funkloch der zuletzt geladene Stand.
 * - Daten (Supabase), API-Routen, Zahlungen: nie aus dem Cache – Offline-Daten verwaltet die App selbst.
 *
 * Version kommt aus der Registrierungs-URL (/sw.js?v=<build>); eine neue Version
 * lädt alles neu und räumt die alten Caches weg.
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const PAGES = `vysn-pages-${VERSION}`;
const STATIC = `vysn-static-${VERSION}`;
const APP_PAGES = [
  '/app', '/app/angebote', '/app/angebote/bearbeiten', '/app/rechnungen', '/app/rechnungen/bearbeiten', '/app/kunden',
  '/app/auftragsbestaetigungen', '/app/auftragsbestaetigungen/bearbeiten', '/app/lieferscheine', '/app/lieferscheine/bearbeiten',
  '/app/bestellungen', '/app/bestellungen/bearbeiten',
  '/app/material', '/app/scan', '/app/ausgaben', '/app/guv', '/app/export', '/app/firma', '/app/design',
  '/app/einstellungen', '/app/team', '/app/tarif',
];
const ASSETS = ['/manifest.webmanifest', '/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png'];
const NETWORK_TIMEOUT = 4000;

const rscKey = (path) => `${path}?__vysn_rsc=1`;
const staticUrls = (html) => [...new Set((html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []))];

async function precache() {
  const pages = await caches.open(PAGES);
  const assets = await caches.open(STATIC);
  const chunks = new Set();
  await Promise.all(APP_PAGES.map(async (path) => {
    try {
      const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) return;
      const html = await res.clone().text();
      staticUrls(html).forEach((u) => chunks.add(u));
      await pages.put(path, res);
      // Seitendaten für die Navigation innerhalb der App (React Server Components)
      const rsc = await fetch(path, { credentials: 'same-origin', cache: 'no-store', headers: { RSC: '1' } });
      if (rsc.ok) await pages.put(rscKey(path), rsc);
    } catch { /* einzelne Seite später */ }
  }));
  await Promise.all([...chunks, ...ASSETS].map((u) => assets.add(u).catch(() => {})));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([PAGES, STATIC]);
    for (const key of await caches.keys()) if (key.startsWith('vysn-') && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});

// Die App meldet bereits geladene Programmdateien (z. B. nachgeladene PDF-Bibliothek)
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'cache-urls' && Array.isArray(msg.urls)) {
    event.waitUntil(caches.open(STATIC).then((c) => Promise.all(
      msg.urls.filter((u) => typeof u === 'string' && u.startsWith('/_next/static/')).map((u) => c.match(u).then((hit) => hit || c.add(u).catch(() => {}))),
    )));
  }
});

const withTimeout = (promise, ms) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('timeout')), ms);
  promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
});

async function pageResponse(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES);
  try {
    const res = await withTimeout(fetch(request), NETWORK_TIMEOUT);
    if (res.ok && res.type === 'basic') cache.put(url.pathname, res.clone());
    return res;
  } catch {
    return (await cache.match(url.pathname)) || (await cache.match('/app')) || new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Offline</title><body style="font-family:system-ui;padding:32px;background:#070b16;color:#fff"><h1>Keine Verbindung</h1><p>VYSN One konnte diese Seite noch nicht auf dem Gerät speichern. Bitte einmal mit Internet öffnen.</p>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
}

// Seitendaten bei Navigation innerhalb der App: Netz zuerst, offline der gespeicherte Stand.
// Die Seiten sind statisch – ihre Daten hängen nicht vom Navigationszustand ab.
async function rscResponse(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGES);
  try {
    const res = await withTimeout(fetch(request), NETWORK_TIMEOUT);
    if (res.ok && !request.headers.get('Next-Router-Prefetch')) cache.put(rscKey(url.pathname), res.clone());
    return res;
  } catch {
    const hit = await cache.match(rscKey(url.pathname), { ignoreVary: true });
    if (hit) return hit;
    throw new Error('offline');
  }
}

async function staticResponse(request) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase, Stripe usw. nie anfassen
  if (url.pathname.startsWith('/_next/static/') || ASSETS.includes(url.pathname)) {
    event.respondWith(staticResponse(request));
    return;
  }
  const isApp = url.pathname === '/app' || url.pathname.startsWith('/app/');
  // Seitenaufruf der App bzw. Seitendaten bei Navigation innerhalb der App
  if (isApp && request.mode === 'navigate') event.respondWith(pageResponse(request));
  else if (isApp && request.headers.get('RSC') === '1') event.respondWith(rscResponse(request));
});
