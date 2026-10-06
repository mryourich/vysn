'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';

/** Kamera-QR-Scanner (läuft vollständig im Browser, keine App-Installation nötig). */
export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [error, setError] = useState('');
  const stream = useRef<MediaStream | null>(null);
  const frame = useRef(0);
  const done = useRef(false);

  const stop = () => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  useEffect(() => stop, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error');
      setError('Die Kamera ist in diesem Browser nicht verfügbar. Scannen Sie das Etikett mit der Kamera-App des Handys oder geben Sie den Code unten ein.');
      return;
    }
    setState('starting');
    done.current = false;
    try {
      const jsQR = (await import('jsqr')).default;
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      const v = video.current!;
      v.srcObject = stream.current;
      v.setAttribute('playsinline', 'true');
      await v.play();
      setState('running');
      const ctx = canvas.current!.getContext('2d', { willReadFrequently: true })!;
      const tick = () => {
        if (done.current) return;
        if (v.readyState >= 2 && v.videoWidth) {
          const scale = Math.min(1, 640 / v.videoWidth);
          const w = Math.round(v.videoWidth * scale);
          const h = Math.round(v.videoHeight * scale);
          canvas.current!.width = w;
          canvas.current!.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            done.current = true;
            if ('vibrate' in navigator) navigator.vibrate(60);
            stop();
            setState('idle');
            onResult(code.data);
            return;
          }
        }
        frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
    } catch (e) {
      stop();
      setState('error');
      setError((e as Error).name === 'NotAllowedError'
        ? 'Der Kamerazugriff wurde abgelehnt. Erlauben Sie die Kamera in den Browser-Einstellungen.'
        : 'Die Kamera konnte nicht gestartet werden.');
    }
  };

  return (
    <div className="scanner">
      <div className={`scanner-view${state === 'running' ? ' running' : ''}`}>
        <video ref={video} muted playsInline />
        <canvas ref={canvas} hidden />
        {state === 'running' ? <span className="scanner-frame" aria-hidden="true"><i /></span> : (
          <button className="scanner-start" onClick={start} disabled={state === 'starting'}>
            <Camera size={28} />
            <strong>{state === 'starting' ? 'Kamera wird gestartet …' : 'Kamera starten'}</strong>
            <small>QR-Etikett eines Lagerplatzes oder Artikels scannen</small>
          </button>
        )}
      </div>
      {state === 'running' ? <button className="btn btn-quiet" onClick={() => { stop(); setState('idle'); }}><CameraOff size={16} /> Kamera stoppen</button> : null}
      {state === 'error' ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
