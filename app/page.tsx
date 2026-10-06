import Link from 'next/link';
import {
  ArrowRight, BarChart3, Boxes, Building2, Check, CheckCircle2, FileText, Mail, Palette, Phone, ReceiptText, ShieldCheck, Smartphone, Sparkles, TrendingUp, Wallet,
} from 'lucide-react';
import { SiteHeader } from '../components/site/site-header';
import { SiteFooter } from '../components/site/site-footer';
import { Pricing } from '../components/site/pricing';
import { DesignShowcase } from '../components/site/design-showcase';
import { Motion } from '../components/site/motion';
import './site.css';

const FAQ = [
  ['Brauche ich Buchhaltungskenntnisse?', 'Nein. Sie schreiben Angebote und Rechnungen und erfassen Ihre Ausgaben. Die GuV, Umsatzsteuer und Auswertungen entstehen daraus automatisch.'],
  ['Sind die Rechnungen rechtlich korrekt?', 'Die Vorlagen enthalten die Pflichtangaben für Deutschland (§ 14 UStG), Österreich (§ 11 UStG) und die Schweiz (Art. 26 MWSTG): Anschriften, Steuer- bzw. UID-Nummer, fortlaufende Rechnungsnummer, Leistungsdatum, Netto, Steuersatz und Steuerbetrag. Für Kleinunternehmer wird automatisch der passende Hinweis gesetzt.'],
  ['Funktioniert VYSN One auch in Österreich und der Schweiz?', 'Ja. Mit dem Firmenland stellen sich Steuersätze (z. B. 20/13/10 % in Österreich, 8,1/3,8/2,6 % MWST in der Schweiz), Bezeichnungen, Rechnungshinweise und die Währung (EUR oder CHF) automatisch ein. Abweichende Steuersätze können Sie jederzeit frei eingeben.'],
  ['Kann ich mein eigenes Logo und Design verwenden?', 'Ja. Sie laden Ihr Logo hoch und wählen Layout, Akzentfarbe, Schrift und Tabellenstil. Die Vorschau zeigt jede Änderung sofort, der PDF-Export sieht exakt so aus.'],
  ['Funktioniert VYSN One auf dem Smartphone?', 'Ja. Die Anwendung ist für Smartphone, Tablet und Desktop gestaltet – zum Beispiel, um direkt auf der Baustelle eine Ausgabe zu erfassen oder eine Rechnung zu prüfen.'],
  ['Wo werden meine Daten gespeichert?', process.env.NEXT_PUBLIC_SUPABASE_URL
    ? 'In einer gesicherten Datenbank, auf die nur Sie und Ihr Team Zugriff haben. So sind Ihre Daten auf allen Geräten verfügbar. Über „Datensicherung“ laden Sie zusätzlich jederzeit eine vollständige Sicherung herunter.'
    : 'In der aktuellen Version bleiben alle Daten lokal in Ihrem Browser auf Ihrem Gerät. Über „Datensicherung“ laden Sie jederzeit eine vollständige Sicherung herunter und können sie auf einem anderen Gerät einspielen.'],
  ['Ersetzt VYSN One meine Steuerberatung?', 'Nein. VYSN One gibt Ihnen jederzeit einen klaren Überblick über Ihre Zahlen. Den Jahresabschluss und die Steuererklärung übernimmt weiterhin Ihre Steuerberatung – die Exporte erleichtern die Zusammenarbeit.'],
];

