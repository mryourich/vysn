'use client';

import Link from 'next/link';
import { useId } from 'react';

/**
 * Das grüne VYSNER-„V“ (Vektor-Nachbau von public/brand/vysner-logo-original.png).
 * Die dunklen Verlaufstöne sind über CSS-Variablen (--vm-*) aufhellbar, damit das Zeichen
 * auch auf dunklen Flächen (Seitenleiste, Kopfleiste) vollständig sichtbar bleibt.
 */
export function VysnMark({ height = 24, className, animated }: { height?: number; className?: string; animated?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="305 190 930 520" height={height} width={(height * 930) / 520} className={[className, animated ? 'vm-animated' : ''].filter(Boolean).join(' ') || undefined} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="330" y1="200" x2="760" y2="560" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: 'var(--vm-a0, #021a0c)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--vm-a1, #075f30)' }} />
          <stop offset="1" style={{ stopColor: 'var(--vm-a2, #03200f)' }} />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="400" y1="360" x2="900" y2="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1fb43a" />
          <stop offset="0.28" stopColor="#a8f03a" />
          <stop offset="0.55" stopColor="#13a53a" />
          <stop offset="0.8" style={{ stopColor: 'var(--vm-b3, #052c14)' }} />
          <stop offset="1" stopColor="#5fe63a" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="790" y1="560" x2="1220" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0a6b3a" />
          <stop offset="0.6" stopColor="#3ed43a" />
          <stop offset="1" stopColor="#b6f53a" />
        </linearGradient>
        <linearGradient id={`${id}d`} x1="1180" y1="230" x2="880" y2="620" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2fc23a" />
          <stop offset="0.5" style={{ stopColor: 'var(--vm-d1, #0b6b30)' }} />
          <stop offset="1" style={{ stopColor: 'var(--vm-d2, #063d24)' }} />
        </linearGradient>
      </defs>
      <path className="vm-1" fill={`url(#${id}a)`} d="M315,197 H548 C585,197 612,214 630,244 L828,608 C846,644 872,690 910,703 C850,700 790,672 735,625 L378,315 Z" />
      <path className="vm-2" fill={`url(#${id}b)`} d="M378,315 L735,625 C790,672 850,700 910,703 H640 C603,703 574,686 557,656 Z" />
      <path className="vm-3" fill={`url(#${id}c)`} d="M975,197 H1225 C1150,238 1062,284 1022,345 L855,606 C836,588 800,520 765,453 L900,243 C921,212 946,197 975,197 Z" />
      <path className="vm-4" fill={`url(#${id}d)`} d="M1225,197 L958,592 C941,615 918,625 896,625 C878,625 863,617 855,606 L1022,345 C1062,284 1150,238 1225,197 Z" />
    </svg>
  );
}

/** Der Schriftzug „VYSNER“, in currentColor gezeichnet. */
export function VysnWordmark({ height = 14, className }: { height?: number; className?: string }) {
  return (
    <svg viewBox="322 744 942 118" height={height} width={(height * 942) / 118} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="25" strokeLinejoin="miter" strokeMiterlimit="1.6" strokeLinecap="butt">
        <polyline points="335,753 399.5,850 464.5,753" />
        <polyline points="501,753 562,808 623,753" />
        <line x1="562" y1="808" x2="562" y2="856" />
        <path d="M768,790 V772 Q768,758 754,758 H664 Q650,758 650,772 V791 Q650,805 664,805 H754 Q768,805 768,819 V838 Q768,852 754,852 H664 Q650,852 650,838 V822" />
        <polyline points="808,858 808,756 928,852 928,752" />
        <path d="M1087,758 H984 Q970,758 970,772 V838 Q970,852 984,852 H1087 M970,805 H1080" />
        <path d="M1125,860 V758 H1236 Q1250,758 1250,772 V791 Q1250,805 1236,805 H1125 M1182,805 L1256,856" />
      </g>
    </svg>
  );
}

export function Brand({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="brand" aria-label="VYSNER One – Startseite">
      <VysnMark height={compact ? 20 : 22} />
      <VysnWordmark height={compact ? 11 : 12} className="brand-word" />
      <em>One</em>
    </Link>
  );
}
