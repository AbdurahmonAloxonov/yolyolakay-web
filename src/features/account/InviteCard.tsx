'use client';

import React from 'react';
import { toast } from 'sonner';
import { Share2, Copy, Check } from 'lucide-react';
import { copyText, shareContent } from '@/shared/lib/share';
import { useTr } from '@/shared/lib/useTr';
import { useLocale } from 'next-intl';
import { getStoredUserId } from '@/shared/lib/token';
import { inviteLink } from '@/shared/lib/referral';

/**
 * DO'STNI CHAQIRISH.
 *
 * 🔴 NEGA KERAK: bugungi eng katta muammo texnik emas — bazada odam kam.
 * Yangi foydalanuvchi bo'sh qidiruv natijasini ko'radi va qaytmaydi.
 * O'sishning eng arzon kanali esa mavjud foydalanuvchining o'zi: u
 * tanishlariga aytadi. Ilovada 2026-08-25 dan beri bor, saytda YO'Q edi.
 *
 * ⚠️ Web Share API HAMMA joyda yo'q (ish stoli brauzerlarida odatda
 * yo'q). Shuning uchun nusxa olish HAR DOIM ishlaydigan zaxira sifatida
 * turadi — «ulashish» tugmasi jimgina ishlamay qolishi eng yomon holat
 * bo'lardi.
 *
 * 🔴 HAVOLADA ENDI KOD BOR (08.09.2026). Ilgari u oddiy
 * `yolyolakay.co.uz` edi — ya'ni odam ellikta tanishini chaqirsa ham
 * buni O'LCHAY olmasdik va rahmat ayta olmasdik. Kod — foydalanuvchi
 * id'sining birinchi 8 belgisi (izohi `shared/lib/referral.ts` da).
 */
export function InviteCard() {
  const tr = useTr();
  const locale = useLocale();
  const [copied, setCopied] = React.useState(false);

  /*
   * ⚠️ `useState`+`useEffect`, to'g'ridan o'qish EMAS: `getStoredUserId`
   * `localStorage` ga qaraydi va u serverda yo'q — birinchi chizishda
   * qiymat boshqacha bo'lib, hydration xatosi berardi.
   *
   * Id kelmasa havola KODSIZ qoladi: taklif ishlayveradi, faqat
   * hisobga olinmaydi. Bu «tugma umuman ishlamaydi» dan yaxshiroq.
   */
  const [userId, setUserId] = React.useState<string | null>(null);
  React.useEffect(() => setUserId(getStoredUserId()), []);

  const text = tr(
    "Shaharlararo yo'lga hamroh topadigan ilova — YolYolakay:",
    'Приложение, чтобы найти попутчика в междугородней поездке — YolYolakay:',
    'An app to find a travel companion for intercity trips — YolYolakay:'
  );
  const url = inviteLink(userId, locale);
  const full = `${text}\n${url}`;

  const copy = async () => {
    if (await copyText(full)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(tr('Nusxa olindi', 'Скопировано', 'Copied'));
    } else {
      toast.error(tr('Nusxa olinmadi', 'Не удалось скопировать', 'Could not copy'));
    }
  };

  const share = async () => {
    // Ulashish oynasi bo'lmasa yoki rad etsa — nusxaga o'tadi, tugma jim qolmaydi.
    const result = await shareContent({ title: 'YolYolakay', text, url });
    if (result === 'copied') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(tr('Nusxa olindi', 'Скопировано', 'Copied'));
    } else if (result === 'failed') {
      toast.error(tr('Nusxa olinmadi', 'Не удалось скопировать', 'Could not copy'));
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-turquoise/40 bg-turquoise-light/40 p-5 dark:bg-turquoise/10">
      <div className="space-y-1">
        <h3 className="text-sm font-extrabold text-text">
          {tr("Do'stni chaqirish", 'Пригласить друга', 'Invite a friend')}
        </h3>
        <p className="text-sm text-text-muted">
          {tr(
            "Hamroh toping, xarajatni bo'ling — qancha odam ko'p bo'lsa, yo'nalishlar shuncha ko'p",
            'Найдите попутчика, разделите расходы — чем больше людей, тем больше маршрутов',
            'Find a companion, share the cost — the more people, the more routes'
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void share()}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          {tr('Ulashish', 'Поделиться', 'Share')}
        </button>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-text transition-colors hover:border-accent"
        >
          {copied ? (
            <Check className="h-4 w-4 text-accent" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
          {tr('Havolani nusxalash', 'Скопировать ссылку', 'Copy link')}
        </button>
      </div>
    </section>
  );
}
