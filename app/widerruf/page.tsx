import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '../../components/site/site-footer';
import { SiteHeader } from '../../components/site/site-header';
import { WithdrawalForm } from '../../components/site/withdrawal-form';
import '../site.css';

export const metadata: Metadata = { title: 'Widerruf – VYSNER One' };

export default function WiderrufPage() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="shell legal">
        <h1>Vertrag widerrufen</h1>
        <p>Sie haben einen bezahlten Tarif (Solo, Business oder Team) gebucht und möchten ihn innerhalb von 14 Tagen widerrufen? Am schnellsten geht es angemeldet unter{' '}
          <Link href="/app/tarif#widerruf" className="link">Abonnement → Vertrag widerrufen</Link> – das Abo endet sofort und der Betrag wird automatisch erstattet.
          Alternativ nutzen Sie das Formular unten.</p>

        <WithdrawalForm />

        <h2>Widerrufsbelehrung</h2>
        <p className="placeholder">Bitte vor der Veröffentlichung Firmenname und Anschrift ergänzen und die Texte rechtlich prüfen lassen.</p>
        <h3>Widerrufsrecht</h3>
        <p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</p>
        <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ([Firmenname], [Straße Hausnummer], [PLZ Ort], E-Mail: hallo@vysn.de) mittels einer eindeutigen Erklärung (z. B. eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren. Sie können dafür die Widerrufsfunktion auf dieser Seite, die Funktion „Vertrag widerrufen“ in Ihrem Konto oder das beigefügte Muster-Widerrufsformular verwenden, das jedoch nicht vorgeschrieben ist.</p>
        <p>Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.</p>
        <h3>Folgen des Widerrufs</h3>
        <p>Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen, die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden Ihnen wegen dieser Rückzahlung Entgelte berechnet.</p>
        <p>Abweichend von der gesetzlichen Regelung erstatten wir den <strong>vollen</strong> Betrag, auch wenn Sie die Leistung während der Widerrufsfrist bereits genutzt haben. Ihre in VYSNER One gespeicherten Daten bleiben erhalten; die Firma nutzt nach dem Widerruf den kostenlosen Tarif Start.</p>

        <h3>Geltungsbereich</h3>
        <ul>
          <li><strong>Deutschland</strong> (§§ 312g, 355, 356a BGB) und <strong>Österreich</strong> (§ 11 FAGG): gesetzliches Widerrufsrecht für Verbraucherinnen und Verbraucher.</li>
          <li><strong>Schweiz</strong>: Ein gesetzliches Widerrufsrecht für Online-Verträge besteht nicht – wir räumen es freiwillig zu denselben Bedingungen ein.</li>
          <li><strong>Unternehmen</strong>: Wir räumen das Widerrufsrecht freiwillig auch Unternehmerinnen und Unternehmern ein.</li>
        </ul>

        <h2>Muster-Widerrufsformular</h2>
        <p>(Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses Formular aus und senden Sie es zurück.)</p>
        <p>An [Firmenname], [Straße Hausnummer], [PLZ Ort], E-Mail: hallo@vysn.de<br />
          Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung: VYSNER One, Tarif ________<br />
          Bestellt am (*) ________<br />
          Name des/der Verbraucher(s) ________<br />
          Anschrift des/der Verbraucher(s) ________<br />
          Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier) ________<br />
          Datum ________<br />
          (*) Unzutreffendes streichen.</p>

        <h2>Kündigung nach Ablauf der Widerrufsfrist</h2>
        <p>Nach Ablauf der 14 Tage können Sie jederzeit zum Ende der laufenden Laufzeit kündigen – angemeldet unter <Link href="/app/tarif" className="link">Abonnement</Link> („Zum Laufzeitende kündigen“) oder formlos per E-Mail an hallo@vysn.de.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
