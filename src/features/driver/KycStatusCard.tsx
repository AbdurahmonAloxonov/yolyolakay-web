'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

import { useTr } from '@/shared/lib/useTr';

/**
 * Shaxsni tasdiqlash holati — kutilmoqda / tasdiqlandi / rad etildi.
 *
 * 🔴 NEGA KERAK: `kyc_status` backendda anchadan beri bor edi, lekin
 * hech qayerda ko'rsatilmasdi. Odam hujjat suratlarini yuborardi va keyin
 * jimlik — "yubordimmi o'zi, kutayapmanmi yoki rad etilganmi" degan
 * savolga saytda javob YO'Q edi. `ApplicationStatus` MASHINANING holatini
 * ko'rsatadi, bu esa ODAMNIKINI.
 *
 * 🔑 Holatlar RUXSAT ro'yxati bilan tekshirilmaydi (loyiha qoidasi:
 * `status-ruxsat-royxati` xotirasi): backend yangi nom qo'shsa oq ro'yxat
 * uni jimgina yashirib qo'yardi. Shuning uchun teskarisi — faqat "hech
 * narsa yo'q" holatlari yashiriladi, noma'lum holat "tekshiruvda" deb
 * ko'rsatiladi.
 */
export function KycStatusCard({
  status,
  reason,
  locale,
  showRetry = true,
}: {
  status?: string;
  /** Modarator yozgan SABAB (`kyc_rejection_reason`) — bo'lmasligi mumkin. */
  reason?: string | null;
  locale: string;
  /**
   * "Qaytadan yuborish" havolasi. Ariza FORMASINING o'zida `false`:
   * odam allaqachon o'sha sahifada turadi va havola uni o'ziga olib
   * boradigan o'lik tugmaga aylanadi.
   */
  showRetry?: boolean;
}) {
  const tr = useTr();
  const s = String(status ?? '')
    .trim()
    .toLowerCase();
  // Bo'sh satr ham "sabab yo'q" demakdir — backend `""` qaytarishi mumkin.
  const reasonText = String(reason ?? '').trim();

  // Ariza umuman berilmagan — banner ko'rsatilmaydi.
  if (!s || s === 'none' || s === 'not_started') return null;

  const approved = s === 'approved' || s === 'verified' || s === 'accepted';
  const rejected = s === 'rejected' || s === 'declined' || s === 'failed';

  const tone = rejected
    ? 'border-rose-300 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10'
    : approved
      ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10'
      : 'border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10';

  const iconTone = rejected
    ? 'text-rose-600 dark:text-rose-400'
    : approved
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-amber-600 dark:text-amber-400';

  const Icon = rejected ? XCircle : approved ? CheckCircle2 : Clock;

  const title = rejected
    ? tr('Hujjatlar qabul qilinmadi', 'Документы не приняты', 'Documents were not accepted')
    : approved
      ? tr('Shaxsingiz tasdiqlandi', 'Личность подтверждена', 'Identity verified')
      : tr(
          'Hujjatlaringiz tekshirilmoqda',
          'Ваши документы на проверке',
          'Your documents are under review'
        );

  // Rad etilganda: modarator SABAB yozgan bo'lsa TAXMIN qilmaymiz. Eski
  // matn ("ko'pincha xira surat") faqat sabab kelmagan holat uchun qoladi.
  const hint = rejected
    ? reasonText
      ? tr(
          'Qaytadan yuborishdan oldin quyidagini tuzating:',
          'Перед повторной отправкой исправьте следующее:',
          'Fix the following before submitting again:'
        )
      : tr(
          "Ko'pincha sabab — xira surat yoki kesilgan burchak. Qaytadan yuborsangiz bo'ladi.",
          'Чаще всего причина — размытое фото или обрезанный угол. Можно отправить заново.',
          'Usually the reason is a blurry photo or a cut-off corner. You can submit again.'
        )
    : approved
      ? tr(
          "Yo'lovchilar buni profilingizda ko'radi.",
          'Пассажиры видят это в вашем профиле.',
          'Passengers can see this on your profile.'
        )
      : tr(
          "Odatda bir ish kuni ichida javob beramiz. Tayyor bo'lgach xabar qilamiz.",
          'Обычно отвечаем в течение одного рабочего дня. Сообщим, как будет готово.',
          'We usually reply within one business day. We will let you know.'
        );

  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconTone}`} />
        <div className="min-w-0">
          <p className="text-text text-sm font-extrabold">{title}</p>
          <p className="text-text-muted mt-0.5 text-xs leading-relaxed">{hint}</p>
          {/* Modaratorning O'Z matni — bizning maslahatimizdan AJRATIB
              ko'rsatiladi, chunki bu taxmin emas, aniq talab. `break-words`
              kerak: matnni modarator yozadi, uzunligi bizga bog'liq emas. */}
          {rejected && reasonText && (
            <p className="text-text mt-2 rounded-xl border border-rose-300 bg-white/70 px-3 py-2 text-xs leading-relaxed font-semibold break-words dark:border-rose-500/40 dark:bg-white/5">
              {reasonText}
            </p>
          )}
          {/* Rad etilganda — CHIQISH YO'LI. Sababsiz "rad etildi" degan
              yozuv odamni boshi berk ko'chaga olib kiradi. */}
          {rejected && showRetry && (
            <Link
              href={`/${locale}/driver/onboarding`}
              className="text-text mt-2 inline-flex items-center rounded-xl border border-rose-300 bg-white/70 px-3 py-1.5 text-xs font-bold dark:border-rose-500/40 dark:bg-white/5"
            >
              {tr('Qaytadan yuborish', 'Отправить заново', 'Submit again')}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
