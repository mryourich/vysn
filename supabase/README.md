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
im Tarif `solo` (9,90 €) höchstens 50, `business` und `team` sind unbegrenzt (`plan_invoice_limit()`). Den Tarif setzt nur der Server (Service-Role, z. B. per Stripe-Webhook):
`update companies set plan = 'business' where id = '…';`

**Sicherheit:** Row Level Security auf allen Tabellen – Nutzer sehen ausschließlich Daten
der Firmen, in denen sie Mitglied sind. Firmen werden nur über `create_company()` angelegt,
der Tarif (`plan`) ist für Nutzer nicht änderbar. Festgeschriebene Rechnungen (Status ≠ Entwurf)
können inhaltlich weder geändert noch gelöscht werden (Trigger `protect_issued_invoices`).

## Tarife & Abrechnung (Stripe)

Migration `20261006090000_billing.sql` ergänzt `companies` um die Stripe-Felder
(`stripe_customer_id`, `subscription_status`, `trial_ends_at`, `current_period_end`, …) –
für Nutzer nur lesbar. Ablauf:

1. **Tarif & Abrechnung** in der App → Stripe Checkout (30 Tage kostenlos testen, einmal je Firma).
2. Stripe meldet jede Änderung an `/api/billing/webhook`; der Server setzt `plan` und Status
   mit dem geheimen Schlüssel (`SUPABASE_SERVICE_ROLE_KEY`).
3. Tarifwechsel, Zahlungsart, Rechnungen und Kündigung laufen über das Stripe-Kundenportal.
   Endet das Abo, fällt die Firma automatisch auf `start` zurück – Daten bleiben erhalten.

Webhook-Ereignisse: `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`, `checkout.session.completed`, `invoice.payment_failed`.
Variablen siehe `.env.example`.

## Team & Rechte

Migration `20261007090000_team.sql`: Im Tarif **Team** laden Inhaber und Admins bis zu 5 Personen
je Firma ein (inkl. offener Einladungen). Rollen:

| Rolle | Darf |
| --- | --- |
| `owner` (Inhaber) | alles, inkl. Rollen ändern, Sicherung einspielen, Firma löschen |
| `admin` | alles außer Rollen ändern und Firma löschen |
| `member` (Mitarbeiter) | Tagesgeschäft – keine Firmendaten, Design, Einstellungen, Tarif oder Team |

Einladungen (`company_invites`) sind 14 Tage gültig, nur einmal verwendbar und nur mit der
eingeladenen E-Mail-Adresse annehmbar (`accept_invite()`). Mitglieder werden ausschließlich über
die Funktionen `invite_member`, `revoke_invite`, `set_member_role`, `remove_member` verwaltet.
Endet der Tarif Team, hat nur noch der Inhaber Zugriff (`member_role()`); die Mitglieder bleiben
gespeichert. Mit SMTP verschickt `/api/team/invite-mail` den Link per E-Mail, sonst wird er kopiert.

## Monatslimits

Migration `20261010090000_usage_limits.sql`: Je Firma und Kalendermonat (Europe/Berlin) zählt
`usage_counters` jedes **neu angelegte** Element – Rechnungen, Angebote, Kunden, Artikel und
Buchungen. Löschen gibt nichts zurück. Limits (`plan_monthly_limit`): start 10, solo 50,
business/team unbegrenzt. Geprüft per Trigger `track_usage()`; erneut gesendete Datensätze
(gleiche id) zählen nicht. Dieselbe Migration schreibt `materials.stock` aus den
Lagerbewegungen fort (Client darf den Bestand nicht direkt setzen).

## Realtime

Migration `20261011090000_realtime.sql` nimmt die Firmentabellen in die Publikation
`supabase_realtime` auf. Realtime prüft RLS; Löschungen enthalten nur den Primärschlüssel.

## Rechte (wichtig bei neuen Tabellen)

Supabase vergibt per Standard alle Tabellenrechte an `anon` und `authenticated`. Migration
`20261009090000_harden_grants.sql` setzt sie auf das Nötige zurück (z. B. nur erlaubte Spalten von
`companies` änderbar, Mitglieder/Einladungen/Zähler nur über Funktionen). **Neue Tabellen** brauchen
daher immer RLS **und** passende `revoke`/`grant`-Zeilen in ihrer Migration.

## Wie die App speichert

`lib/db/adapter.ts` definiert die Schnittstelle, `lib/db/local.ts` und `lib/db/supabase.ts`
implementieren sie. Die Oberfläche arbeitet auf einem Daten-Snapshot; nach jeder Änderung
überträgt der Supabase-Adapter nur die geänderten Datensätze (Upsert/Delete je Tabelle).

## Nächste Ausbaustufen

- **Logos in Supabase Storage** statt als Data-URL in `companies.logo`.
- **Belege (PDF/Fotos) zu Ausgaben** in Supabase Storage.
