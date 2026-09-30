import Link from 'next/link';
import {
  ArrowRight, BarChart3, Boxes, Building2, Check, FileText, LayoutDashboard, Mail, Palette, Phone, ReceiptText, ShieldCheck, Smartphone, Wallet,
} from 'lucide-react';
import { SiteHeader } from '../components/site/site-header';
import { SiteFooter } from '../components/site/site-footer';
import { Pricing } from '../components/site/pricing';
import { DesignShowcase } from '../components/site/design-showcase';
import './site.css';

const FEATURES = [
  { icon: FileText, title: 'Angebote', text: 'Angebote in wenigen Minuten erstellen, Positionen aus dem Materialstamm übernehmen und mit einem Klick in eine Rechnung umwandeln.' },
  { icon: ReceiptText, title: 'Rechnungen', text: 'Rechnungen mit allen Pflichtangaben nach § 14 UStG, Zahlungseingänge erfassen, Überfälliges sofort erkennen.' },
  { icon: Palette, title: 'Eigenes Rechnungsdesign', text: 'Logo, Farbe, Schrift und Layout selbst festlegen. Jedes Dokument wird als sauberes PDF exportiert.' },
  { icon: Boxes, title: 'Material & Lager', text: 'Einkaufs- und Verkaufspreise, Aufschläge und Bestände. Rechnungen buchen verbrauchtes Material automatisch ab.' },
  { icon: Wallet, title: 'Ausgaben', text: 'Belege nach Kategorien erfassen – Brutto oder Netto, die Umsatzsteuer rechnet VYSN One selbst.' },
  { icon: BarChart3, title: 'GuV & Umsatzsteuer', text: 'Gewinn- und Verlustrechnung nach Jahr, Quartal oder Monat. Mit Rohertrag, Marge und USt.-Zahllast.' },
];

