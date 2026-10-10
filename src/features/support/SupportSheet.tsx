'use client';

import React from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSupportTicket,
  getSupportTickets,
  supportTechnicalContext,
} from '@/shared/api/support';
import { SUPPORT_TELEGRAM_URL } from '@/shared/config/contacts';
import { useTr } from '@/shared/lib/useTr';
import { Button } from '@/shared/ui/Button';

/**
 * Ilova ichidagi qo'llab-quvvatlash murojaati.
 *
 * 🔴 NEGA KERAK: ilgari "Yordam" havolasi TO'G'RIDAN Telegramga olib
 * chiqardi. Ikki muammosi bor edi:
 *   1. odam saytdan chiqib ketardi va ko'pincha qaytmasdi;
 *   2. operator "qaysi brauzer, qaysi sahifada?" deb so'rashi kerak edi —
 *      odam esa bilmaydi yoki yozmaydi.
 * Endi sayt texnik ma'lumotni O'ZI qo'shadi.
 *
 * 🔴 TELEGRAM OLIB TASHLANMADI: shoshilinch holatda (yo'lda, hodisa
 * bo'lganda) odam forma to'ldirmaydi. Shu sabab u oyna tepasida turadi.
 *
 * ✅ 2026-08-16 KECHQURUN: backend operator javobi maydonini qo'shdi,
 * shuning uchun javob endi SHU YERDA ko'rinadi — «Murojaatlarim»
 * ro'yxatida. Ilgari "javob Telegram orqali keladi" deb uzr so'ralardi.
 *
 * Mobil ilovada ayni oyna: `features/support/support_sheet.dart`.
 */
