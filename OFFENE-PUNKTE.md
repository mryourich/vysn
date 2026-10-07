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
