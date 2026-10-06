import type { Ops } from './ops';
import { opsEmpty } from './ops';

/**
 * Warteschlange auf dem Gerät: noch nicht übertragene Änderungen je Nutzer und Firma.
 * Übersteht Neuladen und Schließen der App; wird beim nächsten Start zuerst gesendet.
 */
const PREFIX = 'vysn-outbox:';
const key = (userId: string, companyId: string) => `${PREFIX}${userId}:${companyId}`;

export function storeOutbox(userId: string | null, ops: Ops | null, companyId?: string | null) {
  const cid = ops?.companyId || companyId;
  if (!userId || !cid) return;
  try {
    if (!ops || opsEmpty(ops)) window.localStorage.removeItem(key(userId, cid));
    else window.localStorage.setItem(key(userId, cid), JSON.stringify(ops));
  } catch {
    /* Speicher voll oder gesperrt – Änderungen bleiben im Speicher der laufenden App */
  }
}

export function readOutbox(userId: string | null, companyId: string): Ops | null {
  if (!userId) return null;
  try {
    const raw = window.localStorage.getItem(key(userId, companyId));
    return raw ? (JSON.parse(raw) as Ops) : null;
  } catch {
    return null;
  }
}

/** Alle gespeicherten Warteschlangen eines Nutzers (alle Firmen). */
export function allOutboxes(userId: string | null): Ops[] {
  if (!userId) return [];
  const out: Ops[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(`${PREFIX}${userId}:`)) continue;
      const raw = window.localStorage.getItem(k);
      if (raw) out.push(JSON.parse(raw) as Ops);
    }
  } catch {
    /* ignorieren */
  }
  return out;
}
