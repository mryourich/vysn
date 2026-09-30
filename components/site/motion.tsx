'use client';

import { useEffect } from 'react';

/**
 * Landing-page motion: scroll reveal ([data-reveal]), count-up ([data-count]),
 * pointer spotlight on .tile and the scroll-linked tilt of the product mock.
 * Content stays visible without JavaScript and with "reduce motion".
 */
export function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveal = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));

    const countUp = (el: HTMLElement) => {
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target) || reduced) return;
      const suffix = el.dataset.suffix || '';
      const start = performance.now();
      const duration = 1400;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = `${Math.round(target * eased)}${suffix}`;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (reduced || !('IntersectionObserver' in window)) {
      reveal.forEach((el) => el.classList.add('in'));
      return;
    }

    root.classList.add('js-motion');
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        el.classList.add('in');
        el.querySelectorAll<HTMLElement>('[data-count]').forEach(countUp);
        io.unobserve(el);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    reveal.forEach((el) => io.observe(el));

    // Lichtkegel, der dem Mauszeiger auf den Kacheln folgt
    const onPointer = (e: PointerEvent) => {
      const tile = (e.target as HTMLElement).closest<HTMLElement>('.tile, .plan');
      if (!tile) return;
      const r = tile.getBoundingClientRect();
      tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
      tile.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onPointer, { passive: true });

    // Produktansicht richtet sich beim Scrollen auf
    const mock = document.querySelector<HTMLElement>('.app-mock');
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!mock) return;
        const progress = Math.min(1, Math.max(0, window.scrollY / 420));
        mock.style.setProperty('--tilt', `${12 - progress * 12}deg`);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => {
      io.disconnect();
      document.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
      root.classList.remove('js-motion');
    };
  }, []);
  return null;
}
