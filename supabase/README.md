# Supabase einrichten

VYSN One läuft ohne Konfiguration im **lokalen Modus** (Daten im Browser). Sobald die
Supabase-Variablen gesetzt sind, schaltet die App automatisch auf **Login + Datenbank** um –
die Oberfläche bleibt gleich.

## 1. Projekt anlegen

1. Auf [supabase.com](https://supabase.com) ein Projekt erstellen (Region z. B. Frankfurt `eu-central-1`).
2. **SQL Editor** öffnen, den Inhalt von **`supabase/setup.sql`** einfügen und ausführen (enthält alle Migrationen).
   Alternativ die Dateien aus `migrations/` **der Reihe nach** ausführen:
   `20260930120000_init.sql`, `20261001090000_companies_and_plans.sql`, `20261002090000_storage_income_mail.sql`.
   Alternativ mit der Supabase CLI: `supabase link --project-ref <ref>` und `supabase db push`.

## 2. Authentifizierung

- **Authentication → Providers → Email** aktivieren (Passwort-Login).
- **Authentication → URL Configuration**: *Site URL* auf die Domain setzen
  (z. B. `https://vysn.de`) und `https://vysn.de/app` als Redirect-URL eintragen.
- Optional: E-Mail-Vorlagen auf Deutsch anpassen.

## 3. App verbinden

`.env.local` (lokal) bzw. Umgebungsvariablen beim Hosting setzen:

```
NEXT_PUBLIC_SUPABASE_URL=https://<projekt-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>   # Project Settings → API
```

Danach neu bauen (`npm run build`), da `NEXT_PUBLIC_*`-Variablen beim Build eingesetzt werden.

## Datenmodell

| Tabelle | Inhalt |
| --- | --- |
| `companies` | Firmendaten, Logo, Rechnungsdesign (`design` jsonb), Tarif (`plan`) |
| `company_members` | Nutzer ↔ Firma mit Rolle `owner` / `admin` / `member` |
| `customers`, `materials`, `expenses` | Stammdaten und Ausgaben |
| `stock_movements` | Lagerbewegungen je Artikel |
| `documents` | Angebote und Rechnungen; Empfänger und Positionen als Snapshot (jsonb) |
| `number_counters` | Nummernkreise, atomar vergeben über `allocate_number()` |

**Mehrere Firmen:** Ein Nutzer kann beliebig viele Firmen anlegen (`create_company()`), `my_companies()`
liefert sie für den Firmenwechsler. **Tarife** gelten je Firma (`companies.plan`): Im Tarif `start` erlaubt
der Trigger `documents_invoice_limit` höchstens 10 Rechnungen pro Kalendermonat (nach Rechnungsdatum),
`business` und `team` sind unbegrenzt. Den Tarif setzt nur der Server (Service-Role, z. B. per Stripe-Webhook):
`update companies set plan = 'business' where id = '…';`

**Sicherheit:** Row Level Security auf allen Tabellen – Nutzer sehen ausschließlich Daten
der Firmen, in denen sie Mitglied sind. Firmen werden nur über `create_company()` angelegt,
der Tarif (`plan`) ist für Nutzer nicht änderbar. Festgeschriebene Rechnungen (Status ≠ Entwurf)
können inhaltlich weder geändert noch gelöscht werden (Trigger `protect_issued_invoices`).

## Wie die App speichert

`lib/db/adapter.ts` definiert die Schnittstelle, `lib/db/local.ts` und `lib/db/supabase.ts`
implementieren sie. Die Oberfläche arbeitet auf einem Daten-Snapshot; nach jeder Änderung
überträgt der Supabase-Adapter nur die geänderten Datensätze (Upsert/Delete je Tabelle).

## Nächste Ausbaustufen

- **Team-Einladungen:** Einträge in `company_members` (Rolle `member`) über eine Edge Function mit Einladungs-Mail.
- **Logos in Supabase Storage** statt als Data-URL in `companies.logo`.
- **Tarife/Abrechnung:** `companies.plan` per Webhook (z. B. Stripe) mit dem Service-Role-Key setzen.
- **Belege (PDF/Fotos) zu Ausgaben** in Supabase Storage.
