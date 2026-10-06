'use client';

import { Img, PageFrame, T, V } from './primitives';

export type Label = { qr: string; code: string; title: string; subtitle: string };

/**
 * A4-Etikettenbogen 3 × 8 (70 × 37 mm, z. B. Avery Zweckform 3474 / Herma 4453).
 * Maße in pt: 1 mm = 2,835 pt.
 */
export function LabelSheet({ labels, company }: { labels: Label[]; company: string }) {
  const mm = 2.835;
  const w = 70 * mm;
  const h = 37 * mm;
  return (
    <PageFrame title="Lager-Etiketten" style={{ paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0, flexDirection: 'row', flexWrap: 'wrap', fontFamily: 'Helvetica' }}>
      {labels.map((l, i) => (
        <V key={i} wrap={false} style={{ width: w, height: h, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 6 }}>
          <Img src={l.qr} style={{ width: 84, height: 84 }} />
          <V style={{ flex: 1, paddingLeft: 7 }}>
            <T style={{ fontFamily: 'Helvetica', fontWeight: 'bold', fontSize: 15, color: '#0b1220' }}>{l.code}</T>
            <T style={{ fontSize: 8.5, color: '#1d232a', marginTop: 2 }}>{l.title}</T>
            {l.subtitle ? <T style={{ fontSize: 7, color: '#6a717a', marginTop: 2 }}>{l.subtitle}</T> : null}
            <T style={{ fontSize: 6, color: '#98a2b3', marginTop: 5 }}>{`${company} · Scannen zum Buchen`}</T>
          </V>
        </V>
      ))}
    </PageFrame>
  );
}