export const SupportSheet: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const tr = useTr();
  const [topic, setTopic] = React.useState<string | null>(null);
  const [text, setText] = React.useState('');
  const [sent, setSent] = React.useState(false);
  /** Ro'yxat ko'rinishimi (aks holda yangi murojaat formasi). */
  const [showList, setShowList] = React.useState(false);

  const tickets = useQuery({
    queryKey: ['support-tickets'],
    enabled: open && showList,
    queryFn: getSupportTickets,
  });

  const topics = [
    { key: 'complaint', label: tr('Shikoyat', 'Жалоба', 'Complaint') },
    { key: 'accident', label: tr("Yo'l hodisasi", 'ДТП', 'Road accident') },
    { key: 'lost', label: tr('Unutilgan buyum', 'Забытые вещи', 'Lost item') },
    { key: 'payment', label: tr("To'lov", 'Оплата', 'Payment') },
    { key: 'other', label: tr('Boshqa', 'Другое', 'Other') },
  ];

  const mutation = useMutation({
    mutationFn: () =>
      createSupportTicket({
        // Mavzu tanlanmagan bo'lsa "Boshqa" — majburiy qilish odamni
        // to'xtatadi, holbuki matnning o'zi baribir hammasini aytadi.
        subject: (topics.find((x) => x.key === topic) ?? topics[topics.length - 1]).label,
        description: `${text.trim()}\n\n${supportTechnicalContext()}`,
      }),
    onSuccess: () => setSent(true),
    onError: () =>
      toast.error(
        tr(
          'Murojaat yuborilmadi. Qayta urining yoki Telegramda yozing',
          'Не удалось отправить. Попробуйте ещё раз или напишите в Telegram',
          'Could not send. Try again or write on Telegram'
        )
      ),
  });

  if (!open) return null;

  const close = () => {
    onClose();
    // Keyingi ochilishda toza forma bo'lsin.
    setTimeout(() => {
      setSent(false);
      setText('');
      setTopic(null);
    }, 200);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={close}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-border bg-surface p-6 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-display font-black text-foreground">
            {tr('Yordam', 'Помощь', 'Help')}
          </h3>
          <div className="flex items-center gap-2">
            {/* ✅ Murojaat tarixi — backend javob maydonini qo'shgach
                ma'noga ega bo'ldi (ilgari ko'rsatadigan javob yo'q edi). */}
            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              /* ⚠️ Bosiladigan maydon 44 px (o'lchov 2026-09-04). */
              className="inline-flex min-h-11 items-center text-xs font-bold text-accent hover:underline"
            >
              {showList
                ? tr('Yangi murojaat', 'Новое обращение', 'New request')
                : tr('Murojaatlarim', 'Мои обращения', 'My requests')}
            </button>
            <button type="button" onClick={close} className="text-text-muted">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {showList ? (
          <div className="mt-5 space-y-3">
            {tickets.isLoading && (
              <p className="text-sm text-text-muted">
                {tr('Yuklanmoqda...', 'Загрузка...', 'Loading...')}
              </p>
            )}
            {tickets.isError && (
              <p className="text-sm font-bold text-error">
                {tr(
                  'Murojaatlar yuklanmadi',
                  'Не удалось загрузить обращения',
                  'Could not load your requests'
                )}
              </p>
            )}
            {tickets.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-text-muted">
                {tr("Murojaat yo'q", 'Обращений нет', 'No requests yet')}
              </p>
            )}
            {tickets.data?.map((ticket) => {
              const answered = !!ticket.resolution?.trim();
              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl border p-4 ${
                    answered ? 'border-accent/30 bg-accent/5' : 'border-border bg-bg/50'
                  }`}
                >
                  <p className="text-sm font-extrabold text-text">{ticket.subject}</p>
                  {/* Texnik ma'lumot matn OXIRIGA qo'shiladi — u operator
                      uchun, odamga ko'rsatishning ma'nosi yo'q. */}
                  <p className="mt-1 line-clamp-3 text-xs text-text-muted">
                    {ticket.description.split('--- texnik')[0].trim()}
                  </p>
                  {answered ? (
                    <div className="mt-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-accent">
                        {tr('Javob', 'Ответ', 'Reply')}
                      </p>
                      <p className="text-sm text-text">{ticket.resolution}</p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs font-bold text-text-muted">
                      {tr('Javob kutilmoqda', 'Ожидает ответа', 'Awaiting a reply')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : sent ? (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 shrink-0 text-accent" />
              <p className="text-base font-extrabold text-text">
                {tr('Murojaat yuborildi', 'Обращение отправлено', 'Your request was sent')}
              </p>
            </div>
            {/* Haqiqatni aytamiz: yozishma sayt ichida YO'Q. */}
            <p className="rounded-2xl bg-warning/10 p-4 text-sm text-text">
              {tr(
                "Javobni shu yerda, «Murojaatlarim» bo'limida ko'rasiz. Shoshilinch bo'lsa Telegramda yozing.",
                'Ответ увидите здесь, в разделе «Мои обращения». Если срочно — напишите в Telegram.',
                'You will see the reply here, in "My requests". If it is urgent, write on Telegram.'
              )}
            </p>
            <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer">
              <Button className="w-full">
                {tr('Telegramda yozish', 'Написать в Telegram', 'Write on Telegram')}
              </Button>
            </a>
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Shoshilinch yo'l TEPADA: hodisa bo'lganda odam formani o'qimaydi. */}
            <a
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-2xl border border-accent/40 bg-accent/5 px-4 py-2.5 text-sm font-bold text-accent hover:bg-brand-pink-light dark:hover:bg-accent/10 transition-colors"
            >
              <Zap className="h-4 w-4" />
              {tr(
                'Shoshilinch — Telegramda yozish',
                'Срочно — написать в Telegram',
                'Urgent — write on Telegram'
              )}
            </a>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                {tr('Mavzu', 'Тема', 'Subject')}
              </p>
              <div className="flex flex-wrap gap-2">
                {topics.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTopic(topic === key ? null : key)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
                      topic === key
                        ? 'border-accent bg-accent text-white'
                        : 'border-border bg-bg text-text-muted hover:text-text'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">
                {tr("Nima bo'ldi?", 'Что случилось?', 'What happened?')}
              </p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={tr(
                  "Iloji boricha aniq yozing: qachon, qaysi safarda, nima kutgan edingiz va nima bo'ldi.",
                  'Опишите как можно точнее: когда, в какой поездке, чего вы ожидали и что произошло.',
                  'Describe it as precisely as you can: when, on which ride, what you expected and what happened.'
                )}
                className="w-full rounded-2xl border border-border bg-bg p-3 text-sm text-text placeholder:text-text-muted"
              />
            </div>

            <Button
              className="w-full"
              isLoading={mutation.isPending}
              disabled={mutation.isPending}
              onClick={() => {
                if (!text.trim()) {
                  toast.error(
                    tr("Nima bo'lganini yozing", 'Опишите, что случилось', 'Describe what happened')
                  );
                  return;
                }
                mutation.mutate();
              }}
            >
              {tr('Yuborish', 'Отправить', 'Send')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
