import { ArrowRight, BarChart3, Building2, Check, CheckCircle2, ChevronDown, FileCheck2, Headphones, Layers3, LockKeyhole, Play, Server, ShieldCheck, Sparkles, Users, Workflow, X } from 'lucide-react';

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="VYSN Startseite">
      <span className="brand-mark" aria-hidden="true"><i /><i /></span>
      <span>VYSN</span>
    </a>
  );
}

export default function Home() {
  return (
    <main id="top">
      <nav className="nav shell" aria-label="Hauptnavigation">
        <Logo />
        <div className="nav-links">
          <a href="#produkt">Produkt</a>
          <a href="#loesungen">Lösungen <ChevronDown size={14} /></a>
          <a href="#preise">Preise</a>
          <a href="#sicherheit">Sicherheit</a>
        </div>
        <div className="nav-actions">
          <a className="login" href="#kontakt">Anmelden</a>
          <a className="button button-dark button-small" href="#preise">Kostenlos starten <ArrowRight size={15} /></a>
        </div>
      </nav>

      <section className="hero shell">
        <div className="eyebrow"><Sparkles size={14} /> Die Arbeitsplattform für moderne Unternehmen</div>
        <h1>Alles, was dein Unternehmen braucht. <span>In einem System.</span></h1>
        <p className="hero-copy">VYSN verbindet Aufträge, Kunden, Finanzen und Teamarbeit – klar, schnell und individuell skalierbar.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#preise">VYSN One testen <ArrowRight size={17} /></a>
          <a className="button button-ghost" href="#produkt"><Play size={16} fill="currentColor" /> Produkt ansehen</a>
        </div>
        <p className="reassurance"><span><Check size={14} /> 14 Tage kostenlos</span><span><Check size={14} /> Keine Kreditkarte</span><span><Check size={14} /> DSGVO-konform</span></p>

        <div className="product-stage" id="produkt" aria-label="VYSN Produktvorschau">
          <div className="stage-glow" />
          <div className="app-window">
            <aside className="app-sidebar">
              <Logo />
              <div className="side-list">
                {['Übersicht', 'Aufträge', 'Kunden', 'Finanzen', 'Dokumente'].map((label, i) => (
                  <div className={i === 0 ? 'side-item active' : 'side-item'} key={label}><span className="side-icon" /> {label}</div>
                ))}
              </div>
              <div className="plan-chip"><span>VYSN ONE</span><small>Dein aktueller Plan</small></div>
            </aside>
            <div className="app-main">
              <div className="app-top"><div><small>DIENSTAG, 1. SEPTEMBER</small><h2>Guten Morgen, Max.</h2></div><span className="avatar">MM</span></div>
              <div className="metric-grid">
                <div className="metric"><small>Offene Aufträge</small><strong>18</strong><span className="up">↗ 12% diesen Monat</span></div>
                <div className="metric"><small>Umsatz im September</small><strong>€ 42.850</strong><span className="up">↗ 8,4% zum Vormonat</span></div>
                <div className="metric"><small>Offene Rechnungen</small><strong>9</strong><span>€ 12.620 ausstehend</span></div>
              </div>
              <div className="app-content">
                <div className="chart-card"><div className="card-head"><div><small>GESCHÄFTSENTWICKLUNG</small><h3>Einnahmen &amp; Ausgaben</h3></div><span>Dieses Jahr⌄</span></div><div className="chart"><div className="chart-grid" /><svg viewBox="0 0 700 210" role="img" aria-label="Steigende Einnahmenkurve"><path className="area" d="M0 170 C70 165 85 120 150 132 S255 78 325 102 S430 45 505 71 S620 27 700 35 L700 210 L0 210Z"/><path className="line" d="M0 170 C70 165 85 120 150 132 S255 78 325 102 S430 45 505 71 S620 27 700 35"/></svg><div className="months"><span>Jan</span><span>Mär</span><span>Mai</span><span>Jul</span><span>Sep</span><span>Nov</span></div></div></div>
                <div className="tasks-card"><div className="card-head"><div><small>HEUTE</small><h3>Nächste Schritte</h3></div><b>4</b></div>{['Angebot Müller senden','Rechnung RE-028 prüfen','Materialbestand aktualisieren'].map((task, i) => <div className="task" key={task}><span className={i === 0 ? 'done' : ''}>{i === 0 ? '✓' : ''}</span><p>{task}<small>{i === 0 ? 'Erledigt' : i === 1 ? 'Heute, 14:00' : 'Heute'}</small></p></div>)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof shell" aria-label="VYSN Vorteile">
        <p>ENTWICKELT FÜR DEN DEUTSCHEN MITTELSTAND</p>
        <div className="proof-row"><span><b>1</b> Plattform</span><span><b>360°</b> Übersicht</span><span><b>2</b> Lösungen</span><span><b>100%</b> skalierbar</span></div>
      </section>

      <section className="section shell" id="loesungen">
        <div className="section-intro"><span className="section-kicker">EIN SYSTEM, ALLES DRIN</span><h2>Weniger Verwaltung.<br />Mehr Unternehmen.</h2><p>VYSN bringt deine wichtigsten Abläufe an einen Ort – damit du Entscheidungen schneller triffst und dein Team fokussiert bleibt.</p></div>
        <div className="feature-grid">
          <article className="feature-card feature-wide"><div className="feature-icon blue"><Layers3 /></div><div><span>OPERATIONS</span><h3>Aufträge ohne Chaos steuern.</h3><p>Von der Anfrage bis zum Abschluss: Status, Termine, Verantwortliche und Dokumente bleiben automatisch zusammen.</p></div><div className="mini-pipeline"><div className="pipeline-head"><b>Aktive Aufträge</b><span>12 Projekte</span></div>{[['BA-2026-018','Neubau Müller','65%'],['BA-2026-017','Sanierung Altbau','40%'],['BA-2026-016','Anbau Wohnhaus','82%']].map(([id,name,p])=><div className="pipeline-row" key={id}><small>{id}</small><b>{name}</b><i><em style={{width:p}} /></i><span>{p}</span></div>)}</div></article>
          <article className="feature-card"><div className="feature-icon teal"><FileCheck2 /></div><span>FINANZEN</span><h3>Angebote &amp; Rechnungen</h3><p>Professionelle Dokumente, klare Zahlungsstände und alle Zahlen im Blick.</p><div className="invoice-mini"><b>RE-2026-045</b><span>Bezahlt</span><strong>2.850,00 €</strong></div></article>
          <article className="feature-card"><div className="feature-icon violet"><Users /></div><span>KUNDEN</span><h3>Beziehungen, die bleiben</h3><p>Kontakte, Historie und offene Themen – zentral statt verteilt über Postfächer.</p><div className="avatars"><i>MS</i><i>AK</i><i>JL</i><i>+24</i></div></article>
          <article className="feature-card"><div className="feature-icon orange"><BarChart3 /></div><span>INSIGHTS</span><h3>Zahlen, die verständlich sind</h3><p>Echtzeit-Kennzahlen und Berichte, ohne Tabellen zusammenzubauen.</p><div className="bar-mini"><i style={{height:'35%'}}/><i style={{height:'55%'}}/><i style={{height:'44%'}}/><i style={{height:'72%'}}/><i style={{height:'88%'}}/><i style={{height:'78%'}}/></div></article>
        </div>
      </section>

      <section className="plans-section" id="preise">
        <div className="shell">
          <div className="section-intro centered"><span className="section-kicker">ZWEI VERSIONEN. EIN ANSPRUCH.</span><h2>VYSN wächst mit dir.</h2><p>Einfach starten oder individuell skalieren – mit einer Lösung, die zu deinem Unternehmen passt.</p></div>
          <div className="plan-grid">
            <article className="plan-card one"><div className="plan-label"><span className="plan-gem">✦</span><div><b>VYSN ONE</b><small>Für kleine Unternehmen &amp; Teams</small></div></div><p className="plan-desc">Alles, was du brauchst, um dein Tagesgeschäft professionell zu organisieren.</p><div className="price"><span>ab</span><strong>39 €</strong><small>/ Monat<br />zzgl. MwSt.</small></div><a className="button button-primary plan-button" href="#kontakt">14 Tage kostenlos testen <ArrowRight size={17}/></a><ul>{['Auftrags- & Kundenverwaltung','Angebote & Rechnungen','Einnahmen & Ausgaben','Dashboard & Standardberichte','Bis zu 5 Nutzer','E-Mail-Support'].map(x=><li key={x}><CheckCircle2 />{x}</li>)}</ul></article>
            <article className="plan-card pro"><div className="recommended">INDIVIDUELL FÜR IHR UNTERNEHMEN</div><div className="plan-label"><span className="plan-gem">✦</span><div><b>VYSN PRO</b><small>Für große Firmen &amp; komplexe Prozesse</small></div></div><p className="plan-desc">Eine Plattform, die sich an Ihre Organisation anpasst – nicht umgekehrt.</p><div className="price"><strong>Individuell</strong><small>Planung, Einführung<br />und Betreuung</small></div><a className="button button-light plan-button" href="#kontakt">Beratung anfragen <ArrowRight size={17}/></a><ul>{['Alle Funktionen aus VYSN One','Individuelle Module & Workflows','Unbegrenzte Nutzer & Standorte','Schnittstellen zu Drittsystemen','SSO, Rollen & Freigabeprozesse','Persönlicher Ansprechpartner'].map(x=><li key={x}><CheckCircle2 />{x}</li>)}</ul></article>
          </div>
          <p className="price-note">Alle Preise transparent. Monatlich kündbar bei VYSN One. Keine Einrichtungsgebühr.</p>
        </div>
      </section>

      <section className="comparison section shell">
        <div className="section-intro"><span className="section-kicker">DIE RICHTIGE LÖSUNG</span><h2>One oder Pro?</h2></div>
        <div className="compare-table"><div className="compare-row compare-head"><b>Funktion</b><strong>VYSN One</strong><strong>VYSN Pro</strong></div>{[['Aufträge, Kunden & Finanzen','yes','yes'],['Standardberichte & Dashboard','yes','yes'],['Individuelle Workflows','no','yes'],['Eigene Module & Integrationen','no','yes'],['Mehrere Firmen & Standorte','no','yes'],['Persönliches Onboarding','Basis','Individuell']].map(([name,one,pro])=><div className="compare-row" key={name}><span>{name}</span><span>{one==='yes'?<Check/>:one==='no'?<X/>:one}</span><span>{pro==='yes'?<Check/>:pro}</span></div>)}</div>
      </section>

      <section className="security" id="sicherheit"><div className="shell security-inner"><div className="security-copy"><span className="section-kicker light-kicker">SICHER VON ANFANG AN</span><h2>Deine Daten.<br />Deine Kontrolle.</h2><p>VYSN ist für professionelles Arbeiten in Deutschland konzipiert – mit klaren Zugriffsrechten, moderner Verschlüsselung und nachvollziehbaren Prozessen.</p><div className="security-list"><span><ShieldCheck/>DSGVO-orientiert</span><span><LockKeyhole/>Verschlüsselte Übertragung</span><span><Server/>Hosting in Europa planbar</span></div></div><div className="security-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="shield-core"><ShieldCheck/></div><span className="security-pill p1">Rollen &amp; Rechte <Check/></span><span className="security-pill p2">SSL verschlüsselt <Check/></span><span className="security-pill p3">Backups <Check/></span></div></div></section>

      <section className="section shell process"><div className="section-intro centered"><span className="section-kicker">SO STARTET VYSN PRO</span><h2>Von komplex zu klar.</h2><p>Gemeinsam bringen wir Ihre Prozesse strukturiert in eine Plattform.</p></div><div className="steps">{[[Workflow,'01','Analyse','Wir verstehen Abläufe, Rollen und Ziele.'],[Building2,'02','Konfiguration','Wir gestalten Module und Workflows passend zu Ihnen.'],[Headphones,'03','Go-live & Betreuung','Wir begleiten Einführung, Team und Weiterentwicklung.']].map(([Icon,n,t,d])=><article key={String(n)}><span className="step-number">{n as string}</span><div className="step-icon"><Icon /></div><h3>{t as string}</h3><p>{d as string}</p></article>)}</div></section>

      <section className="faq-section shell"><div className="section-intro"><span className="section-kicker">FRAGEN &amp; ANTWORTEN</span><h2>Noch etwas unklar?</h2></div><div className="faq-list">{[['Kann ich VYSN One kostenlos testen?','Ja. Sie können VYSN One 14 Tage ohne Kreditkarte testen und in Ruhe prüfen, ob es zu Ihrem Unternehmen passt.'],['Kann ich später von One zu Pro wechseln?','Ja. Daten und bestehende Abläufe bilden die Grundlage für Ihre individuelle Pro-Lösung.'],['Ist VYSN für meine Branche geeignet?','VYSN One deckt zentrale kaufmännische Abläufe branchenübergreifend ab. VYSN Pro wird auf branchenspezifische Prozesse zugeschnitten.'],['Wie schnell kann VYSN Pro eingeführt werden?','Der Zeitplan richtet sich nach Umfang und Integrationen. Nach der Analyse erhalten Sie eine klare Roadmap mit festen Meilensteinen.']].map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>

      <section className="final-cta shell" id="kontakt"><div><span className="section-kicker light-kicker">BEREIT FÜR DEN NÄCHSTEN SCHRITT?</span><h2>Mach dein Unternehmen bereit für morgen.</h2><p>Starte einfach mit VYSN One oder sprich mit uns über deine individuelle VYSN Pro Lösung.</p></div><div className="cta-actions"><a className="button button-light" href="#top">VYSN One kostenlos testen <ArrowRight/></a><a className="button button-outline-light" href="#top">Pro-Beratung anfragen</a></div></section>

      <footer><div className="shell footer-grid"><div><Logo/><p>Die Arbeitsplattform für Unternehmen, die mehr vorhaben.</p></div><div><b>Produkt</b><a href="#loesungen">Funktionen</a><a href="#preise">VYSN One</a><a href="#preise">VYSN Pro</a></div><div><b>Unternehmen</b><a href="#kontakt">Kontakt</a><a href="#sicherheit">Sicherheit</a><a href="#top">Über VYSN</a></div><div><b>Rechtliches</b><a href="#">Impressum</a><a href="#">Datenschutz</a><a href="#">AGB</a></div></div><div className="shell footer-bottom"><span>© 2026 VYSN. Alle Rechte vorbehalten.</span><span>Entwickelt für Unternehmen in Europa.</span></div></footer>
    </main>
  );
}
