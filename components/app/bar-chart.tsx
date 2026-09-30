'use client';

import { useState } from 'react';
import { money } from '../../lib/calc';

type Point = { label: string; revenue: number; expenses: number };

export const SERIES = [
  { key: 'revenue' as const, label: 'Umsatz (netto)', color: '#2860a8' },
  { key: 'expenses' as const, label: 'Ausgaben', color: '#b87a3d' },
];

function niceMax(v: number) {
  if (v <= 0) return 1000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

const short = (v: number) => (v >= 1000 ? `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(v / 1000)} T€` : `${Math.round(v)} €`);

/** Grouped monthly bar chart: revenue vs. expenses, with hover tooltip. */
export function RevenueChart({ data, height = 240 }: { data: Point[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720;
  const pad = { top: 12, right: 8, bottom: 26, left: 48 };
  const innerW = W - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((d) => Math.max(d.revenue, d.expenses))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const slot = innerW / data.length;
  const barW = Math.min(16, (slot - 10) / 2);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const bar = (x: number, v: number, color: string) => {
    const h = Math.max(0, (v / max) * innerH);
    if (h < 0.5) return null;
    const r = Math.min(4, h, barW / 2);
    const top = pad.top + innerH - h;
    // rounded data-end, square baseline
    const d = `M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + innerH} Z`;
    return <path d={d} fill={color} />;
  };

  const active = hover !== null ? data[hover] : null;

  return (
    <div className="chart">
      <div className="chart-legend">
        {SERIES.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
      <div className="chart-canvas">
        <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Umsatz und Ausgaben pro Monat" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="chart-axis">{short(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = pad.left + i * slot + (slot - (barW * 2 + 2)) / 2;
            return (
              <g key={d.label}>
                {hover === i ? <rect x={pad.left + i * slot + 2} y={pad.top} width={slot - 4} height={innerH} fill="var(--chart-hover)" rx={4} /> : null}
                {bar(x0, d.revenue, SERIES[0].color)}
                {bar(x0 + barW + 2, d.expenses, SERIES[1].color)}
                <text x={pad.left + i * slot + slot / 2} y={height - 8} textAnchor="middle" className="chart-axis">{d.label}</text>
                <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH + 20} fill="transparent"
                  onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {active && hover !== null ? (
          <div className="chart-tip" style={{ left: `${((pad.left + (hover + 0.5) * slot) / W) * 100}%` }}>
            <strong>{active.label}</strong>
            {SERIES.map((s) => (
              <span key={s.key}><i style={{ background: s.color }} />{s.label}<b>{money(active[s.key])}</b></span>
            ))}
            <span className="chart-tip-total">Ergebnis<b>{money(active.revenue - active.expenses)}</b></span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
