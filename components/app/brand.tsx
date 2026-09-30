import Link from 'next/link';

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 20 20">
        <path d="M3.5 4.5 L10 16 L16.5 4.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
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
