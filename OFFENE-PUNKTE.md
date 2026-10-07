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

## KI-Sprachassistent: Zusatzbuchung, API-Schlüssel und Datenschutz
- **Status:** offen – bewusst ausgeschaltet, bis die ersten Kunden ihn buchen wollen
- **Angebot:** Zusatzbuchung für 25 € / Monat (netto), eigenes Stripe-Abo, in jedem Tarif buchbar (auch Start), monatlich kündbar, 14 Tage Widerruf.
- **Solange nicht eingerichtet:** Ohne `ANTHROPIC_API_KEY` oder ohne `STRIPE_PRICE_AI_MONTHLY` ist der Assistent unsichtbar (kein KI-Knopf, Erweiterung „Demnächst“) und verursacht keine Kosten.
- **Einschalten:**
  1. In Stripe ein Produkt „KI-Sprachassistent“ mit Preis 25 € monatlich (wiederkehrend) anlegen und die Preis-ID bei Hostinger als `STRIPE_PRICE_AI_MONTHLY` hinterlegen.
  2. Auf platform.claude.com ein Konto anlegen, Guthaben aufladen, einen API-Schlüssel erstellen und bei Hostinger als `ANTHROPIC_API_KEY` hinterlegen – nie im Code oder im Chat.
  3. Neu deployen. Der Stripe-Webhook braucht keine Änderung.
- **Kosten je Firma (gedeckelt):** Modell Claude Sonnet 5.5, Aufwand „low“; etwa 1–3 Cent je Anfrage. Höchstens 30 Anfragen am Tag (`AI_DAILY_LIMIT`) und 500 im Monat (`AI_MONTHLY_LIMIT`) – damit bleiben die Kosten je Firma bei höchstens ca. 15 € im Monat. Zusätzlich auf der Plattform ein monatliches Ausgabenlimit setzen.
- **Datenschutz:** Für Anfragen an den Assistenten werden Kunden-, Artikel- und Belegdaten an Anthropic (Auftragsverarbeiter) übermittelt. Datenschutzerklärung ergänzen und den Auftragsverarbeitungsvertrag (DPA) mit Anthropic abschließen.
- **Spracherkennung:** läuft im Browser (Web Speech API; Chrome, Edge, Safari). In Firefox nur Texteingabe.
