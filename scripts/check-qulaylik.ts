/**
 * QULAYLIK QO'RIQCHISI — «bo'sh ekrandan chiqish yo'li bormi».
 *
 * 🔴 NEGA YOZILDI (2026-09-05). Egasi: «UI o'zgarishlari juda yaxshi
 * bo'lgan, lekin chiroy bor — qulaylik yo'qolgan». Sabab o'lchandi:
 * qayta bezashda NARSA KO'CHDI, unga olib boradigan YO'L esa eski
 * joyda qoldi. Bo'sh holatlar shuning eng ko'rinadigan ko'rinishi —
 * ekran «posilkangiz yo'q» deb yozadi va nima qilish kerakligini
 * AYTMAYDI.
 *
 * Ilovadagi juftligi — `tools/qulaylik_audit.py` (Flutter repo).
 * Ikkala mijozda BIR XIL qoida ishlaydi.
 *
 * ⚠️ HAR BO'SH HOLATGA TUGMA SHART EMAS. Bildirishnomani odam
 * «yaratmaydi» — u keladi; qidiruv formasi esa ba'zan aynan bo'sh
 * holatning ustida turadi. Sun'iy tugma — yolg'on va'da. Shuning
 * uchun istisno bor, lekin u chaqiruv YONIDA, sababi bilan yoziladi:
 *
 *     {/* qulaylik: chiqish yo'li SHART EMAS — <sabab> * / }
 *     <EmptyState ... />
 *
 * 🔑 Nega alohida «istisnolar ro'yxati» emas: uni hech kim o'qimaydi
 * va u eskiradi. Izoh esa kodning yonida turadi va sababni YOZIB
 * berishga majbur qiladi.
 *
 * ⚠️ JSX QAVSLARI SANALADI, `/>` bo'yicha kesilmaydi: `icon={<X />}`
 * ichidagi `/>` chaqiruvning oxiri EMAS. Birinchi yozuvda aynan shu
 * xato bo'lib, 12 ta bo'sh holatning hammasi «harakatsiz» ko'ringan
 * edi — aslida yettitasida tugma bor edi.
 *
 *   npx tsx scripts/check-qulaylik.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const EXEMPT = "qulaylik: chiqish yo'li SHART EMAS";

type Finding = { file: string; line: number };

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** `<EmptyState` dan boshlab teg oxirigacha — JSX qavslarini sanab. */
function callAt(text: string, start: number): string {
  let i = start;
  let depth = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (depth === 0 && ((c === '/' && text[i + 1] === '>') || c === '>')) break;
    i++;
  }
  return text.slice(start, i);
}

const dead: Finding[] = [];
let total = 0;
let exempt = 0;

for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8');
  const re = /<EmptyState\b/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    total++;
    const call = callAt(text, match.index + match[0].length);
    if (/\baction\s*=/.test(call)) continue;

    // Izoh TEG ICHIDA turadi (atributlar orasida). 🔴 Tegdan OLDIN
    // `{/* */}` yozib bo'lmaydi: ternar shoxida u ikkinchi bola bo'lib
    // qoladi va JSX buziladi — birinchi urinishda aynan shunday bo'lib,
    // `tsc` to'rtta faylni rad etdi. Oldingi qatorlar ham qaraladi:
    // ba'zi joyda izoh haqiqatan yuqorida tursa ham to'g'ri.
    const before = text.slice(0, match.index).split('\n').slice(-6).join('\n');
    if (call.includes(EXEMPT) || before.includes(EXEMPT)) {
      exempt++;
      continue;
    }
    dead.push({
      file: file.replace(`${process.cwd()}/`, ''),
      line: text.slice(0, match.index).split('\n').length,
    });
  }
}

console.log(
  `\nBo'sh holatlar: ${total} ta · yo'li BOR: ${total - dead.length - exempt} · ` +
    `sababi bilan ISTISNO: ${exempt} · YO'Q: ${dead.length}`
);
for (const f of dead) console.log(`  🔴 ${f.file}:${f.line}`);

if (dead.length) {
  console.error(
    `\n🔴 ${dead.length} ta bo'sh holat boshi berk. Yo tugma qo'shing, ` +
      `yo yoniga sababini yozing:\n   {/* ${EXEMPT} — <sabab> */}\n`
  );
  process.exit(1);
}
console.log('✅ boshi berk bo\'sh holat yo\'q\n');
