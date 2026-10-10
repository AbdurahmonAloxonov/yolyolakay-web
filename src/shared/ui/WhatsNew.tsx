'use client';

import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import { Dialog } from '@/shared/ui/Dialog';
import { Button } from '@/shared/ui/Button';
import { useTr } from '@/shared/lib/useTr';

/**
 * «NIMA YANGILANDI?» — yangilanishdan keyin bir marta ko'rsatiladi.
 *
 * 🔴 NEGA KERAK: biz oylab funksiya qo'shamiz, foydalanuvchi esa ularni
 * tasodifan topadi yoki umuman topmaydi.
 *
 * ⚠️ FAQAT BIR MARTA: ko'rilgan versiya `localStorage` da. Har kirganda
 * chiqadigan oyna — reklama, funksiya emas.
 *
 * ⚠️ BIRINCHI TASHRIFDA CHIQMAYDI: yangi odamga "nima yangilandi" degan
 * ro'yxat hech nima aytmaydi — u hali eskisini ko'rmagan.
 *
 * `RELEASE` har relizda QO'LDA yangilanadi. Ro'yxat ODAM TILIDA:
 * "reply_to_id qo'shildi" degan qator foydalanuvchiga hech nima aytmaydi.
 */
const RELEASE = '2026-08-21';
const STORAGE_KEY = 'whats-new-seen';

export function WhatsNew() {
  const tr = useTr();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      const seen = window.localStorage.getItem(STORAGE_KEY);
      if (seen === null) {
        // Birinchi tashrif — belgilab qo'yamiz va ko'rsatmaymiz.
        window.localStorage.setItem(STORAGE_KEY, RELEASE);
        return;
      }
      if (seen !== RELEASE) setOpen(true);
    } catch {
      /* localStorage yopiq (private rejim) — oyna shunchaki chiqmaydi */
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, RELEASE);
    } catch {
      /* saqlanmasa keyingi safar yana chiqadi — bu xato emas */
    }
  };

  const items = [
    tr(
      "Safar boshlanganda «qancha qoldi» ko'rinadi",
      'Видно, сколько осталось до отправления',
      'See how long until departure'
    ),
    tr(
      'Uchrashuv joyini xaritadan tanlash',
      'Точку встречи можно выбрать на карте',
      'Pick the meeting point on the map'
    ),
    tr(
      "Safarni kalendarga qo'shish va xaritada ochish",
      'Поездку можно добавить в календарь и открыть на карте',
      'Add the ride to your calendar and open it on the map'
    ),
    tr(
      'Chatda tez javoblar va yozishmadan qidiruv',
      'Быстрые ответы и поиск в чате',
      'Quick replies and search in chat'
    ),
    tr('Natijalarni xaritada ko’rish', 'Результаты на карте', 'See results on the map'),
  ];

  return (
    <Dialog isOpen={open} onClose={close} title={tr('Nima yangilandi', 'Что нового', "What's new")}>
      <div className="space-y-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white">
          <Sparkles className="h-3 w-3" />
          {tr('YANGI', 'НОВОЕ', 'NEW')}
        </span>

        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={3} />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <Button className="w-full" onClick={close}>
          {tr('Yopish', 'Закрыть', 'Close')}
        </Button>
      </div>
    </Dialog>
  );
}
