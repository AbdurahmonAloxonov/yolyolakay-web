'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { useTr } from '@/shared/lib/useTr';

/**
 * Qaytarib bo'lmaydigan amal uchun tasdiq oynasi.
 *
 * 🔴 NEGA KERAK (egasi tasdiqladi, 2026-08-19): safarni bekor qilish,
 * posilkani bekor qilish va "yo'lovchi kelmadi" belgisi `window.confirm`
 * bilan so'ralardi. Uchta jiddiy kamchiligi bor edi:
 *
 *  1. U BRAUZERNIKI. Ilova ichida (Capacitor WebView) u xom Android
 *     tizim oynasi bo'lib chiqadi — brend yo'q, shrift boshqa, tugmalar
 *     "OK / Cancel" deb INGLIZCHA yoki qurilma tilida yoziladi. Uch tilli
 *     ilovada tasdiq tugmasining tili foydalanuvchi tilidan boshqa bo'lardi.
 *  2. TUGMALAR TENG og'irlikda. "OK" hech qanday ogohlantirish bermaydi —
 *     odam o'qimasdan bosadi.
 *  3. Uni STILLASH ham, testdan o'tkazish ham mumkin emas (Playwright uni
 *     alohida ushlashi kerak, brauzer esa uni bloklashi mumkin).
 *
 * Endi tasdiq — ilovaning O'Z oynasi: xavf rangi, tushunarli sarlavha va
 * "nima bo'ladi" izohi bilan. Tasdiq tugmasi AMALNI NOMLAYDI ("Safarni
 * bekor qilish"), "OK" emas — odam nimani tasdiqlayotganini tugmadan ham
 * biladi.
 *
 * ISHLATILISHI:
 * ```tsx
 * const { confirm, confirmDialog } = useConfirm();
 * ...
 * onClick={async () => {
 *   if (await confirm({ title: '...', description: '...', confirmLabel: '...' })) {
 *     mutation.mutate(id);
 *   }
 * }}
 * ...
 * {confirmDialog}
 * ```
 */
export interface ConfirmOptions {
  title: string;
  /** Nima bo'lishini AYTADI ("Haydovchilar uni boshqa ko'rmaydi"). */
  description: string;
  /** Tasdiq tugmasidagi matn — amalni nomlaydi, "OK" emas. */
  confirmLabel: string;
  /** `false` — oddiy tasdiq (xavf rangi ishlatilmaydi). */
  danger?: boolean;

  /**
   * Ixtiyoriy IZOH maydoni (masalan bekor qilish sababi).
   *
   * 🔴 ATAYIN MAJBURIY EMAS: shoshilinch holatda bekor qilishni matn
   * yozish TO'SIB QO'YMASLIGI kerak. Sabab foydali, lekin amalning
   * o'zidan muhimroq emas — ilovadagi qoida bilan bir xil.
   */
  promptLabel?: string;
  promptPlaceholder?: string;
}

export function useConfirm() {
  const tr = useTr();
  const [state, setState] = React.useState<{
    options: ConfirmOptions;
    resolve: (result: { ok: boolean; text: string }) => void;
  } | null>(null);
  const [text, setText] = React.useState('');

  const confirmWithText = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<{ ok: boolean; text: string }>((resolve) => {
        setText('');
        setState({ options, resolve });
      }),
    []
  );

  /** Eski shakl — faqat "ha/yo'q". Mavjud chaqiruvlar o'zgarmaydi. */
  const confirm = React.useCallback(
    (options: ConfirmOptions) => confirmWithText(options).then((r) => r.ok),
    [confirmWithText]
  );

  const close = (ok: boolean) => {
    state?.resolve({ ok, text: text.trim() });
    setState(null);
  };

  const confirmDialog = (
    <Dialog isOpen={state != null} onClose={() => close(false)} title={state?.options.title}>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          {state?.options.danger !== false && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error">
              <AlertTriangle className="h-5 w-5" />
            </span>
          )}
          <p className="text-sm leading-relaxed text-text-muted">{state?.options.description}</p>
        </div>

        {state?.options.promptLabel && (
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-text-muted">{state.options.promptLabel}</span>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={state.options.promptPlaceholder}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition-colors focus:border-accent"
            />
          </label>
        )}

        {/*
          Tugmalar tartibi: "Bekor qilish" CHAPDA va kuchsizroq, tasdiq esa
          o'ngda. Xavfli tugma o'ng chekkada — bosh barmoq eng oson yetadigan
          joyda EMAS, ya'ni tasodifan bosilishi qiyinroq.
        */}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => close(false)}>
            {tr('Bekor qilish', 'Отмена', 'Cancel')}
          </Button>
          <Button
            onClick={() => close(true)}
            className={
              state?.options.danger !== false
                ? '!bg-error hover:!bg-error/90 !text-white'
                : undefined
            }
          >
            {state?.options.confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );

  return { confirm, confirmWithText, confirmDialog };
}
