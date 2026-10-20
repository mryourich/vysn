import Link from 'next/link';
import {
  ArrowRight, BarChart3, Boxes, Building2, Camera, Check, CheckCircle2, Clock, FileText, HardHat, Mail, MapPin, Package, Palette, ReceiptText, ShieldCheck, Smartphone, Sparkles, TrendingUp, TriangleAlert, Wallet,
} from 'lucide-react';
import { SiteHeader } from '../components/site/site-header';
import { SiteFooter } from '../components/site/site-footer';
import { Pricing } from '../components/site/pricing';
import { DesignShowcase } from '../components/site/design-showcase';
import { Motion } from '../components/site/motion';
import { VysnMark, VysnWordmark } from '../components/app/brand';
import './site.css';

const FAQ = [
  ['Ist VYSNER One für österreichische Betriebe gemacht?', 'Ja – Österreich zuerst. 20/13/10 % USt., UID-Nummer, Firmenbuch, Kleinunternehmerregelung nach § 6 Abs. 1 Z 27 UStG und die Rechnungsmerkmale nach § 11 UStG sind voreingestellt. Deutschland und die Schweiz funktionieren genauso – das Firmenland stellt Steuersätze, Hinweise und Währung um.'],
  ['Wie kommen Regiestunden und Material auf die Rechnung?', 'Auf der Baustelle tragen Sie oder Ihre Leute am Handy ein, wer wie lange was gemacht hat und welches Material verbaut wurde – dazu Fotos und Mängel. Im Büro klicken Sie auf „Rechnung erstellen“: Alle offenen Stunden und das Material landen als Positionen auf der Rechnung, das Lager wird beim Festschreiben abgebucht.'],
  ['Brauche ich Buchhaltungskenntnisse?', 'Nein. Sie schreiben Angebote und Rechnungen und erfassen Ihre Ausgaben. Die GuV, Umsatzsteuer und Auswertungen entstehen daraus automatisch.'],
  ['Sind die Rechnungen rechtlich korrekt?', 'Die Vorlagen enthalten die Pflichtangaben für Deutschland (§ 14 UStG), Österreich (§ 11 UStG) und die Schweiz (Art. 26 MWSTG): Anschriften, Steuer- bzw. UID-Nummer, fortlaufende Rechnungsnummer, Leistungsdatum, Netto, Steuersatz und Steuerbetrag. Für Kleinunternehmer wird automatisch der passende Hinweis gesetzt.'],
  ['Kann ich mein eigenes Logo und Design verwenden?', 'Ja. Sie laden Ihr Logo hoch und wählen Layout, Akzentfarbe, Schrift und Tabellenstil. Die Vorschau zeigt jede Änderung sofort, der PDF-Export sieht exakt so aus.'],
  ['Funktioniert VYSNER One auf dem Smartphone?', 'Ja – gerade dort. Regiestunden, Material, Baustellenfotos und Mängel erfassen Sie direkt vor Ort am Handy, Angebote und Rechnungen prüfen und versenden Sie unterwegs. Im Büro geht alles am großen Bildschirm weiter.'],
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
          <a href="#baustelle" className="hero-pill"><span>Neu</span> Baustellen: Regiestunden, Fotos & Mängel <ArrowRight size={14} /></a>
          <h1><span className="hero-line">Von der Baustelle</span><span className="hero-line gradient-text">direkt zur Rechnung.</span></h1>
          <p className="lead">Die Software für Elektriker und Handwerksbetriebe in Österreich. Regiestunden, Material und Fotos am Handy erfassen – im Büro mit einem Klick abrechnen. Mit Lager, Angeboten und österreichischen Steuersätzen.</p>
          <div className="hero-actions">
            <Link href="/app" className="btn btn-glow btn-lg">Kostenlos starten <ArrowRight size={17} /></Link>
            <a href="#funktionen" className="btn btn-ghost-dark btn-lg">Funktionen entdecken</a>
          </div>
          <ul className="hero-points">
            <li><Check size={15} /> Gemacht für Elektriker & Handwerk</li>
            <li><Check size={15} /> Österreich zuerst – USt., UID & Firmenbuch</li>
            <li><Check size={15} /> Start dauerhaft kostenlos</li>
          </ul>
        </div>
        <div className="shell hero-stage">
          <ProductMock />
        </div>
      </section>

      {/* ---------- Kennzahlen ---------- */}
      <section className="metrics">
        <div className="shell metrics-grid">
          {([[1, ' Klick', 'von der Baustelle zur Rechnung'], [20, ' %', 'USt. – österreichisch voreingestellt'], [3, ' Min.', 'bis zur ersten Rechnung'], [100, ' %', 'am Handy auf der Baustelle']] as const).map(([n, suffix, l], i) => (
            <div key={l} data-reveal style={{ ['--d' as string]: `${i * 90}ms` }}><strong data-count={n} data-suffix={suffix}>{`${n}${suffix}`}</strong><span>{l}</span></div>
          ))}
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[0, 1].map((k) => (
            <div key={k} className="ticker-group">
              {['Baustellen', 'Regiestunden', 'Baustellenfotos', 'Mängel', 'Angebote', 'Rechnungen', 'Material & Lager', 'Lieferscheine', 'Lager-Scanner', 'GuV & USt.'].map((t) => <span key={t}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      {/* ---------- Von der Baustelle zur Rechnung ---------- */}
      <section id="baustelle" className="section shell">
        <div className="section-head" data-reveal>
          <span className="kicker">Von der Baustelle zur Rechnung</span>
          <h2>Was auf der Baustelle passiert,<br /><span className="muted-head">steht am Abend auf der Rechnung.</span></h2>
          <p>Kein Zettel im Bus, keine Stunden aus dem Gedächtnis. Jede Baustelle sammelt Regiestunden, Material, Fotos und Mängel – und wird mit einem Klick zur Rechnung.</p>
        </div>
        <div className="site-steps">
          {([
            [Clock, 'Regiestunden', 'Wer, wie lange, was gemacht – direkt am Handy. Der Stundensatz der Baustelle ist schon eingetragen.'],
            [Package, 'Material', 'Aus dem eigenen Lager wählen oder frei eintragen. Abgebucht wird beim Festschreiben der Rechnung.'],
            [Camera, 'Fotos', 'Verteiler vor dem Verschließen, Leitungsführung, Vorher/Nachher – sauber bei der Baustelle abgelegt.'],
            [TriangleAlert, 'Mängel', 'Offene Punkte festhalten und abhaken, wenn sie behoben sind. Nichts geht mehr verloren.'],
            [ReceiptText, 'Rechnung', 'Alle offenen Stunden und das Material als Positionen – prüfen, festschreiben, senden.'],
          ] as const).map(([Icon, title, text], i) => (
            <article key={title} className="site-step" data-reveal style={{ ['--d' as string]: `${i * 80}ms` }}>
              <span className="tile-icon"><Icon size={18} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Bento-Funktionen ---------- */}
      <section id="funktionen" className="section shell">
        <div className="section-head" data-reveal>
          <span className="kicker">Funktionen</span>
          <h2>Gebaut fürs Handwerk.<br /><span className="muted-head">Nicht fürs Großraumbüro.</span></h2>
        </div>
        <div className="bento">
          <article className="tile tile-wide" data-reveal style={{ ['--d' as string]: '0ms' }}>
            <div className="tile-copy">
              <span className="tile-icon"><ReceiptText size={18} /></span>
              <h3>Vom Angebot zur Rechnung</h3>
              <p>Angebot, Auftragsbestätigung, Lieferschein und Rechnung – Positionen aus dem Lager übernehmen, mit einem Klick weiterführen, Zahlungen erfassen. Überfälliges sehen Sie sofort.</p>
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
            <p>EK, VK und Bestand – mit QR-Etiketten am Regal und Scanner am Handy. Rechnungen buchen das Material ab.</p>
            <div className="stock">
              <div><span>NYM-J 3x1,5 mm²</span><b>420 m</b></div><i><s style={{ width: '78%' }} /></i>
              <div><span>FI-Schalter 40 A</span><b className="warn">2 Stück</b></div><i><s className="warn" style={{ width: '18%' }} /></i>
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

      {/* ---------- Österreich zuerst ---------- */}
      <section id="oesterreich" className="section section-soft">
        <div className="shell">
          <div className="section-head" data-reveal>
            <span className="kicker">Österreich zuerst</span>
            <h2>Aus Österreich. Für Österreich.</h2>
            <p>Die meisten großen Programme sind für Deutschland gedacht. VYSNER One rechnet so, wie man bei uns rechnet.</p>
          </div>
          <div className="site-steps site-steps-3">
            {([
              ['20 / 13 / 10 %', 'Österreichische USt.-Sätze voreingestellt – dazu UID-Nummer, Firmenbuch und die Rechnungsmerkmale nach § 11 UStG.'],
              ['Kleinunternehmer', 'Hinweis nach § 6 Abs. 1 Z 27 UStG automatisch auf jeder Rechnung, wenn Sie die Regelung nutzen.'],
              ['Für die Baustelle', 'Regiestunden, Material, Fotos und Mängel je Baustelle – so, wie im Handwerk gearbeitet wird.'],
            ] as const).map(([title, text], i) => (
              <article key={title} className="site-step" data-reveal style={{ ['--d' as string]: `${i * 80}ms` }}>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Persönlich ---------- */}
      <section id="ueber-uns" className="section shell">
        <div className="founder" data-reveal="scale">
          <span className="founder-icon"><HardHat size={26} /></span>
          <div>
            <span className="kicker">Persönlich & lokal</span>
            <h2>Von einem Elektriker aus Oberösterreich.</h2>
            <p>VYSNER One baut jemand, der selbst Angebote schreibt, Regiestunden abrechnet und weiß, wie der Freitagnachmittag im Büro aussieht. Wenn Sie eine Frage haben, reden Sie mit dem, der die Software gebaut hat – nicht mit einer Warteschleife.</p>
            <p className="founder-meta"><MapPin size={15} /> Oberösterreich · <Mail size={15} /> <a href="mailto:hallo@vysn.de">hallo@vysn.de</a></p>
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
          <li><span className="node"><HardHat size={18} /></span><small>Schritt 02</small><h3>Baustelle anlegen</h3><p>Kunde wählen, Stundensatz eintragen – Ihre Leute erfassen vor Ort Stunden, Material und Fotos.</p></li>
          <li><span className="node"><ReceiptText size={18} /></span><small>Schritt 03</small><h3>Abrechnen</h3><p>Ein Klick macht daraus die Rechnung. Zahlungen, Lager, GuV und Umsatzsteuer sind immer aktuell.</p></li>
        </ol>
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
            <h2>Weniger Zettel. Mehr Feierabend.</h2>
            <p>Konto anlegen, Betrieb einrichten und die erste Baustelle abrechnen – im Tarif Start dauerhaft kostenlos.</p>
            <div className="hero-actions">
              <Link href="/app" className="btn btn-glow btn-lg">Jetzt kostenlos starten <ArrowRight size={17} /></Link>
            </div>
            <div className="cta-contact">
              <a href="mailto:hallo@vysn.de"><Mail size={15} /> hallo@vysn.de</a>
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
    ['RE-2026-0042', 'Familie Leitner · Zubau Marchtrenk', '18.09.2026', 'Offen', '2.483,40 €'],
    ['RE-2026-0041', 'Café Morgenrot · Ried', '12.09.2026', 'Bezahlt', '1.922,41 €'],
    ['RE-2026-0040', 'Ordination Dr. Yilmaz · Vöcklabruck', '04.09.2026', 'Überfällig', '1.190,00 €'],
    ['RE-2026-0039', 'Hausverwaltung Lindner · Linz', '28.08.2026', 'Bezahlt', '5.106,90 €'],
    ['RE-2026-0038', 'Baumeister Weiß · Wels', '21.08.2026', 'Bezahlt', '2.137,95 €'],
  ];
  return (
    <div className="stage" aria-hidden="true">
      <div className="app-mock">
        <div className="app-mock-side">
          <div className="mock-brand"><VysnMark height={16} /><VysnWordmark height={8} /></div>
          {['Startseite', 'Baustellen', 'Angebote', 'Rechnungen', 'Kunden', 'Material & Lager', 'Berichte'].map((l) => (
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
      <div className="float float-a"><HardHat size={18} /><span><small>Baustelle Leitner · 6,5 Std. erfasst</small><b>Rechnung erstellen</b></span></div>
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
