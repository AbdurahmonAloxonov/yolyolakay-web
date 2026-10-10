'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

/**
 * TORTIB YANGILASH — «yo'l g'ildiragi».
 *
 * 🔴 NEGA KERAK: `globals.css` da `body { overscroll-behavior: none }` turadi
 * (rezina sakrashni to'sish uchun) — u brauzerning O'Z tortib-yangilashini ham
 * o'chiradi. PWA standalone rejimida esa manzil paneli ham, yangilash tugmasi
 * ham ko'rinmaydi. Ya'ni telefonda ochilgan saytda sahifani yangilashning
 * hech qanday yo'li qolmagan edi: ma'lumot eskirsa odam ilovani yopib qayta
 * ochardi.
 *
 * NEGA STANDART SPINNER EMAS: aylanma yoy har ilovada bor va brendga hech
 * narsa qo'shmaydi. Bu yerdagi belgi ikkita brend qatlamdan yig'ilgan —
 * tashqarisi PUNKTIR YO'L CHIZIG'I (loyihaning nomi ham "yo'l-yo'lakay"),
 * ichkarisi SUZANI ROZETKASI (`SuzaniBloom`, `OrnamentMark`, `GirihPattern`
 * bilan bir oila). Tortilgan sari yo'l halqasi yig'iladi va rozetka barglari
 * birma-bir ochiladi; qo'yib yuborilganda butun belgi g'ildirakdek aylanadi.
 *
 * QOIDALARGA MOSLIGI:
 *  • harakat faqat `transform`/`opacity`/`scale` (va `stroke-dashoffset` —
 *    u ham layout emas, faqat paint);
 *  • progress CSS'da `--p` o'zgaruvchisi orqali hisoblanadi, React har
 *    barmoq kadrida QAYTA CHIZILMAYDI (qiymat `ref` orqali to'g'ridan-to'g'ri
 *    yoziladi);
 *  • cheksiz aylanish FAQAT so'rov ketayotganda — javob kelishi bilan
 *    to'xtaydi;
 *  • `prefers-reduced-motion` da global qoida animatsiyani o'chiradi,
 *    imora esa baribir ko'rinadi (holat yo'qolmaydi).
 *
 * QAYERDA ISHLAYDI: `layout.tsx` da bir marta ulanadi — ya'ni HAMMA sahifada.
 * Alohida ro'yxatlarga ulash kerak emas va yangi sahifa qo'shilganda unutilmaydi.
 */

/** Barmoq shu masofani bosib o'tsa — qo'yib yuborilganda yangilanadi. */
const THRESHOLD = 72;
/** Undan nariga tortilmaydi: cheksiz cho'zilish "sindirilgan" his beradi. */
const MAX_PULL = 116;
/** Qarshilik: barmoq 2 px yursa imora 1 px tushadi — tortish "og'ir" tuyuladi. */
const RESISTANCE = 2;
/** So'rov juda tez tugasa ham imora ko'rinib ulgursin. */
const MIN_SPIN_MS = 550;

type Phase = 'idle' | 'pull' | 'refresh' | 'done';

