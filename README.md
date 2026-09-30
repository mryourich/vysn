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

Unter *Firmendaten → Datensicherung* lassen sich in beiden Modi Sicherungen als JSON exportieren und einspielen – darüber lassen sich auch lokal erfasste Daten nach Supabase übernehmen.

## Vor dem Livegang

- Impressum (`app/impressum`) und Datenschutz (`app/datenschutz`) mit echten Angaben füllen
- Kontakt-E-Mail/-Telefon auf der Startseite (`app/page.tsx`, Abschnitt `#kontakt`) anpassen
- Preise in `components/site/pricing.tsx` prüfen
