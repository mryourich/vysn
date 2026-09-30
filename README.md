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
| `lib/store.tsx` | Datenhaltung und alle Aktionen (Nummernkreise, Lagerbuchung, Angebot → Rechnung) |
| `lib/calc.ts` | Summen, USt., Status, GuV (Ist-/Soll-Prinzip) |
| `components/site/pricing.tsx` | Preise der Startseite (`PLANS`) |

## Daten

Alle Daten werden aktuell lokal im Browser (localStorage) gespeichert. Unter *Firmendaten → Datensicherung* lassen sich Sicherungen als JSON exportieren und wieder einspielen. Für Mehrbenutzerbetrieb und Zugriff von mehreren Geräten muss `lib/store.tsx` an ein Backend (z. B. Datenbank + Login) angebunden werden – die Oberfläche bleibt dabei unverändert.

## Vor dem Livegang

- Impressum (`app/impressum`) und Datenschutz (`app/datenschutz`) mit echten Angaben füllen
- Kontakt-E-Mail/-Telefon auf der Startseite (`app/page.tsx`, Abschnitt `#kontakt`) anpassen
- Preise in `components/site/pricing.tsx` prüfen
