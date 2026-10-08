/**
 * Übernimmt die gemeinsame Logik der Website (Datentypen, Berechnungen, Belegarten,
 * Tarife, Datenbank-Zugriff) nach src/shared/ – die App rechnet damit exakt wie die Website.
 * Läuft automatisch nach `npm install` sowie vor Start und Build.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', 'lib');
const out = path.resolve(__dirname, '..', 'src', 'shared');
const FILES = [
  'types.ts', 'calc.ts', 'docs.ts', 'defaults.ts', 'plans.ts', 'tax.ts',
  'db/mappers.ts', 'db/ops.ts', 'db/adapter.ts', 'db/supabase.ts',
];

fs.rmSync(out, { recursive: true, force: true });
for (const file of FILES) {
  const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/^'use client';\s*/m, '');
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `// Automatisch übernommen aus lib/${file} – hier nicht bearbeiten (npm run sync-shared)\n${src}`);
}
console.log(`sync-shared: ${FILES.length} Dateien aus lib/ übernommen`);