export const PullToRefresh: React.FC = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const hostRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [phase, setPhase] = React.useState<Phase>('idle');
  // Faza `ref`da ham saqlanadi: hodisa ishlovchilari bir marta ulanadi va
  // ular ichida `phase` state'ining ESKI qiymati qolib ketardi. Yozish
  // FAQAT `apply` orqali — render paytida ref'ga tegilmaydi.
  const phaseRef = React.useRef<Phase>('idle');

  React.useEffect(() => {
    /** Fazani state'ga ham, ref'ga ham bir joyda yozadi. */
    const apply = (next: Phase) => {
      phaseRef.current = next;
      setPhase(next);
    };

    let startY = 0;
    let startX = 0;
    /** Barmoq qo'yildi va boshlang'ich holat mos: yo'nalish hali NOMA'LUM. */
    let tracking = false;
    /** Yo'nalish vertikal deb tan olindi — endi sahifani ushlaymiz. */
    let pulling = false;
    let distance = 0;

    /** Imora holatini DOM'ga yozadi (React render'siz). */
    const paint = (px: number) => {
      const host = hostRef.current;
      const svg = svgRef.current;
      if (!host || !svg) return;
      host.style.transform = `translate3d(-50%, ${px}px, 0)`;
      host.style.opacity = String(Math.min(1, px / 28));
      svg.style.setProperty('--p', String(Math.min(1, px / THRESHOLD)));
      // Rozetka tortilgan sari sekin buriladi — barmoq harakati bilan bog'liqlik shundan seziladi.
      svg.style.rotate = `${(px / THRESHOLD) * 140}deg`;
    };

    /**
     * Barmoq ostidagi eng yaqin O'Z scroll'i bor ota-element tepasidami?
     * Bo'lmasa — gorizontal karusel yoki ichki ro'yxat ichida tortilgan bo'ladi
     * va biz aralashmaymiz.
     */
    const atTop = (target: EventTarget | null): boolean => {
      let el = target instanceof Element ? target : null;
      while (el && el !== document.body) {
        const style = getComputedStyle(el);
        const scrollsY = /(auto|scroll|overlay)/.test(style.overflowY);
        if (scrollsY && el.scrollHeight > el.clientHeight) {
          return el.scrollTop <= 0;
        }
        // Kiritish maydonlari va xarita — ularda tortish o'z ma'nosiga ega.
        if (el.hasAttribute('data-no-ptr')) return false;
        el = el.parentElement;
      }
      return window.scrollY <= 0;
    };

    const onStart = (e: TouchEvent) => {
      if (phaseRef.current === 'refresh' || e.touches.length !== 1) return;
      if (!atTop(e.target)) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      tracking = true;
      pulling = false;
      distance = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || phaseRef.current === 'refresh') return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      // YO'NALISH FILTRI. Usiz sahifa tepasidagi gorizontal ro'yxat
      // (masalan sana chiplari) surilganda ham `preventDefault` ishlab,
      // gorizontal surish "yopishib" qolardi: barmoq yonga ketsa ham biz
      // uni tortish deb hisoblardik.
      if (!pulling) {
        if (Math.abs(dx) > Math.abs(dy)) {
          tracking = false; // gorizontal harakat — aralashmaymiz
          return;
        }
        // Bir necha piksellik tebranish hali "tortish" emas (tasodifiy
        // bosishlar imorani chaqirib yubormasin).
        if (dy < 8) return;
        pulling = true;
      }

      if (dy <= 0) {
        // Yuqoriga surildi — bu oddiy scroll, imorani yig'amiz.
        if (distance > 0) {
          distance = 0;
          paint(0);
          apply('idle');
        }
        tracking = false;
        pulling = false;
        return;
      }
      distance = Math.min(MAX_PULL, dy / RESISTANCE);
      // Sahifa o'zi ham surilib ketmasin (ikki harakat bir vaqtda ko'rinmasin).
      if (e.cancelable) e.preventDefault();
      if (phaseRef.current !== 'pull') apply('pull');
      paint(distance);
    };

    const onEnd = () => {
      const wasPulling = pulling;
      tracking = false;
      pulling = false;
      if (!wasPulling) return;
      if (distance < THRESHOLD) {
        paint(0);
        apply('idle');
        return;
      }
      // Yangilash — imora ostona joyida qotib turadi va aylanadi.
      paint(THRESHOLD);
      apply('refresh');
      const started = Date.now();
      // `refetchQueries` — sahifada AYNAN nima ochiq bo'lsa, o'sha qayta so'raladi
      // (`invalidateQueries` faol bo'lmagan so'rovlarni ham belgilab, keraksiz
      // trafik beradi). `router.refresh()` esa server komponentlarni yangilaydi.
      Promise.resolve(queryClient.refetchQueries({ type: 'active' }))
        .catch(() => {
          /* xatoni global interceptor toasti aytadi */
        })
        .then(() => {
          router.refresh();
          const wait = Math.max(0, MIN_SPIN_MS - (Date.now() - started));
          window.setTimeout(() => {
            apply('done');
            window.setTimeout(() => {
              paint(0);
              apply('idle');
            }, 420);
          }, wait);
        });
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    // `passive: false` SHART — aks holda `preventDefault` ishlamaydi.
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [queryClient, router]);

  const petals = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div
      ref={hostRef}
      aria-hidden
      className="pointer-events-none fixed left-1/2 top-2 z-[60] opacity-0"
      style={{ transform: 'translate3d(-50%, 0, 0)' }}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface shadow-md ${
          phase === 'done' ? 'ptr-done' : ''
        }`}
      >
        <svg
          ref={svgRef}
          width="30"
          height="30"
          viewBox="0 0 40 40"
          fill="none"
          className={phase === 'refresh' ? 'ptr-spin' : ''}
          style={{ '--p': 0 } as React.CSSProperties}
        >
          {/* Yo'l halqasi — punktir chiziq aylana bo'lib yig'iladi.
              `pathLength={100}` bilan uzunlik normallashadi va CSS'dagi
              hisob radiusга bog'liq bo'lmaydi. */}
          <circle
            cx="20"
            cy="20"
            r="17"
            pathLength={100}
            className="ptr-road"
            stroke={phase === 'done' ? 'var(--turquoise)' : 'var(--accent)'}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <g
            stroke={phase === 'done' ? 'var(--turquoise)' : 'var(--accent)'}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Aylantirish O'ROVCHI `<g>` da, o'lchov esa ellipsning o'zida —
                ikkisini bitta elementga qo'ysak `transform-origin` ikkalasiga
                ta'sir qilib, barglar guldan tarqab ketadi (`SuzaniBloom` da
                aynan shu xato jonli o'lchovda topilgan). */}
            {petals.map((deg, i) => (
              <g key={deg} transform={`rotate(${deg} 20 20)`}>
                <ellipse
                  cx="20"
                  cy="11"
                  rx="2.4"
                  ry="4.6"
                  className="ptr-petal"
                  style={{ '--i': i } as React.CSSProperties}
                />
              </g>
            ))}
            <circle
              cx="20"
              cy="20"
              r="2.8"
              className="ptr-core"
              fill={phase === 'done' ? 'var(--turquoise)' : 'var(--accent)'}
              stroke="none"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};
