#!/usr/bin/env node
/**
 * INTERFEYS MATNIDA EMOJI BO'LMASIN.
 *
 * 🔴 NEGA (egasi, 2026-08-16: "saytda hamma filtrlarda emoji ishlatilgan,
 * uni ham ikonkalarga almashtirish kerak"):
 *
 *   1. Emoji QURILMAGA qarab boshqacha chiziladi — Samsung, iPhone va
 *      Windowsda uch xil ko'rinadi, eski Androidda esa umuman bo'sh
 *      kvadrat chiqadi. Interfeys biz ko'rgan holida ko'rinishiga
 *      kafolat yo'q.
 *   2. Emoji brend ranglariga bo'ysunmaydi: qulflangan filtrni so'nik
 *      qilib bo'lmaydi, to'q kartada esa u yorqin dog' bo'lib qoladi.
 *   3. Mobil ilovada bu allaqachon qoida (`design_system_test.dart`:
 *      «Text() ichida emoji yo'q — Material ikonkalari ishlatiladi»).
 *      Sayt ortda qolgan edi va 2026-08-16 da tenglashtirildi.
 *
 * IZOHLARDAGI belgilar (🔴 ✅ ⚠️) TEKSHIRILMAYDI — ular kodni o'qiyotgan
 * odam uchun, foydalanuvchi ularni ko'rmaydi.
 *
 * Ishga tushirish: `node scripts/check-emoji.mjs` (pre-commit da ham).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Piktogrammalar va belgilar. `→`, `↔`, `—` kabi TIPOGRAFIK belgilar
// ataylab kirmaydi: ular matnning bir qismi, ikonka emas.
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(tsx?|jsx?)$/.test(full) ? [full] : [];
  });

const problems = [];
for (const file of walk('src')) {
  const lines = readFileSync(file, 'utf8').split('\n');
  let inBlockComment = false;

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Blok izoh ichidamizmi — `/* ... */` va JSX `{/* ... */}`.
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false;
      return;
    }
    if (trimmed.startsWith('/*') || trimmed.startsWith('{/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true;
      return;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    // Qator OXIRIDAGI izohni kesamiz: `foo() // 🔴 sabab` — bu ham izoh.
    // `://` (havola) tegilmaydi, aks holda URL kesilib ketardi.
    const code = trimmed.replace(/(^|[^:])\/\/.*$/, '$1');

    if (EMOJI.test(code)) {
      problems.push(`${file}:${i + 1}  ${trimmed.slice(0, 100)}`);
    }
  });
}

if (problems.length > 0) {
  console.error(
    `\n❌ Interfeys matnida emoji topildi (${problems.length}):\n\n` +
      problems.map((p) => '   ' + p).join('\n') +
      '\n\n   Emoji o\'rniga lucide ikonkasidan foydalaning.\n' +
      '   Safar belgilari uchun tayyor manba: src/shared/ui/rideFeatures.tsx\n'
  );
  process.exit(1);
}

console.log('✔ Interfeys matnida emoji yo\'q');
