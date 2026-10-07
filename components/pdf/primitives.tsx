'use client';

/**
 * Minimal rendering layer so that one template can be rendered both as HTML
 * (live preview) and as a real vector PDF via @react-pdf/renderer.
 * Units are PDF points; the HTML preview renders them 1:1 as CSS pixels on an
 * A4 page of 595 × 842 and scales the page to fit.
 *
 * Note: do not set `lineHeight` on the page style – react-pdf then drops
 * absolutely positioned `fixed` elements such as the footer.
 */
import { createContext, useContext } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type Style = Record<string, string | number | undefined>;
export type PdfLib = typeof import('@react-pdf/renderer');

const LibContext = createContext<PdfLib | null>(null);
export const PdfLibProvider = LibContext.Provider;
const useLib = () => useContext(LibContext);

const FONT_STACK: Record<string, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Times-Roman': '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
};

function toCss(style: Style = {}, base: CSSProperties = {}): CSSProperties {
  const css: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined) continue;
    if (key === 'fontFamily') css.fontFamily = FONT_STACK[String(value)] || value;
    else if (key === 'paddingHorizontal' || key === 'marginHorizontal') {
      const k = key.replace('Horizontal', '');
      css[k + 'Left'] = value;
      css[k + 'Right'] = value;
    } else if (key === 'paddingVertical' || key === 'marginVertical') {
      const k = key.replace('Vertical', '');
      css[k + 'Top'] = value;
      css[k + 'Bottom'] = value;
    } else css[key] = value;
  }
  return css as CSSProperties;
}

/** Eingebettete PDF-Schriften (siehe export.tsx) statt nicht eingebetteter Standardschriften. */
const PDF_FONTS: Record<string, string> = { Helvetica: 'VysnSans', 'Times-Roman': 'VysnSerif', Courier: 'VysnMono' };
const pdfStyle = (s: Style): Style => (s.fontFamily && PDF_FONTS[String(s.fontFamily)] ? { ...s, fontFamily: PDF_FONTS[String(s.fontFamily)] } : s);

const flatten = (style?: Style | (Style | undefined | false)[]): Style =>
  Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style || {};

type BoxProps = { style?: Style | (Style | undefined | false)[]; children?: ReactNode; fixed?: boolean; wrap?: boolean };

const BOX_BASE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  borderStyle: 'solid',
  borderTopWidth: 0,
  borderRightWidth: 0,
  borderBottomWidth: 0,
  borderLeftWidth: 0,
  boxSizing: 'border-box',
  minWidth: 0,
};

export function V({ style, children, fixed, wrap }: BoxProps) {
  const lib = useLib();
  const s = flatten(style);
  if (lib) return <lib.View style={pdfStyle(s) as never} fixed={fixed} wrap={wrap}>{children}</lib.View>;
  return <div style={toCss(s, BOX_BASE)}>{children}</div>;
}

/**
 * Eingefügte Texte (z. B. aus Webseiten oder Word) enthalten oft Windows-Zeilenumbrüche (\r),
 * Tabs oder unsichtbare Zeichen. Im PDF würden sie als eigene Zeichen ohne passende Schrift
 * gesetzt und verschieben Zeilen – daher vorher vereinheitlichen.
 */
export const cleanText = (text: string) => text
  .replace(/\r\n?/g, '\n')
  .replace(/\t/g, ' ')
  .replace(/[\u200b-\u200d\u2060\ufeff\u00ad]/g, '')
  .replace(/[\u2028\u2029]/g, '\n');

const clean = (children: ReactNode): ReactNode =>
  typeof children === 'string' ? cleanText(children) : Array.isArray(children) ? children.map((c) => (typeof c === 'string' ? cleanText(c) : c)) : children;

export function T({ style, children: raw, wrap }: BoxProps) {
  const lib = useLib();
  const s = flatten(style);
  const children = clean(raw);
  if (lib) return <lib.Text style={pdfStyle(s) as never} wrap={wrap}>{children}</lib.Text>;
  return <div style={toCss(s, { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.2 })}>{children}</div>;
}

/** Page number, only meaningful in the PDF output. */
export function PageNumber({ style }: { style?: Style }) {
  const lib = useLib();
  if (!lib) return <div style={toCss(style)}>Seite 1</div>;
  return <lib.Text style={pdfStyle(style || {}) as never} render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} fixed />;
}

export function Img({ src, style }: { src: string; style?: Style }) {
  const lib = useLib();
  if (!src) return null;
  if (lib) return <lib.Image src={src} style={style as never} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" style={toCss(style, { objectFit: 'contain', objectPosition: 'left top' })} />;
}

export function PageFrame({ children, style, title }: { children: ReactNode; style?: Style; title?: string }) {
  const lib = useLib();
  if (lib) {
    return (
      <lib.Document title={title} creator="VYSN One" producer="VYSN One">
        <lib.Page size="A4" style={pdfStyle(style || {}) as never}>{children}</lib.Page>
      </lib.Document>
    );
  }
  return <div className="a4-page" style={toCss(style, { width: 595, minHeight: 842, position: 'relative', background: '#fff', boxSizing: 'border-box' })}>{children}</div>;
}
