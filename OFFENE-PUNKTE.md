# Offene Punkte

Liste der Aufgaben, die noch erledigt werden müssen, bevor bzw. nachdem VYSNER One live geht.

## E-Mail-Versand (SMTP) einrichten
- **Status:** offen
- **Warum:** Seit 19.06.2026 ist die Widerrufsbestätigung per E-Mail Pflicht (§ 356a BGB). Ohne SMTP funktionieren Widerruf, Team-Einladungen und der Belegversand nur ohne E-Mail.
- **Was zu tun ist:** Bei Hostinger als Umgebungsvariablen hinterlegen:
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (bei Port 465 `true`), `MAIL_FROM` (z. B. `VYSNER One <noreply@ihre-domain.de>`).
  Optional: `WITHDRAWAL_TO` (Empfänger öffentlicher Widerrufe, Standard hallo@vysn.de), `WITHDRAWAL_BCC`.
- **Prüfen:** Einstellungen → E-Mail-Versand zeigt „Direkter Versand aktiv“.

## Firmendaten in Impressum und Widerrufsbelehrung
- **Status:** offen
- Platzhalter in `app/impressum/page.tsx` und `app/widerruf/page.tsx` durch echte Angaben ersetzen und Texte rechtlich prüfen lassen.

## KI-Sprachassistent: API-Schlüssel und Datenschutz
- **Status:** offen
- **API-Schlüssel:** In der Anthropic Console (console.anthropic.com) einen API-Schlüssel anlegen und bei Hostinger als `ANTHROPIC_API_KEY` hinterlegen – nie im Code oder im Chat. Ohne Schlüssel zeigt der Assistent „noch nicht eingerichtet“.
- **Kosten im Blick behalten:** Abrechnung pro Nutzung bei Anthropic (Modell Claude Opus 5.5, Aufwand „low“). In der Console ein monatliches Ausgabenlimit setzen.
- **Datenschutz:** Für Anfragen an den Assistenten werden Kunden-, Artikel- und Belegdaten an Anthropic (Auftragsverarbeiter) übermittelt. Datenschutzerklärung ergänzen und den Auftragsverarbeitungsvertrag (DPA) mit Anthropic abschließen.
- **Spracherkennung:** läuft im Browser (Web Speech API; Chrome, Edge, Safari). In Firefox nur Texteingabe.
