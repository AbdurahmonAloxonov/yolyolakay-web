'use client';

import { useEffect } from 'react';

/**
 * Brauzerning "ilovani o'rnating" taklifini O'CHIRADI. Hech narsa chizmaydi.
 *
 * MUAMMO: saytda `manifest.webmanifest` + service worker bor, ya'ni u to'liq
 * huquqli PWA. Android Chrome buni ko'rib telefonda O'ZI banner chiqaradi
 * ("Ilovani o'rnatish"). Bu bizning kodimiz emas — biz hech qayerda APK yoki
 * ilova reklama qilmaymiz.
 *
 * NEGA KERAK EMAS: ilova Play Market orqali tarqatiladi. Saytdagi banner odamni
 * chalg'itadi — u "ilova" deb PWA yorlig'ini o'rnatadi va keyin Play'dagi
 * haqiqiy ilovadan boshqa narsa olganini tushunmaydi. Ikki xil "ilova" bitta
 * brendda — chalkashlik.
 *
 * NEGA MANIFESTNI O'CHIRMAYMIZ: manifest bilan birga PWA'ning O'ZI ketardi —
 * ekranga o'rnatish, offline rejim, push obunasi, `start_url`. Bizga taklif
 * banneri kerak emas, PWA esa kerak.
 *
 * YECHIM: `beforeinstallprompt` hodisasini ushlab, `preventDefault()` qilamiz —
 * standart usul. Banner chiqmaydi, lekin PWA ishlashda davom etadi va xohlagan
 * odam brauzer menyusidan ("Ekranga qo'shish") baribir o'rnata oladi.
 *
 * ⚠️ Hodisani SAQLAMAYMIZ: agar keyinchalik o'z tugmamiz kerak bo'lsa, saqlangan
 * `event.prompt()` bilan qilinadi. Hozir ataylab saqlanmaydi — ishlatilmaydigan
 * global holat tutib turishning ma'nosi yo'q.
 */
export function InstallPromptSuppressor() {
  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  return null;
}