const FAQ = [
  ['Brauche ich Buchhaltungskenntnisse?', 'Nein. Sie schreiben Angebote und Rechnungen und erfassen Ihre Ausgaben. Die GuV, Umsatzsteuer und Auswertungen entstehen daraus automatisch.'],
  ['Sind die Rechnungen rechtlich korrekt?', 'Die Vorlagen enthalten alle Pflichtangaben nach § 14 UStG: Anschriften, Steuernummer bzw. USt-IdNr., fortlaufende Rechnungsnummer, Leistungsdatum, Netto, Steuersatz und Steuerbetrag. Für Kleinunternehmer wird automatisch der Hinweis nach § 19 UStG gesetzt.'],
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

      <section className="hero">
        <div className="shell hero-grid">
          <div className="hero-copy">
            <span className="kicker">Für KMU, Handwerk und Dienstleister</span>
            <h1>Angebote, Rechnungen und Zahlen – endlich an einem Ort.</h1>
            <p className="lead">VYSN One ist die schlanke Unternehmenssoftware für kleine Betriebe. Sie schreiben Angebote und Rechnungen im eigenen Design, behalten Material und Ausgaben im Blick und sehen jederzeit, was unterm Strich übrig bleibt.</p>
            <div className="hero-actions">
              <Link href="/app" className="btn btn-primary btn-lg">Kostenlos starten <ArrowRight size={17} /></Link>
              <a href="#funktionen" className="btn btn-lg">Funktionen ansehen</a>
            </div>
            <ul className="hero-points">
              <li><Check size={16} /> In 3 Minuten eingerichtet</li>
              <li><Check size={16} /> Keine Kreditkarte nötig</li>
              <li><Check size={16} /> Auf Desktop und Smartphone</li>
            </ul>
          </div>
          <HeroVisual />
        </div>
      </section>

      <section className="band">
        <div className="shell band-grid">
          {[['Handwerk & Bau', 'Material, Stunden, Aufmaß'], ['Dienstleister', 'Stundensätze & Pauschalen'], ['Agenturen & Büros', 'Projekte & Honorare'], ['Handel', 'Artikel & Lagerbestand']].map(([t, s]) => (
            <div key={t}><strong>{t}</strong><span>{s}</span></div>
          ))}
        </div>
      </section>

      <section id="funktionen" className="section shell">
        <div className="section-head">
          <span className="kicker">Funktionen</span>
          <h2>Alles, was ein kleiner Betrieb im Büro braucht. Nicht mehr.</h2>
          <p>Kein überladenes ERP, keine Tabellen-Sammlung. VYSN One führt Sie vom ersten Angebot bis zur fertigen GuV.</p>
        </div>
        <div className="features">
          {FEATURES.map((f) => (
            <article key={f.title} className="feature">
              <span className="feature-icon"><f.icon size={20} strokeWidth={1.8} /></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section section-alt">
        <div className="shell split">
          <div className="split-copy">
            <span className="kicker">Dashboard</span>
            <h2>Morgens einmal hinsehen – und wissen, wo Ihr Betrieb steht.</h2>
            <p>Umsatz, Ergebnis, offene Forderungen und laufende Angebote auf einen Blick. Dazu eine Liste mit allem, was heute Aufmerksamkeit braucht: überfällige Rechnungen, Entwürfe, Material unter Mindestbestand.</p>
            <ul className="checklist">
              <li><LayoutDashboard size={17} /> Kennzahlen für Jahr und Monat</li>
              <li><BarChart3 size={17} /> Umsatz und Ausgaben im Monatsverlauf</li>
              <li><Smartphone size={17} /> Unterwegs genauso übersichtlich wie am Schreibtisch</li>
            </ul>
          </div>
          <DashboardMock />
        </div>
      </section>

      <section id="rechnungsdesign" className="section shell">
        <div className="section-head">
          <span className="kicker">Rechnungsdesign</span>
          <h2>Ihre Rechnung sieht aus wie Ihr Unternehmen.</h2>
          <p>Probieren Sie es direkt hier aus: Layout, Farbe, Schrift und Tabelle wählen. In VYSN One kommt Ihr eigenes Logo dazu – und der Export ist ein echtes, druckfertiges PDF.</p>
        </div>
        <DesignShowcase />
      </section>

      <section className="section section-alt">
        <div className="shell">
          <div className="section-head">
            <span className="kicker">So funktioniert es</span>
            <h2>In drei Schritten startklar.</h2>
          </div>
          <ol className="steps-row">
            <li><span>1</span><Building2 size={22} strokeWidth={1.7} /><h3>Firma anlegen</h3><p>Firmendaten, Steuernummer, Bankverbindung und Logo eintragen. Einmal – und für jedes Dokument verfügbar.</p></li>
            <li><span>2</span><FileText size={22} strokeWidth={1.7} /><h3>Angebot schreiben</h3><p>Kunde wählen, Positionen aus Material und Leistungen übernehmen, PDF senden. Angenommen? Ein Klick macht daraus die Rechnung.</p></li>
            <li><span>3</span><BarChart3 size={22} strokeWidth={1.7} /><h3>Zahlen im Blick</h3><p>Zahlungen und Ausgaben erfassen. GuV, Umsatzsteuer und Lagerbestand sind immer aktuell.</p></li>
          </ol>
        </div>
      </section>

      <section id="preise" className="section shell">
        <div className="section-head center">
          <span className="kicker">Preise</span>
          <h2>Fair, transparent und jederzeit kündbar.</h2>
          <p>Starten Sie kostenlos. Wechseln Sie erst, wenn VYSN One Ihnen im Alltag Zeit spart.</p>
        </div>
        <Pricing />
        <p className="pricing-note"><ShieldCheck size={16} /> Alle Preise zzgl. gesetzlicher USt. Keine Einrichtungsgebühr, keine Mindestlaufzeit bei monatlicher Zahlung.</p>
      </section>

      <section id="faq" className="section section-alt">
        <div className="shell faq-grid">
          <div className="section-head">
            <span className="kicker">Häufige Fragen</span>
            <h2>Gut zu wissen.</h2>
            <p>Ihre Frage ist nicht dabei? Schreiben Sie uns – wir antworten in der Regel am selben Werktag.</p>
          </div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="kontakt" className="section shell">
        <div className="cta">
          <div>
            <h2>Bereit für weniger Büro und mehr Überblick?</h2>
            <p>Richten Sie Ihr Unternehmen jetzt ein – oder sehen Sie sich VYSN One zuerst mit Beispieldaten an.</p>
          </div>
          <div className="cta-actions">
            <Link href="/app" className="btn btn-lg btn-light">Jetzt kostenlos starten <ArrowRight size={17} /></Link>
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

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="mock-window">
        <div className="mock-bar"><i /><i /><i /></div>
        <div className="mock-body">
          <div className="mock-side">
            <b />{[62, 48, 55, 40, 58, 44].map((w, i) => <span key={i} className={i === 1 ? 'on' : ''} style={{ width: `${w}%` }} />)}
          </div>
          <div className="mock-main">
            <div className="mock-title">Rechnungen</div>
            <div className="mock-stats">
              <div><small>Offen</small><strong>8.420 €</strong></div>
              <div><small>Überfällig</small><strong className="red">1.190 €</strong></div>
              <div><small>Bezahlt 2026</small><strong>96.310 €</strong></div>
            </div>
            <div className="mock-rows">
              {[['RE-2026-0042', 'Weiß & Partner', 'Offen', '3.418,35 €'], ['RE-2026-0041', 'Café Morgenrot', 'Bezahlt', '1.922,41 €'], ['RE-2026-0040', 'Praxis Dr. Yilmaz', 'Überfällig', '1.190,00 €'], ['RE-2026-0039', 'Hausverwaltung Lindner', 'Bezahlt', '5.106,90 €']].map(([n, c, s, v]) => (
                <div key={n}><span><b>{n}</b><small>{c}</small></span><em className={s === 'Bezahlt' ? 'ok' : s === 'Offen' ? 'info' : 'bad'}>{s}</em><strong>{v}</strong></div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mock-paper">
        <div className="paper-head"><span className="paper-logo" /><span className="paper-lines"><i /><i /></span></div>
        <div className="paper-title">Rechnung RE-2026-0042</div>
        {[80, 64, 72, 50].map((w, i) => <div key={i} className="paper-row"><i style={{ width: `${w}%` }} /><i /></div>)}
        <div className="paper-total"><span>Rechnungsbetrag</span><b>3.418,35 €</b></div>
      </div>
      <div className="mock-phone">
        <div className="phone-notch" />
        <small>Ergebnis 2026</small>
        <strong>41.870 €</strong>
        <div className="phone-bars">{[40, 55, 48, 70, 62, 80, 74].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
        <div className="phone-tabs"><i /><i /><i /><i /></div>
      </div>
    </div>
  );
}

function DashboardMock() {
  return (
    <div className="dash-mock" aria-hidden="true">
      <div className="dash-stats">
        {[['Umsatz 2026', '118.240 €', 'davon 9.870 € im September'], ['Ergebnis 2026', '41.870 €', 'Marge 35,4 %'], ['Offene Forderungen', '8.420 €', '1 überfällig'], ['Offene Angebote', '14.300 €', '3 versendet']].map(([l, v, s]) => (
          <div key={l}><small>{l}</small><strong>{v}</strong><span>{s}</span></div>
        ))}
      </div>
      <div className="dash-chart">
        <div className="dash-legend"><span><i className="c1" /> Umsatz</span><span><i className="c2" /> Ausgaben</span></div>
        <div className="dash-bars">
          {[[62, 44], [70, 47], [55, 40], [80, 52], [74, 50], [88, 55], [66, 46], [92, 58], [84, 54]].map(([a, b], i) => (
            <div key={i}><i className="c1" style={{ height: `${a}%` }} /><i className="c2" style={{ height: `${b}%` }} /></div>
          ))}
        </div>
      </div>
    </div>
  );
}
