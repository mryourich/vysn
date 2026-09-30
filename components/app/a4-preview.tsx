'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

/** Shows a 595pt-wide page scaled to the available width. */
export function A4Preview({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(842);

  useEffect(() => {
    const el = outer.current;
    const content = inner.current;
    if (!el || !content) return;
    const update = () => {
      setScale(el.clientWidth / 595);
      setHeight(content.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} className="a4-preview" style={{ height: height * scale }}>
      <div ref={inner} style={{ position: 'absolute', top: 0, left: 0, width: 595, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}
