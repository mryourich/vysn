'use client';

import Link from 'next/link';
import { useId } from 'react';

/** The VYSN "V" mark (vector copy of public/brand/vysn-logo-original.png). */
export function VysnMark({ height = 24, className }: { height?: number; className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="390 343 502 352" height={height} width={(height * 502) / 352} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}l`} x1="410" y1="346" x2="700" y2="692" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#007cfb" />
          <stop offset="1" stopColor="#0050c4" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="860" y1="346" x2="700" y2="640" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00dfd8" />
          <stop offset="0.55" stopColor="#12b9e6" />
          <stop offset="1" stopColor="#0784f8" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id}l)`} d="M393,346 L495,346 C525,346 545,368 557,395 L676,640 C686,662 702,685 731,692 L603,692 C578,692 556,678 545,652 Z" />
      <path fill={`url(#${id}r)`} d="M888,346 L750,616 C742,632 729,639 714,639 C703,639 694,633 689,624 L651,552 L720,412 C738,374 760,346 794,346 Z" />
    </svg>
  );
}

/** The thin "VYSN" wordmark, drawn in currentColor. */
export function VysnWordmark({ height = 14, className }: { height?: number; className?: string }) {
  return (
    <svg viewBox="322 746 616 116" height={height} width={(height * 616) / 116} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="11" strokeLinejoin="miter" strokeLinecap="butt">
        <polyline points="335,753 399.5,850 464.5,753" />
        <polyline points="501,753 562,808 623,753" />
        <line x1="562" y1="808" x2="562" y2="856" />
        <path d="M768,790 V770 Q768,758 756,758 H662 Q650,758 650,770 V793 Q650,805 662,805 H756 Q768,805 768,817 V840 Q768,852 756,852 H662 Q650,852 650,840 V822" />
        <polyline points="808,856 808,756 928,854 928,754" />
      </g>
    </svg>
  );
}

export function Brand({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="brand" aria-label="VYSN One – Startseite">
      <VysnMark height={compact ? 20 : 22} />
      <VysnWordmark height={compact ? 12 : 13} className="brand-word" />
      <em>One</em>
    </Link>
  );
}
