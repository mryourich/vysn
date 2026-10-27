# Offene Punkte

Liste der Aufgaben, die noch erledigt werden müssen, bevor bzw. nachdem VYSNER One live geht.

## E-Mail-Versand (SMTP) einrichten
- **Status:** offen
- **Warum:** Seit 19.06.2026 ist die Widerrufsbestätigung per E-Mail Pflicht (§ 356a BGB). Ohne SMTP funktionieren Widerruf, Team-Einladungen und der Belegversand nur ohne E-Mail.
- **Was zu tun ist:** Bei Hostinger als Umgebungsvariablen hinterlegen:
  `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` (bei Port 465 `true`), `MAIL_FROM` (z. B. `VYSNER One <noreply@ihre-domain.de>`).
  Optional: `WITHDRAWAL_TO` (Empfänger öffentlicher Widerrufe, Standard ist die Kontaktadresse), `WITHDRAWAL_BCC`.
- **Prüfen:** Einstellungen → E-Mail-Versand zeigt „Direkter Versand aktiv“.

## Firmendaten in Impressum, Datenschutz und Widerrufsbelehrung
- **Status:** offen – **Pflicht vor dem Verkauf**
- Platzhalter in `app/impressum/page.tsx`, `app/datenschutz/page.tsx` und `app/widerruf/page.tsx` durch echte Angaben ersetzen (Name/Firma, Anschrift, E-Mail, ggf. Telefon, UID, Firmenbuch/Gewerbe, Kammer/Behörde) und Texte rechtlich prüfen lassen.

## Kontakt auf der Website
- **Status:** offen
- Die Website zeigt `hallo@vysnone.com` – dieses Postfach muss bei Hostinger angelegt sein (oder bei Hostinger `NEXT_PUBLIC_CONTACT_EMAIL` setzen).
- Telefonnummer erscheint nur, wenn `NEXT_PUBLIC_CONTACT_PHONE` gesetzt ist (z. B. `+43 660 1234567`).
- Danach neu deployen (NEXT_PUBLIC_*-Werte werden beim Build eingesetzt).

## Assistent (KI-Zusatzbuchung): Einrichtung, Postfach und Datenschutz
- **Status:** offen – bewusst ausgeschaltet, bis die ersten Kunden ihn buchen wollen
- **Angebot:** 25 € / Monat (netto), eigenes Stripe-Abo, in jedem Tarif buchbar (auch Start), monatlich kündbar, 14 Tage Widerruf. Enthält **300 Aufgaben im Monat** (höchstens 40 am Tag) und den E-Mail-Versand – auch im Tarif Start.
- **Kann:** E-Mails an Kunden entwerfen und nach Bestätigung senden (Zahlungserinnerungen, Mahnungen, Nachfassen, Antworten, mit PDF), Tagesbriefing, Posteingang lesen und zusammenfassen, Belege/Kunden anlegen, Zahlungseingänge buchen, Fragen zu Zahlen beantworten. Alles nur nach Bestätigung.
- **Solange nicht eingerichtet:** Ohne `ANTHROPIC_API_KEY` oder ohne `STRIPE_PRICE_AI_MONTHLY` ist der Assistent unsichtbar und verursacht keine Kosten.
- **Einschalten:**
  1. In Stripe ein Produkt „Assistent“ mit Preis 25 € monatlich anlegen und die Preis-ID bei Hostinger als `STRIPE_PRICE_AI_MONTHLY` hinterlegen.
  2. Auf platform.claude.com ein Konto anlegen, Guthaben aufladen, **monatliches Ausgabenlimit** setzen, API-Schlüssel erstellen und bei Hostinger als `ANTHROPIC_API_KEY` hinterlegen – nie im Code oder im Chat.
  3. Für das Firmenpostfach bei Hostinger `MAILBOX_SECRET` setzen: eine lange Zufallszeichenkette (mind. 32 Zeichen), z. B. aus einem Passwort-Generator. **Nie ändern oder verlieren** – sonst müssen alle Firmen ihr Postfach neu verbinden.
  4. SQL-Update `supabase/migrations/20261027090000_assistant.sql` im Supabase SQL Editor ausführen, dann neu deployen.
- **Kosten je Firma (gedeckelt):** Claude Sonnet 5.5, Aufwand „low“; etwa 3–5 Cent je Aufgabe, im Schnitt 3–6 € im Monat. Harte Grenze `AI_MONTHLY_COST_CAP` (Standard 11 US-Dollar ≈ 10 €) je Firma und Monat; danach pausiert der Assistent bis zum Monatsersten. Weitere Stellschrauben: `AI_MONTHLY_LIMIT` (300), `AI_DAILY_LIMIT` (40).
- **Datenschutz:** Für Anfragen an den Assistenten werden Kunden-, Artikel-, Beleg- und – bei verbundenem Postfach – E-Mail-Inhalte an Anthropic (Auftragsverarbeiter) übermittelt. Datenschutzerklärung ergänzen und den Auftragsverarbeitungsvertrag (DPA) mit Anthropic abschließen. Postfach-Passwörter werden verschlüsselt gespeichert.
- **Spracherkennung:** läuft im Browser (Chrome, Edge, Safari) bzw. auf dem Handy; in Firefox nur Texteingabe.

## App in Google Play und im App Store veröffentlichen
- **Status:** offen – native App ist gebaut (Ordner `mobile/`, Anleitung `mobile/README.md`)
- **Android:** Google-Play-Entwicklerkonto (25 $ einmalig), `app-release.aab` hochladen, Store-Eintrag und Datensicherheit ausfüllen, geschlossener Test (12 Tester, 14 Tage) bei neuen privaten Konten.
- **iPhone:** Apple-Developer-Programm (99 $/Jahr); bauen und hochladen über EAS (Cloud, kein Mac nötig) oder mit Mac/Xcode.
- **Upload-Schlüssel** `vysner-upload.jks` mit `keystore.properties` sicher aufbewahren – nie ins Repository.
- **Für die Prüfung** ein Demo-Konto anlegen (Apple und Google verlangen Zugangsdaten).
- **Noch nicht in der App:** Buchführung (Einnahmen/Ausgaben), GuV, DATEV, Design und Einstellungen – öffnen sich auf vysnone.com.
