import Link from 'next/link';
import {
  ArrowRight, BarChart3, Boxes, Briefcase, Building2, Check, CheckCircle2, Download, FileSpreadsheet, FileText, HardHat, Lock, Mail, Palette, Phone, QrCode, ReceiptText,
  Repeat, ScanLine, Share2, ShieldCheck, Smartphone, Sparkles, Store, TrendingUp, Undo2, Users, Wallet, X,
} from 'lucide-react';
import { SiteHeader } from '../components/site/site-header';
import { SiteFooter } from '../components/site/site-footer';
import { Pricing } from '../components/site/pricing';
import { DesignShowcase } from '../components/site/design-showcase';
import { Motion } from '../components/site/motion';
import { VysnMark, VysnWordmark } from '../components/app/brand';
import { PLAN_OFFERS } from '../lib/plans';
import { CONTACT_EMAIL, CONTACT_PHONE, SITE_URL, telHref } from '../lib/site';
import './site.css';

const FAQ = [
  ['Brauche ich Buchhaltungskenntnisse?', 'Nein. Sie schreiben Angebote und Rechnungen und erfassen Ihre Ausgaben. Die GuV, Umsatzsteuer und Auswertungen entstehen daraus automatisch.'],
  ['Sind die Rechnungen rechtlich korrekt?', 'Die Vorlagen enthalten die Pflichtangaben für Deutschland (§ 14 UStG), Österreich (§ 11 UStG) und die Schweiz (Art. 26 MWSTG): Anschriften, Steuer- bzw. UID-Nummer, fortlaufende Rechnungsnummer, Leistungsdatum, Netto, Steuersatz und Steuerbetrag. Für Kleinunternehmer wird automatisch der passende Hinweis gesetzt.'],
  ['Funktioniert VYSNER One auch in Österreich und der Schweiz?', 'Ja. Mit dem Firmenland stellen sich Steuersätze (z. B. 20/13/10 % in Österreich, 8,1/3,8/2,6 % MWST in der Schweiz), Bezeichnungen, Rechnungshinweise und die Währung (EUR oder CHF) automatisch ein. Abweichende Steuersätze können Sie jederzeit frei eingeben.'],
  ['Kann ich mein eigenes Logo und Design verwenden?', 'Ja. Sie laden Ihr Logo hoch und wählen Layout, Akzentfarbe, Schrift und Tabellenstil. Die Vorschau zeigt jede Änderung sofort, der PDF-Export sieht exakt so aus.'],
  ['Kann ich monatliche Kosten anbieten und abrechnen?', 'Ja. Jede Position ist entweder einmalig oder monatlich – zum Beispiel Einrichtung einmalig und Wartung, Miete oder Betreuung monatlich. Angebote und Auftragsbestätigungen weisen beide Summen getrennt aus, Rechnungen berechnen monatliche Positionen für den Abrechnungszeitraum.'],
  ['Funktioniert VYSNER One auf dem Smartphone?', 'Ja. Die Anwendung läuft im Browser auf Smartphone, Tablet und Desktop. Dazu kommt eine eigene App für iPhone und Android: Belege unterwegs anlegen, als PDF per Mail oder WhatsApp senden, Kunden anrufen und das Lager per Kamera scannen.'],
  ['Wie lange bin ich gebunden?', 'Gar nicht. Den Tarif Start nutzen Sie dauerhaft kostenlos. Bezahlte Tarife sind bei monatlicher Zahlung monatlich kündbar, bei jährlicher Zahlung zum Ende des Jahres. Für Verbraucher gilt zusätzlich das 14-tägige Widerrufsrecht.'],
  ['Kann ich meine Daten mitnehmen?', 'Jederzeit. Über „Datensicherung“ laden Sie alle Daten vollständig herunter, alle Belege gibt es als PDF, und für die Steuerberatung steht ein DATEV-Export bereit.'],
  ['Wo werden meine Daten gespeichert?', process.env.NEXT_PUBLIC_SUPABASE_URL
    ? 'In einer gesicherten Datenbank, auf die nur Sie und Ihr Team Zugriff haben. So sind Ihre Daten auf allen Geräten verfügbar. Über „Datensicherung“ laden Sie zusätzlich jederzeit eine vollständige Sicherung herunter.'
    : 'In der aktuellen Version bleiben alle Daten lokal in Ihrem Browser auf Ihrem Gerät. Über „Datensicherung“ laden Sie jederzeit eine vollständige Sicherung herunter und können sie auf einem anderen Gerät einspielen.'],
  ['Ersetzt VYSNER One meine Steuerberatung?', 'Nein. VYSNER One gibt Ihnen jederzeit einen klaren Überblick über Ihre Zahlen. Den Jahresabschluss und die Steuererklärung übernimmt weiterhin Ihre Steuerberatung – die Exporte erleichtern die Zusammenarbeit.'],
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
          <div className="hero-logo" aria-label="VYSNER One">
            <VysnMark height={88} animated />
            <span className="hero-logo-word"><VysnWordmark height={20} /><em>One</em></span>
          </div>
          <a href="#laufende-kosten" className="hero-pill"><span>Neu</span> Monatliche Kosten in Angeboten & Rechnungen <ArrowRight size={14} /></a>
          <h1><span className="hero-line">Ihr Betrieb.</span><span className="hero-line gradient-text">Klar gesteuert.</span></h1>
          <p className="lead">Angebote, Rechnungen, Material und Zahlen in einer Software – im Browser und als App. Weniger Zeit im Büro, mehr Zeit für Ihre Kunden. Für kleine und mittlere Unternehmen, Handwerk und Dienstleister.</p>
          <div className="hero-actions">
            <Link href="/app" className="btn btn-glow btn-lg">Kostenlos starten <ArrowRight size={17} /></Link>
            <a href="#funktionen" className="btn btn-ghost-dark btn-lg">Funktionen entdecken</a>
          </div>
          <ul className="hero-points">
            <li><Check size={15} /> Tarif Start dauerhaft kostenlos</li>
            <li><Check size={15} /> Keine Kreditkarte nötig</li>
            <li><Check size={15} /> Monatlich kündbar</li>
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
              {['Angebote', 'Rechnungen', 'Monatliche Kosten', 'Auftragsbestätigungen', 'Lieferscheine', 'Rechnungsdesign', 'Material & Lager', 'Ausgaben', 'GuV', 'Umsatzsteuer & MWST', 'DATEV-Export', 'Mehrere Firmen', 'App für iPhone & Android'].map((t) => <span key={t}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Vorher / Nachher ---------- */}
      <section className="section shell">
        <div className="section-head" data-reveal>
          <span className="kicker">Warum VYSNER One</span>
          <h2>Schluss mit Word-Vorlagen,<br /><span className="muted-head">Excel-Listen und Zettelwirtschaft.</span></h2>
        </div>
        <div className="pain-grid">
          {PAINS.map(([before, after], i) => (
            <article key={before} className="pain" data-reveal style={{ ['--d' as string]: `${i * 90}ms` }}>
              <p className="pain-before"><X size={16} /> {before}</p>
              <p className="pain-after"><CheckCircle2 size={18} /> {after}</p>
            </article>
          ))}
        </div>
      </section>

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
            <div className="swatch-row">{['#13873e', '#0f766e', '#0b1220', '#9f1239', '#6d28d9'].map((c) => <i key={c} style={{ background: c }} />)}</div>
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
            <p>Belege nach Kategorie erfassen – brutto oder netto, die Steuer rechnet VYSNER One.</p>
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

      {/* ---------- Laufende Kosten ---------- */}
      <section id="laufende-kosten" className="section section-soft">
        <div className="shell split">
          <div data-reveal>
            <span className="kicker">Neu · Monatliche Kosten</span>
            <h2 className="split-title">Einmalig und monatlich – in einem Angebot.</h2>
            <p className="split-lead">Einrichtung, Montage oder Projekt einmalig, Wartung, Miete, Lizenz oder Betreuung monatlich: Jede Position bekommt ihre Abrechnungsart. Ihr Kunde sieht auf einen Blick, was einmalig anfällt und was jeden Monat dazukommt.</p>
            <ul className="check-list">
              <li><Check size={16} /> Getrennte Summen „einmalig“ und „pro Monat“ – netto, Steuer und brutto</li>
              <li><Check size={16} /> Kombinierbar mit optionalen Positionen und Alternativen</li>
              <li><Check size={16} /> Vom Angebot zur Rechnung mit einem Klick – die Abrechnungsart wird übernommen</li>
              <li><Check size={16} /> Im Web und in der App, im PDF sauber ausgewiesen</li>
            </ul>
          </div>
          <div data-reveal="scale"><RecurringMock /></div>
        </div>
      </section>

      {/* ---------- Für wen ---------- */}
      <section id="branchen" className="section shell">
        <div className="section-head" data-reveal>
          <span className="kicker">Für wen</span>
          <h2>Gemacht für Betriebe,<br /><span className="muted-head">nicht für Buchhalter.</span></h2>
        </div>
        <div className="audience">
          {AUDIENCE.map(({ icon: Icon, title, text, points }, i) => (
            <article key={title} className="tile" data-reveal style={{ ['--d' as string]: `${i * 90}ms` }}>
              <span className="tile-icon"><Icon size={18} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
              <ul className="check-list small">{points.map((x) => <li key={x}><Check size={15} /> {x}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- App ---------- */}
      <section id="app" className="section section-dark">
        <div className="shell split">
          <div data-reveal="scale" className="phone-wrap"><PhoneMock /></div>
          <div data-reveal>
            <span className="kicker">App für iPhone & Android</span>
            <h2 className="split-title">Ihr Büro in der Hosentasche.</h2>
            <p className="split-lead">Eine eigene, native App – kein Website-Umweg. Sie arbeitet mit denselben Daten wie die Web-Version, alles ist sofort auf allen Geräten aktuell.</p>
            <ul className="feature-list">
              <li><FileText size={18} /><span><b>Belege unterwegs</b> Angebot beim Kunden schreiben, Rechnung direkt nach dem Auftrag.</span></li>
              <li><Share2 size={18} /><span><b>PDF teilen</b> Per Mail, WhatsApp oder Drucker – mit einem Tipp.</span></li>
              <li><ScanLine size={18} /><span><b>Lager-Scanner</b> QR-Etiketten mit der Kamera scannen und buchen.</span></li>
              <li><Users size={18} /><span><b>Kunden griffbereit</b> Anrufen, E-Mail schreiben, Route öffnen.</span></li>
            </ul>
            <p className="store-note"><Smartphone size={15} /> Demnächst im App Store und bei Google Play. Bis dahin läuft VYSNER One im Browser jedes Smartphones.</p>
          </div>
        </div>
      </section>

      {/* ---------- Rechnungsdesign ---------- */}
      <section id="rechnungsdesign" className="section section-soft">
        <div className="shell">
          <div className="section-head" data-reveal>
            <span className="kicker">Rechnungsdesign</span>
            <h2>Dokumente, die nach Ihrem Unternehmen aussehen.</h2>
            <p>Probieren Sie es direkt hier aus. In VYSNER One kommt Ihr eigenes Logo dazu – der Export ist ein echtes, druckfertiges PDF.</p>
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

      {/* ---------- Vergleich ---------- */}
      <section className="section shell">
        <div className="section-head center" data-reveal>
          <span className="kicker">Vergleich</span>
          <h2>Mehr als eine Rechnungsvorlage.</h2>
        </div>
        <div className="compare" data-reveal>
          <div className="compare-row compare-head"><span /><span>Word & Excel</span><span className="compare-us">VYSNER One</span></div>
          {COMPARE.map(([label, before]) => (
            <div key={label} className="compare-row">
              <span>{label}</span>
              <span>{before ? <Check size={17} className="c-mid" /> : <X size={17} className="c-no" />}</span>
              <span className="compare-us"><CheckCircle2 size={18} className="c-yes" /></span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Preise ---------- */}
      <section id="preise" className="section section-soft">
        <div className="shell">
          <div className="section-head center" data-reveal>
            <span className="kicker">Preise</span>
            <h2>Transparent. Fair. Jederzeit kündbar.</h2>
            <p>Starten Sie kostenlos und wechseln Sie erst, wenn VYSNER One Ihnen im Alltag Zeit spart.</p>
          </div>
          <div data-reveal><Pricing /></div>
          <p className="pricing-note"><ShieldCheck size={16} /> Alle Preise zzgl. gesetzlicher USt. Keine Einrichtungsgebühr, keine Mindestlaufzeit bei monatlicher Zahlung.</p>
          <div className="promises" data-reveal>
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <div key={title}><Icon size={20} /><b>{title}</b><span>{text}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="section shell faq-grid">
        <div className="section-head" data-reveal>
          <span className="kicker">Häufige Fragen</span>
          <h2>Gut zu wissen.</h2>
          <p>Ihre Frage ist nicht dabei? Schreiben Sie uns an <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> – wir antworten in der Regel am selben Werktag.</p>
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
              <a href={`mailto:${CONTACT_EMAIL}`}><Mail size={15} /> {CONTACT_EMAIL}</a>
              {CONTACT_PHONE ? <a href={telHref(CONTACT_PHONE)}><Phone size={15} /> {CONTACT_PHONE}</a> : null}
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
    </div>
  );
}

const PAINS: [string, string][] = [
  ['Rechnungen in Word zusammenkopieren und Nummern von Hand hochzählen', 'Fortlaufende Nummern, Pflichtangaben und Steuer automatisch – als sauberes PDF'],
  ['Angebot abtippen, wenn der Kunde zusagt', 'Angebot → Auftragsbestätigung → Lieferschein → Rechnung mit einem Klick'],
  ['Offene Rechnungen in Excel suchen', 'Offene und überfällige Rechnungen auf der Startseite – Zahlung mit einem Klick erfassen'],
  ['Material zählen und nachbestellen, wenn es zu spät ist', 'Bestand bucht sich mit jeder Rechnung ab, Mindestbestände melden sich rechtzeitig'],
  ['Zum Jahresende Belege für die Steuerberatung zusammensuchen', 'Ausgaben laufend erfassen, GuV und Umsatzsteuer jederzeit, DATEV-Export per Klick'],
  ['Laufende Wartung oder Miete irgendwo im Angebotstext verstecken', 'Monatliche Kosten als eigene Positionen mit eigener Summe'],
];

const AUDIENCE = [
  { icon: HardHat, title: 'Handwerk & Bau', text: 'Material mit Einkaufs- und Verkaufspreis, Lager, Lieferscheine und Angebote mit Alternativen.', points: ['Optionale Positionen & Alternativen', 'Lager mit QR-Scanner', 'Belege direkt vor Ort per App'] },
  { icon: Briefcase, title: 'Dienstleister & Agenturen', text: 'Stunden, Pauschalen und laufende Betreuung – sauber getrennt in einmalig und monatlich.', points: ['Monatliche Kosten in Angeboten', 'Eigenes Design mit Logo', 'E-Mail-Versand mit PDF'] },
  { icon: Store, title: 'Handel & kleine Unternehmen', text: 'Artikelstamm, Bestellungen beim Lieferanten und ein klarer Blick auf Umsatz und Ergebnis.', points: ['Bestellungen an Lieferanten', 'Mehrere Firmen unter einem Login', 'GuV & Umsatzsteuer'] },
];

const COMPARE: [string, boolean][] = [
  ['Angebote & Rechnungen als PDF', true],
  ['Fortlaufende Nummern & Pflichtangaben automatisch', false],
  ['Angebot mit einem Klick zur Rechnung', false],
  ['Einmalige und monatliche Summen getrennt', false],
  ['Offene & überfällige Rechnungen im Blick', false],
  ['Material & Lager mit Abbuchung', false],
  ['GuV, Umsatzsteuer & DATEV-Export', false],
  ['App für iPhone & Android', false],
];

const PROMISES = [
  { icon: Sparkles, title: 'Kostenlos starten', text: 'Tarif Start ohne Zahlungsdaten – so lange Sie wollen.' },
  { icon: Undo2, title: 'Monatlich kündbar', text: 'Keine Mindestlaufzeit bei monatlicher Zahlung.' },
  { icon: Download, title: 'Ihre Daten gehören Ihnen', text: 'Vollständige Sicherung, PDFs und DATEV-Export jederzeit.' },
  { icon: Lock, title: 'Sicher gespeichert', text: 'Verschlüsselte Verbindung, Zugriff nur für Sie und Ihr Team.' },
];

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'VYSNER One',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android',
  url: SITE_URL,
  description: 'Angebote, Rechnungen mit einmaligen und monatlichen Kosten, Material und Lager, Ausgaben und GuV für kleine Unternehmen, Handwerk und Dienstleister.',
  offers: PLAN_OFFERS.map((p) => ({ '@type': 'Offer', name: p.name, price: p.monthly.toFixed(2), priceCurrency: 'EUR' })),
};

function RecurringMock() {
  const items: [string, string, string, boolean][] = [
    ['1', 'Einrichtung & Inbetriebnahme', '1.450,00 €', false],
    ['2', 'Schulung vor Ort, 4 Std.', '360,00 €', false],
    ['3', 'Wartung & Support', '89,00 €', true],
    ['4', 'Software-Lizenz, 5 Arbeitsplätze', '45,00 €', true],
  ];
  return (
    <div className="rec-mock" aria-hidden="true">
      <div className="rec-head"><span><small>Angebot</small><b>AN-2026-0024</b></span><em className="st st-info">Versendet</em></div>
      <div className="rec-items">
        {items.map(([n, d, v, m]) => (
          <div key={n}><span className="rec-pos">{n}</span><span>{m ? <i className="rec-tag"><Repeat size={10} /> monatlich</i> : null}{d}</span><b>{v}{m ? <small> /Monat</small> : null}</b></div>
        ))}
      </div>
      <div className="rec-sums">
        <div><small>Einmalig</small><span>Netto 1.810,00 €</span><strong>2.153,90 €</strong></div>
        <div className="rec-monthly"><small><Repeat size={12} /> Pro Monat</small><span>Netto 134,00 €</span><strong>159,46 €</strong></div>
      </div>
    </div>
  );
}

function PhoneMock() {
  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-notch" />
      <div className="phone-screen">
        <div className="phone-top"><small>Guten Morgen</small><b>Übersicht</b></div>
        <div className="phone-cards">
          <div><small>Offene Rechnungen</small><strong>8.420 €</strong><em className="st st-info">5 offen</em></div>
          <div><small>Umsatz Oktober</small><strong>12.680 €</strong><em className="st st-ok">+9 %</em></div>
        </div>
        <div className="phone-list">
          {[['RE-2026-0042', 'Weiß & Partner', '3.418,35 €'], ['AN-2026-0024', 'Café Morgenrot', '2.153,90 €'], ['LS-2026-0011', 'Familie Schneider', '12 Pos.']].map(([n, c, v]) => (
            <div key={n}><span><b>{n}</b><small>{c}</small></span><strong>{v}</strong></div>
          ))}
        </div>
        <div className="phone-actions"><span><FileSpreadsheet size={14} /> Neuer Beleg</span><span><QrCode size={14} /> Scanner</span></div>
        <div className="phone-tabs">{['Übersicht', 'Belege', 'Kunden', 'Material', 'Mehr'].map((t, i) => <i key={t} className={i === 0 ? 'on' : ''}>{t}</i>)}</div>
      </div>
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
          <div className="mock-brand"><VysnMark height={16} /><VysnWordmark height={8} /></div>
          {['Startseite', 'Angebote', 'Rechnungen', 'Kunden', 'Material & Lager', 'Buchführung', 'Berichte'].map((l) => (
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
