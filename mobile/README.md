# VYSNER One – native App (Android & iPhone)

Eigenständige App mit eigenen, nativen Bildschirmen (React Native / Expo SDK 57).
Sie lädt **nicht** die Website, sondern spricht direkt mit derselben Datenbank (Supabase) und rechnet
mit derselben Logik wie die Website: `scripts/sync-shared.js` übernimmt Datentypen, Berechnungen,
Belegarten, Tarife und den Datenbankzugriff aus `../lib` nach `src/shared/` (automatisch bei
`npm install`, Start und Build). Änderungen an dieser Logik also immer in `../lib` machen.

| | |
|---|---|
| App-ID (Android & iOS) | `com.vysnone.app` |
| Version | 1.0.0 (Build 1) – in `app.json` (`version`, `android.versionCode`, `ios.buildNumber`) |

## Funktionen
- **Anmelden** mit dem Konto von vysnone.com, **Firma wechseln**
- **Übersicht:** offene und überfällige Rechnungen, Monatsumsatz, offene Angebote, Mindestbestand, zuletzt bearbeitete Belege
- **Belege** (Angebote, Auftragsbestätigungen, Lieferscheine, Rechnungen, Bestellungen): anlegen, Kunde wählen,
  Positionen aus dem Material oder frei, Optional/Alternative (1.1), Festschreiben, Zahlung erfassen, Storno,
  Folgebelege, **PDF teilen** (Mail, WhatsApp …) und **drucken**
- **Kunden:** anlegen, bearbeiten, anrufen, E-Mail, Karte, Belege des Kunden
- **Material:** anlegen, bearbeiten, Lagerzugang/-entnahme, Bewegungen
- **Lager-Scanner:** QR-Etiketten der Website mit der Kamera scannen
- **KI-Sprachassistent** (Zusatzbuchung): Diktat mit der Spracherkennung des Geräts, Vorlesen
- Buchführung, Berichte, Design und Einstellungen öffnet die App auf vysnone.com

**Käufe:** Tarife und Zusatzbuchungen sind in der App nicht buchbar (Vorgabe von Apple/Google für digitale Abos);
die App zeigt nur den gebuchten Umfang.

## Entwickeln
```bash
cd mobile
npm install
npx expo run:android      # oder: npx expo run:ios (Mac)
npm run typecheck
```
`.env` enthält nur öffentliche Werte (Supabase-URL, Anon-Key, Website-Adresse).

## Android – Release bauen und in Google Play hochladen
Voraussetzungen: Java 17/21, Android SDK, Upload-Schlüssel `vysner-upload.jks` + `keystore.properties`
in `mobile/` (nie einchecken; das Plugin `plugins/with-release-signing.js` liest sie beim Build).
```bash
npm run build:android
# → android/app/build/outputs/bundle/release/app-release.aab  (Play Store)
# → android/app/build/outputs/apk/release/app-release.apk     (zum direkten Installieren)
```
Play Console: App anlegen → Produktion/Test → `app-release.aab` hochladen. Store-Eintrag, Datensicherheit,
Datenschutzerklärung (`https://vysnone.com/datenschutz`) und ein **Demo-Konto für die Prüfung** angeben.
Neue private Entwicklerkonten brauchen zuerst einen geschlossenen Test (12 Tester, 14 Tage).
Vor jedem Upload `android.versionCode` in `app.json` erhöhen.

## iPhone – ohne eigenen Mac über EAS (Expo)
```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios      # baut in der Cloud, fragt nach dem Apple-Entwicklerkonto
npx eas-cli@latest submit --platform ios     # lädt zu App Store Connect hoch
```
Voraussetzung: Apple-Developer-Programm (99 $/Jahr). Mit Mac alternativ `npx expo run:ios --configuration Release`
bzw. Archivieren in Xcode. In App Store Connect: Screenshots, Beschreibung, Datenschutzangaben,
Demo-Zugang und Hinweis „Konten und Tarife werden auf vysnone.com verwaltet; keine Käufe in der App“.

## Symbol und Startbild
`assets/images/` (aus `public/brand/vysner-mark.svg` erzeugt): `icon.png`, `android-icon-*.png`, `splash-icon.png`.
