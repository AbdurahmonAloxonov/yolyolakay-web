/**
 * TARTIB QO'RIQCHISI — tor ekranda kesilib ketadigan ikkita naqshni tutadi.
 *
 * 🔴 NEGA YOZILDI (2026-09-03). Egasi: «responsivlik yo'q, hamma
 * narsani aralashtirib qo'ygansan». Prod build ishga tushirilib, 390 px
 * da har bir element o'lchanganda UCHTA joy ekrandan chiqib turgani
 * aniqlandi — panelda safar kartochkalari 9 px, profilda parol kartasi
 * 29 px, bildirishnomalarda tugma 2 px. Uchalasining ildizi bitta edi
 * va u KODNI O'QIB ko'rinmasdi.
 *
 * 1. `grid ... lg:grid-cols-2` — tor ekran uchun ustun berilmagan.
 *    Brauzer bunda `auto` ustun yasaydi, `auto` esa ENG UZUN
 *    BO'LINMAYDIGAN matn qadar kengayadi. Ro'yxatda bitta
 *    `Mozilla/5.0 (X11; Linux…)` satri bo'lsa — butun ustun, ya'ni
 *    YONIDAGI KARTALAR HAM ekrandan chiqadi. `grid-cols-1`
 *    (`minmax(0,1fr)`) muammoni ildizi bilan yo'q qiladi.
 *
 * 2. `truncate` + `flex-1`, lekin zanjirda `min-w-0` yo'q. `truncate`
 *    `white-space: nowrap` degani: `min-w-0` bo'lmasa element
 *    qisqarmaydi, uzun matn esa qo'shnilarini surib chiqaradi.
 *
 * Ilovadagi juftligi — `test/ui_narrow_audit_test.dart`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.tsx')) files.push(p);
  }
};
walk('src');

const problems: string[] = [];
const CLASS = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(CLASS)) {
      const cls = (m[1] ?? m[2] ?? '').replace(/\$\{[^}]*\}/g, ' ');
      const toks = cls.split(/\s+/).filter(Boolean);
      if (!toks.includes('grid')) continue;
      if (toks.some((t) => t.startsWith('grid-cols-') || t.startsWith('grid-flow-'))) continue;
      if (!toks.some((t) => /^(sm|md|lg|xl|2xl):grid-cols-/.test(t))) continue;
      problems.push(
        `${file}:${i + 1} — setkada tor ekran uchun ustun yo'q. ` +
          `\`grid\` yoniga \`grid-cols-1\` qo'shing (aks holda ustun eng uzun ` +
          `bo'linmaydigan matn qadar kengayadi va kartalar ekrandan chiqadi).`
      );
    }
  });
}

if (problems.length) {
  console.error('❌ Tartib qo\'riqchisi:');
  for (const p of problems) console.error('   ' + p);
  process.exit(1);
}
console.log(`✅ Tartib: ${files.length} faylda ustunsiz setka yo'q.`);
