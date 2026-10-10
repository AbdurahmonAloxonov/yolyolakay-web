'use client';

import React from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';
import { useTr } from '@/shared/lib/useTr';

/**
 * YORDAM — KIRISHDAN OLDIN HAM (egasi, 22.09.2026: «support'ni ham
 * ko'rinadigan joyga qo'yish kerak, masalan otpdan o'tmay qolsa ham
 * yoki xatolik bo'lsa ham supportga yozish uchun»).
 *
 * 🔴 NEGA KERAK: `SupportSheet` — ya'ni saytdagi yagona yordam yo'li —
 * FAQAT kirgan foydalanuvchida bor (profil sahifasida). Eng ko'p
 * yordamga muhtoj odam esa kira olmayotgan odam: SMS kelmagan, kod
 * eskirgan, hisob bloklangan. U bizga yozishning yo'lini topolmasdi.
 *
 * ⚠️ FORMA EMAS, TELEGRAM: `POST /helpdesk/tickets` token talab qiladi,
 * ya'ni kirmagan odamda 401 bo'lardi va u «yubordim» deb o'ylab
 * qolardi. Pochta esa hamon ishlamaydi (MX yozuvi sozlanmagan —
 * `shared/config/contacts.ts`).
 *
 * Ochilganda avval ENG KO'P UCHRAYDIGAN ikki holat tushuntiriladi:
 * ko'pchilik shu yerda hal qiladi va bizga yozishi ham shart emas.
 *
 * Mobil ilovadagi ayni yo'l: `features/support/support_entry.dart`.
 */
export const AuthSupportLink: React.FC<{ highlight?: boolean }> = ({ highlight = false }) => {
  const tr = useTr();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="mt-5 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        /* Xatodan KEYIN havola sokin kulrang yozuv bo'lib qolmasin:
           odam xato bilan yuzma-yuz turganda uni umuman payqamaydi. */
        className={`-my-2 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold transition-colors ${
          highlight ? 'text-accent' : 'text-text-muted hover:text-accent'
        }`}
      >
        <LifeBuoy className="h-4 w-4" />
        {highlight
          ? tr(
              'Kira olmayapsizmi? Yordam',
              'Не получается войти? Помощь',
              'Trouble signing in? Get help'
            )
          : tr('Yordam kerakmi?', 'Нужна помощь?', 'Need help?')}
      </button>

      {open && (
        <div className="mt-3 space-y-3 rounded-2xl border border-border bg-background/60 p-4">
          <p className="text-sm text-text-muted">
            {tr(
              'SMS odatda 1–2 daqiqada keladi. Kelmasa: raqamni tekshiring, tarmoq qoplamasiga chiqing va «Kodni qayta yuborish» ni bosing.',
              'SMS обычно приходит за 1–2 минуты. Если не пришла: проверьте номер, убедитесь в наличии сети и нажмите «Отправить код повторно».',
              'The SMS usually arrives within 1–2 minutes. If it does not: check the number, make sure you have signal and tap "Resend code".'
            )}
          </p>
          <p className="text-sm text-text-muted">
            {tr(
              "Kunlik kod limiti tugagan bo'lsa, parol bilan kirish mumkin.",
              'Если дневной лимит кодов исчерпан, можно войти по паролю.',
              'If the daily code limit is used up, you can sign in with a password.'
            )}
          </p>
          <a
            href={SUPPORT_TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            <Send className="h-4 w-4" />
            {tr("Qo'llab-quvvatlashga yozish", 'Написать в поддержку', 'Write to support')}
          </a>
        </div>
      )}
    </div>
  );
};
