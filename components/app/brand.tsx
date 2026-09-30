import Link from 'next/link';

export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand-mark">
      <rect width="32" height="32" rx="7" fill="currentColor" />
      <path d="M8.5 9.5 L16 23 L23.5 9.5" fill="none" stroke="var(--brand-contrast, #fff)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="VYSN One Startseite">
      <BrandMark />
      <span>VYSN<em>One</em></span>
    </Link>
  );
}
