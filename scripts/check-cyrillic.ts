/**
 * KIRILL O'GIRGICHI QO'RIQCHISI.
 *
 * 🔴 NEGA YOZILDI (2026-09-08): o'girgich saytdagi BUTUN o'zbekcha
 * matnni o'giradi. Bitta qoida xato bo'lsa, xato bir vaqtda hamma
 * joyda ko'rinadi — va uni kirillda o'qimaydigan odam payqamaydi.
 *
 * Birinchi versiyada aynan shunday bo'ldi: «Buxoro» → «Бухорў». Sabab
 * JavaScript tuzog'i — `'abc'.includes('')` HAR DOIM `true`, ya'ni
 * so'z oxiridagi «o» apostrofli deb hisoblanardi. Buni faqat sayt
 * rasmini ko'z bilan ko'rganda payqadim; endi shu skript ushlaydi.
 *
 * ⚠️ Ilovadagi juftligi — `test/cyrillic_test.dart`. Qoida o'zgarsa
 * IKKALASI ham o'zgaradi, aks holda bir xil matn saytda va ilovada
 * boshqacha yoziladi.
 *
 * Ishlatish: `pnpm test:cyrillic` (pre-commit'da ham).
 */
import { toCyrillic } from '../src/shared/lib/cyrillic';

let failed = 0;
const check = (input: string, expected: string) => {
  const actual = toCyrillic(input);
  if (actual === expected) return;
  failed += 1;
  console.error(`❌ «${input}»: kutilgan «${expected}», olingan «${actual}»`);
};

// 1. Oddiy so'zlar va o'zbekka xos harflar.
check('safar', 'сафар');
check('hamroh', 'ҳамроҳ');
check('qidirish', 'қидириш');
check('haydovchi', 'ҳайдовчи');

// 2. 🔴 SO'Z OXIRI — birinchi versiyani sindirgan holat.
check('Buxoro', 'Бухоро');
check('Samarqand → Buxoro', 'Самарқанд → Бухоро');
check('tog', 'тог');

// 3. «yo'» — «ё» EMAS, y + o' = «йў».
check("yo'l", 'йўл');
check("yo'q", 'йўқ');
check("Yo'l-yo'lakay", 'Йўл-йўлакай');

// 4. o' va g'.
check("bo'sh", 'бўш');
check("to'g'ri", 'тўғри');
check("tog'", 'тоғ');

// 5. Digraflar va tutuq belgisi.
check('shahar', 'шаҳар');
check('uchrashuv', 'учрашув');
check("ma'no", 'маъно');
check("e'lon", 'эълон');

// 6. So'z boshidagi «e» → «э», o'rtada → «е».
check('ertaga', 'эртага');
check('kelmoq', 'келмоқ');

// 7. Saqlanadiganlar: brend, qisqartma, raqam, bitta harf.
check('YolYolakay', 'YolYolakay');
check('SMS kod', 'SMS код');
check('01 A 123 BC', '01 A 123 BC');
check('3 ta joy · 80 000', '3 та жой · 80 000');

// 8. Bosh harf va TO'LIQ KATTA yozuv (urg'u vositasi) saqlanadi.
check('Safar', 'Сафар');
check("BO'LMAYDI", 'БЎЛМАЙДИ');

// 9. Kirill matn ikkinchi marta o'girilmaydi.
check('Сафар қидириш', 'Сафар қидириш');

if (failed > 0) {
  console.error(`\n${failed} ta tekshiruv yiqildi.`);
  process.exit(1);
}
console.log('✅ Kirill o\'girgichi: 25 ta qoida — hammasi to\'g\'ri.');
