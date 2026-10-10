'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Phone, X } from 'lucide-react';
import { useTr } from '@/shared/lib/useTr';
import { reverseGeocode } from '@/shared/lib/geo';
import { PointPreview } from '@/shared/ui/PointPreview';

/**
 * SOS — faol safarda favqulodda yordam. BITTA amal: 102 ga qo'ng'iroq.
 *
 * 🔴 2026-08-16 da SODDALASHTIRILDI (egasi: "SOS'da 102 qolsin, boshqa narsa
 * qolmasin"). Ilgari bu yerda "ishonchli shaxsga joylashuv SMS" oqimi ham bor
 * edi: ism/raqam kiritish, localStorage'ga saqlash, geolokatsiya kutish.
 * Favqulodda holatda odam forma to'ldirmaydi — har qo'shimcha qadam
 * qo'ng'iroqni KECHIKTIRADI, ya'ni SOSning o'zini zaiflashtiradi.
 *
 * Backend YO'Q va kerak emas: `tel:` havolasi internet uzilganda ham ishlaydi.
 *
 * Tasdiq oynasi ATAYIN qoldirilgan — tugma safar sahifasida turadi va tasodifiy
 * bosilsa to'g'ridan-to'g'ri militsiyaga qo'ng'iroq ketib qolardi.
 *
 * ═══ «MEN QAYERDAMAN» — 16.09.2026 ═══
 *
 * 🔴 NEGA QO'SHILDI: 102 ga qo'ng'iroq qilganda BIRINCHI so'raladigan savol
 * — «qayerdasiz?». Shaharlararo yo'lda odam bunga javob bera olmaydi:
 * atrofda belgi yo'q. Bu oynada esa koordinata UMUMAN yo'q edi.
 *
 * ⚠️ EGASINING QARORI BUZILMADI (2026-08-16: «SOS'da 102 qolsin»).
 * Qo'ng'iroq havolasi TEPADA, birinchi va o'zgarmagan — u geolokatsiyani
 * KUTMAYDI. Joy PASTDA, mustaqil ravishda aniqlanadi: kelsa ko'rinadi,
 * kelmasa oyna o'sha-o'sha ishlayveradi. Ilovada ham AYNAN shunday.
 */
export function SosButton() {
  const tr = useTr();
  const [open, setOpen] = useState(false);

  /** Joriy joy — qo'ng'iroqni kutib turmaydi, fon'da aniqlanadi. */
  const [me, setMe] = useState<[number, number] | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (cancelled) return;
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setMe([lat, lon]);
        // Nom IKKINCHI qadam: u tarmoqqa chiqadi va bo'lmasligi mumkin.
        // Koordinata esa allaqachon ekranda — u tarmoqsiz ham foydali.
        const name = await reverseGeocode(lat, lon).catch(() => '');
        if (!cancelled && name) setAddress(name);
      },
      () => {
        // Ruxsat berilmadi yoki aniqlanmadi — oyna o'z ishini qilaveradi.
        // Favqulodda oynani xato xabari bilan to'ldirmaymiz.
      },
      { enableHighAccuracy: true, timeout: 20000 }
    );
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-error/30 bg-error/10 px-4 py-2.5 text-sm font-extrabold text-error hover:bg-error/20 transition-colors"
      >
        <ShieldAlert className="h-4.5 w-4.5" />
        SOS
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-error">
                <ShieldAlert className="h-5 w-5" /> SOS
              </h3>
              <button type="button" onClick={() => setOpen(false)} className="text-text-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            <a
              href="tel:102"
              className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-error px-4 py-3 text-base font-extrabold text-white hover:opacity-90 transition-opacity"
            >
              <Phone className="h-5 w-5" />
              {tr("102 ga qo'ng'iroq", 'Позвонить 102', 'Call 102')}
            </a>

            {/* ─── MEN QAYERDAMAN (qo'ng'iroqdan KEYIN, uni kutmasdan) ─── */}
            <div className="space-y-2">
              <h4 className="text-sm font-extrabold text-foreground">
                {tr('Men qayerdaman', 'Где я нахожусь', 'Where I am')}
              </h4>
              {me ? (
                <>
                  <PointPreview lat={me[0]} lon={me[1]} height={130} />
                  {/* Koordinata O'QIB BERISH uchun ham yoziladi: telefonda
                      dispecherga aynan shu raqamlarni aytish mumkin.
                      `select-text` — chat/safar sahifalarida tanlash
                      o'chirilgan, bu yerda esa u SHART. */}
                  <p className="select-text text-xs font-bold leading-snug text-text-muted">
                    {address ? `${address} · ` : ''}
                    {me[0].toFixed(5)}, {me[1].toFixed(5)}
                  </p>
                </>
              ) : (
                // Aniqlanayotgani AYTILADI: bo'sh joy «buzilgan» ko'rinardi.
                <p className="text-xs font-bold text-text-muted">
                  {tr(
                    'Joylashuv aniqlanmoqda...',
                    'Определяем местоположение...',
                    'Finding your location...'
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
