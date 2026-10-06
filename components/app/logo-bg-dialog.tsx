'use client';

import { useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { removeBackground } from '../../lib/image';
import { Field, Modal } from './ui';

/** Vorher/Nachher-Ansicht zum Entfernen des Logo-Hintergrunds (Business & Team). */
export function LogoBackgroundDialog({ logo, onApply, onClose }: { logo: string; onApply: (dataUrl: string) => void; onClose: () => void }) {
  const [tolerance, setTolerance] = useState(40);
  const [holes, setHoles] = useState(false);
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      removeBackground(logo, tolerance, holes)
        .then((r) => !cancelled && setResult(r))
        .finally(() => !cancelled && setBusy(false));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [logo, tolerance, holes]);

  return (
    <Modal title="Logo-Hintergrund entfernen" onClose={onClose} wide
      footer={<><button className="btn btn-quiet" onClick={onClose}>Abbrechen</button><button className="btn btn-primary" disabled={!result || busy} onClick={() => { onApply(result); onClose(); }}><Wand2 size={16} /> Übernehmen</button></>}>
      <div className="bg-compare">
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="checker"><img src={logo} alt="Vorher" /></div>
          <figcaption>Vorher</figcaption>
        </figure>
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="checker">{result ? <img src={result} alt="Nachher" style={{ opacity: busy ? 0.5 : 1 }} /> : <span className="spinner" />}</div>
          <figcaption>Nachher (transparent)</figcaption>
        </figure>
      </div>
      <div className="form-grid">
        <Field label={`Toleranz (${tolerance})`} span={2} hint="Höher = mehr ähnliche Farbtöne werden entfernt">
          <input type="range" min={5} max={120} value={tolerance} onChange={(e) => setTolerance(Number(e.target.value))} />
        </Field>
        <label className="check"><input type="checkbox" checked={holes} onChange={(e) => setHoles(e.target.checked)} /><span>Auch eingeschlossene Flächen entfernen (z. B. Innenraum von „O“, „A“)</span></label>
      </div>
    </Modal>
  );
}
