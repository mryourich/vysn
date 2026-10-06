# VYSN One

Schlanke Unternehmenssoftware für KMU: Angebote, Rechnungen (eigenes Design, PDF-Export), Kunden, Material & Lager, Ausgaben, GuV und Dashboard – inklusive Startseite mit Preisen. Optimiert für Desktop und Smartphone.

## Starten

```bash
npm install
npm run dev     # http://localhost:3000
npm run build && npm start   # Produktion
```

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `app/page.tsx` | Startseite (Funktionen, Rechnungsdesign-Demo, Preise, FAQ, Kontakt) |
| `app/app/*` | Anwendung: Dashboard, Angebote, Rechnungen, Kunden, Material, Ausgaben, GuV, Firmendaten, Rechnungsdesign |
| `components/pdf/*` | Rechnungs- und GuV-Vorlagen. Eine Vorlage erzeugt sowohl die HTML-Vorschau als auch das echte PDF (`@react-pdf/renderer`) |
| `lib/store.tsx` | Zustand, Login und alle Aktionen (Nummernkreise, Lagerbuchung, Angebot → Rechnung) |
| `lib/db/*` | Speicher-Adapter: `local.ts` (Browser) und `supabase.ts` (Datenbank), Mapping in `mappers.ts` |
| `lib/calc.ts` | Summen, USt., Status, GuV (Ist-/Soll-Prinzip) |
| `components/site/pricing.tsx` | Preise der Startseite (`PLANS`) |

## Daten & Supabase

Die App hat zwei Betriebsarten, gesteuert über Umgebungsvariablen (siehe `.env.example`):

- **Lokal** (Standard, keine Variablen): Daten im Browser (localStorage), kein Login.
- **Supabase** (`NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`): Login per E-Mail/Passwort, Daten in PostgreSQL mit Row Level Security, auf allen Geräten verfügbar.

Einrichtung, Datenmodell und Sicherheitskonzept: [`supabase/README.md`](supabase/README.md). Das Schema liegt in `supabase/migrations/`.

**Firmen & Tarife:** Ein Nutzer kann mehrere Firmen anlegen und über die Seitenleiste wechseln. Der Tarif gilt je Firma; im Tarif *Start* sind 10 Rechnungen pro Monat enthalten (`lib/plans.ts`, in Supabase zusätzlich per Datenbank-Trigger abgesichert). Im lokalen Modus lässt sich der Tarif unter *Firmendaten → Tarif* zum Testen umschalten.

**Lager & QR-Codes:** Unter *Material & Lager → Lagerplätze & QR* lassen sich Regale/Fächer anlegen und QR-Etiketten (A4-Bogen 3 × 8, 70 × 37 mm) drucken – für Lagerplätze und Artikel. Ein Scan mit der normalen Handykamera öffnet direkt die Ein-/Auslagerung (`/app/scan`); alternativ scannt der integrierte Scanner im Browser. Über „Zum Home-Bildschirm“ lässt sich VYSN One wie eine App installieren (Web-App-Manifest). Damit Handy und Büro dieselben Bestände sehen, ist Supabase nötig – im lokalen Modus hat jedes Gerät eigene Daten.

**E-Mail-Versand:** Angebote und Rechnungen werden mit PDF-Anhang versendet (`app/api/send`, SMTP-Variablen siehe `.env.example`). Optional gehen Rechnungen beim Festschreiben automatisch an den Kunden. Ohne Mailserver wird das PDF über das Gerät geteilt bzw. das E-Mail-Programm geöffnet.

**DATEV:** *DATEV-Export* erzeugt einen Buchungsstapel (EXTF 700, SKR03/SKR04, ANSI) mit Rechnungen, Zahlungen, Einnahmen und Ausgaben inkl. BU-Schlüsseln; die Kontenzuordnung ist je Firma anpassbar (`lib/datev.ts`).

Unter *Firmendaten → Datensicherung* lassen sich in beiden Modi Sicherungen als JSON exportieren und einspielen – darüber lassen sich auch lokal erfasste Daten nach Supabase übernehmen.

## Vor dem Livegang

- Impressum (`app/impressum`) und Datenschutz (`app/datenschutz`) mit echten Angaben füllen
- Kontakt-E-Mail/-Telefon auf der Startseite (`app/page.tsx`, Abschnitt `#kontakt`) anpassen
- Preise in `components/site/pricing.tsx` prüfen