export default function Home() {
  return (
    <div className="site">
      <SiteHeader />
      <Motion />

      {/* ---------- Hero ---------- */}
      <section className="hero">
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-glow" aria-hidden="true" />
        <div className="shell hero-inner">
          <a href="#rechnungsdesign" className="hero-pill"><span>Neu</span> Rechnungsdesigner mit Live-Vorschau <ArrowRight size={14} /></a>
          <h1><span className="hero-line">Ihr Betrieb.</span><span className="hero-line gradient-text">Klar gesteuert.</span></h1>
          <p className="lead">Angebote, Rechnungen, Material und Zahlen in einer Software, die so präzise arbeitet wie Sie. Für kleine und mittlere Unternehmen, Handwerk und Dienstleister.</p>
          <div className="hero-actions">
            <Link href="/app" className="btn btn-glow btn-lg">Kostenlos starten <ArrowRight size={17} /></Link>
            <a href="#funktionen" className="btn btn-ghost-dark btn-lg">Funktionen entdecken</a>
          </div>
          <ul className="hero-points">
            <li><Check size={15} /> In 3 Minuten eingerichtet</li>
            <li><Check size={15} /> Keine Kreditkarte nötig</li>
            <li><Check size={15} /> Für Deutschland, Österreich & Schweiz</li>
          </ul>
        </div>
        <div className="shell hero-stage">
          <ProductMock />
        </div>
      </section>

      {/* ---------- Kennzahlen ---------- */}
      <section className="metrics">
        <div className="shell metrics-grid">
          {([[3, ' Min.', 'bis zur ersten Rechnung'], [1, ' Klick', 'vom Angebot zur Rechnung'], [3, ' Länder', 'DE · AT · CH mit passenden Steuersätzen'], [100, ' %', 'mobil nutzbar']] as const).map(([n, suffix, l], i) => (
            <div key={l} data-reveal style={{ ['--d' as string]: `${i * 90}ms` }}><strong data-count={n} data-suffix={suffix}>{`${n}${suffix}`}</strong><span>{l}</span></div>
          ))}
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((k) => (
            <div key={k} className="ticker-group">
              {['Angebote', 'Rechnungen', 'Rechnungsdesign', 'Material & Lager', 'Ausgaben', 'GuV', 'Umsatzsteuer & MWST', 'Mehrere Firmen', 'PDF-Export', 'Mobil'].map((t) => <span key={t}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Bento-Funktionen ---------- */}
      <section id="funktionen" className="section shell">
        <div className="section-head" data-reveal>
          <span className="kicker">Funktionen</span>
          <h2>Alles, was Ihr Büro braucht.<br /><span className="muted-head">Nichts, was Sie aufhält.</span></h2>
        </div>
        <div className="bento">
          <article className="tile tile-wide" data-reveal style={{ ['--d' as string]: '0ms' }}>
            <div className="tile-copy">
              <span className="tile-icon"><ReceiptText size={18} /></span>
              <h3>Angebote & Rechnungen</h3>
              <p>Positionen aus dem Materialstamm übernehmen, Angebot mit einem Klick in eine Rechnung umwandeln, Zahlungseingänge erfassen. Überfälliges sehen Sie sofort.</p>
            </div>
            <div className="tile-visual flow">
              <div className="flow-card"><FileText size={15} /><span>Angebot<br /><b>AN-2026-0017</b></span><em className="st st-ok">Angenommen</em></div>
              <div className="flow-line" />
              <div className="flow-card"><ReceiptText size={15} /><span>Rechnung<br /><b>RE-2026-0042</b></span><em className="st st-info">Offen</em></div>
              <div className="flow-line" />
              <div className="flow-card"><CheckCircle2 size={15} /><span>Zahlung<br /><b>3.418,35 €</b></span><em className="st st-ok">Bezahlt</em></div>
            </div>
          </article>
          <article className="tile" data-reveal style={{ ['--d' as string]: '90ms' }}>
            <span className="tile-icon"><Palette size={18} /></span>
            <h3>Eigenes Rechnungsdesign</h3>
            <p>Logo, Farbe, Schrift und Layout – als druckfertiges PDF.</p>
            <div className="swatch-row">{['#0069e6', '#0f766e', '#0b1220', '#9f1239', '#6d28d9'].map((c) => <i key={c} style={{ background: c }} />)}</div>
          </article>
          <article className="tile" data-reveal style={{ ['--d' as string]: '180ms' }}>
            <span className="tile-icon"><Boxes size={18} /></span>
            <h3>Material & Lager</h3>
            <p>EK, VK, Aufschlag und Bestand. Rechnungen buchen Material automatisch ab.</p>
            <div className="stock">
              <div><span>Gipskartonplatte</span><b>64 Platten</b></div><i><s style={{ width: '78%' }} /></i>
              <div><span>Mineralwolle</span><b className="warn">6 Rollen</b></div><i><s className="warn" style={{ width: '18%' }} /></i>
            </div>
          </article>
          <article className="tile" data-reveal style={{ ['--d' as string]: '0ms' }}>
            <span className="tile-icon"><Wallet size={18} /></span>
            <h3>Ausgaben</h3>
            <p>Belege nach Kategorie erfassen – brutto oder netto, die Steuer rechnet VYSN One.</p>
          </article>
          <article className="tile" data-reveal style={{ ['--d' as string]: '90ms' }}>
            <span className="tile-icon"><BarChart3 size={18} /></span>
            <h3>GuV & Umsatzsteuer</h3>
            <p>Jahr, Quartal oder Monat. Rohertrag, Marge und USt.-Zahllast auf einen Blick.</p>
            <div className="mini-bars">{[42, 55, 48, 66, 60, 78, 71, 88].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
          </article>
          <article className="tile tile-dark tile-full" data-reveal style={{ ['--d' as string]: '180ms' }}>
            <div className="tile-copy">
              <span className="tile-icon"><TrendingUp size={18} /></span>
              <h3>Ein Dashboard, das Entscheidungen leichter macht.</h3>
              <p>Umsatz, Ergebnis, offene Forderungen und laufende Angebote – dazu alles, was heute Aufmerksamkeit braucht. Auf dem Desktop genauso klar wie auf dem Smartphone.</p>
              <ul className="tile-list">
                <li><Check size={15} /> Kennzahlen für Jahr und Monat</li>
                <li><Check size={15} /> Überfällige Rechnungen & Mindestbestände</li>
                <li><Smartphone size={15} /> Voll mobil nutzbar</li>
              </ul>
            </div>
            <DashboardMock />
          </article>
        </div>
      </section>

      {/* ---------- Rechnungsdesign ---------- */}
      <section id="rechnungsdesign" className="section section-soft">
        <div className="shell">
          <div className="section-head" data-reveal>
            <span className="kicker">Rechnungsdesign</span>
            <h2>Dokumente, die nach Ihrem Unternehmen aussehen.</h2>
            <p>Probieren Sie es direkt hier aus. In VYSN One kommt Ihr eigenes Logo dazu – der Export ist ein echtes, druckfertiges PDF.</p>
          </div>
          <div data-reveal="scale"><DesignShowcase /></div>
        </div>
      </section>

      {/* ---------- Ablauf ---------- */}
      <section className="section shell">
        <div className="section-head" data-reveal>
          <span className="kicker">So funktioniert es</span>
          <h2>In drei Schritten startklar.</h2>
        </div>
        <ol className="timeline" data-reveal>
          <li><span className="node"><Building2 size={18} /></span><small>Schritt 01</small><h3>Firma anlegen</h3><p>Firmendaten, Steuernummer, Bankverbindung und Logo – einmal eingeben, überall verfügbar.</p></li>
          <li><span className="node"><FileText size={18} /></span><small>Schritt 02</small><h3>Angebot schreiben</h3><p>Kunde wählen, Positionen übernehmen, PDF senden. Angenommen? Ein Klick macht daraus die Rechnung.</p></li>
          <li><span className="node"><BarChart3 size={18} /></span><small>Schritt 03</small><h3>Zahlen im Blick</h3><p>Zahlungen und Ausgaben erfassen – GuV, Umsatzsteuer und Lager sind immer aktuell.</p></li>
        </ol>
      </section>

      {/* ---------- Preise ---------- */}
      <section id="preise" className="section section-soft">
        <div className="shell">
          <div className="section-head center" data-reveal>
            <span className="kicker">Preise</span>
            <h2>Transparent. Fair. Jederzeit kündbar.</h2>
            <p>Starten Sie kostenlos und wechseln Sie erst, wenn VYSN One Ihnen im Alltag Zeit spart.</p>
          </div>
          <div data-reveal><Pricing /></div>
          <p className="pricing-note"><ShieldCheck size={16} /> Alle Preise zzgl. gesetzlicher USt. Keine Einrichtungsgebühr, keine Mindestlaufzeit bei monatlicher Zahlung.</p>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="section shell faq-grid">
        <div className="section-head" data-reveal>
          <span className="kicker">Häufige Fragen</span>
          <h2>Gut zu wissen.</h2>
          <p>Ihre Frage ist nicht dabei? Schreiben Sie uns – wir antworten in der Regel am selben Werktag.</p>
        </div>
        <div className="faq" data-reveal>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section id="kontakt" className="shell cta-wrap">
        <div className="cta" data-reveal="scale">
          <div className="hero-grid-bg" aria-hidden="true" />
          <div className="cta-glow" aria-hidden="true" />
          <div className="cta-content">
            <Sparkles size={22} className="cta-spark" />
            <h2>Bereit für weniger Büro und mehr Überblick?</h2>
            <p>Konto anlegen, Unternehmen einrichten und direkt die erste Rechnung schreiben – im Tarif Start dauerhaft kostenlos.</p>
            <div className="hero-actions">
              <Link href="/app" className="btn btn-glow btn-lg">Jetzt kostenlos starten <ArrowRight size={17} /></Link>
            </div>
            <div className="cta-contact">
              <a href="mailto:hallo@vysn.de"><Mail size={15} /> hallo@vysn.de</a>
              <a href="tel:+498912345600"><Phone size={15} /> 089 123 456 00</a>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function ProductMock() {
  const rows: [string, string, string, string, string][] = [
    ['RE-2026-0042', 'Architekturbüro Weiß & Partner', '18.09.2026', 'Offen', '3.418,35 €'],
    ['RE-2026-0041', 'Café Morgenrot', '12.09.2026', 'Bezahlt', '1.922,41 €'],
    ['RE-2026-0040', 'Praxis Dr. Yilmaz', '04.09.2026', 'Überfällig', '1.190,00 €'],
    ['RE-2026-0039', 'Hausverwaltung Lindner KG', '28.08.2026', 'Bezahlt', '5.106,90 €'],
    ['RE-2026-0038', 'Familie Schneider', '21.08.2026', 'Bezahlt', '2.137,95 €'],
  ];
  return (
    <div className="stage" aria-hidden="true">
      <div className="app-mock">
        <div className="app-mock-side">
          <div className="mock-brand"><i /><b /></div>
          {['Dashboard', 'Angebote', 'Rechnungen', 'Kunden', 'Material & Lager', 'Ausgaben', 'GuV & Finanzen'].map((l) => (
            <span key={l} className={l === 'Rechnungen' ? 'on' : ''}>{l}</span>
          ))}
        </div>
        <div className="app-mock-main">
          <div className="app-mock-head"><div><small>Verkauf</small><strong>Rechnungen</strong></div><span className="mock-btn">+ Neue Rechnung</span></div>
          <div className="app-mock-stats">
            {[['Offen', '8.420 €', ''], ['Überfällig', '1.190 €', 'bad'], ['Bezahlt 2026', '96.310 €', ''], ['Gestellt 2026', '104.730 €', '']].map(([l, v, c]) => (
              <div key={l}><small>{l}</small><strong className={c}>{v}</strong></div>
            ))}
          </div>
          <div className="app-mock-table">
            {rows.map(([n, c, d, s, v]) => (
              <div key={n}>
                <span><b>{n}</b><small>{c}</small></span>
                <span className="hide-m">{d}</span>
                <em className={`st ${s === 'Bezahlt' ? 'st-ok' : s === 'Offen' ? 'st-info' : 'st-bad'}`}>{s}</em>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="float float-a"><CheckCircle2 size={18} /><span><small>Zahlung eingegangen</small><b>+ 1.922,41 €</b></span></div>
      <div className="float float-b"><span><small>Ergebnis 2026</small><b>41.870 €</b></span><div className="spark">{[30, 42, 38, 55, 49, 64, 70, 82].map((h, i) => <i key={i} style={{ height: `${h}%`, ['--i' as string]: i }} />)}</div></div>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="dash-mock" aria-hidden="true">
      <div className="dash-stats">
        {[['Umsatz 2026', '118.240 €', '+12,4 %'], ['Ergebnis 2026', '41.870 €', 'Marge 35,4 %'], ['Offene Forderungen', '8.420 €', '1 überfällig'], ['Offene Angebote', '14.300 €', '3 versendet']].map(([l, v, s]) => (
          <div key={l}><small>{l}</small><strong>{v}</strong><span>{s}</span></div>
        ))}
      </div>
      <div className="dash-chart">
        <div className="dash-legend"><span><i className="c1" /> Umsatz</span><span><i className="c2" /> Ausgaben</span></div>
        <div className="dash-bars">
          {[[62, 44], [70, 47], [55, 40], [80, 52], [74, 50], [88, 55], [66, 46], [92, 58], [84, 54]].map(([x, y], i) => (
            <div key={i}><i className="c1" style={{ height: `${x}%` }} /><i className="c2" style={{ height: `${y}%` }} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}
