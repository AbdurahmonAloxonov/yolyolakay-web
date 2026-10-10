import { toast } from 'sonner';

export type ShareResult = 'shared' | 'copied' | 'failed';

/**
 * Matnni nusxalash — `clipboard` bo'lmasa ESKI yo'l (`execCommand`).
 *
 * 🔴 NEGA ZAXIRA (2026-09-29): `navigator.clipboard` faqat xavfsiz
 * kontekstda va sahifa fokusda bo'lganda ishlaydi. Telegram/Instagram
 * ichki brauzeri, Android WebView va ba'zi eski Safari'larda u YO'Q yoki
 * rad etadi — tugma «hech nima qilmadi» bo'lib qolardi. `execCommand`
 * eskirgan, lekin aynan shu joylarda hamon ishlaydi.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* pastdagi zaxiraga o'tamiz */
    }
  }
  if (typeof document === 'undefined') return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  // Ekrandan tashqarida: sahifa sakramasin, iOS klaviaturani ochmasin.
  area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0;font-size:16px';
  document.body.appendChild(area);
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

/**
 * Ulashish oynasi, bo'lmasa nusxa — saytdagi BARCHA ulashish tugmalari shu yerdan.
 *
 * 🔴 2026-09-29: ilgari 5 joyda 5 xil yozilgan edi va umumiy teshigi bor
 * edi — `navigator.share` AbortError'dan BOSHQA xato bersa (masalan
 * `NotAllowedError`: bosishdan keyin `await` qilingach brauzer «foydalanuvchi
 * harakati» ni unutadi), tugma JIM o'lardi: na oyna, na nusxa, na xabar.
 * Endi faqat odam oynani o'zi yopgandagina to'xtaymiz, qolgan hamma
 * holatda nusxalashga o'tamiz.
 */
export async function shareContent(data: {
  title?: string;
  text: string;
  url?: string;
}): Promise<ShareResult> {
  const payload: ShareData = { title: data.title, text: data.text, url: data.url };
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const supported = typeof navigator.canShare !== 'function' || navigator.canShare(payload);
    if (supported) {
      try {
        await navigator.share(payload);
        return 'shared';
      } catch (e) {
        // Odam oynani yopdi — bu xato emas va «nusxalandi» deb yolg'on aytmaymiz.
        if ((e as Error)?.name === 'AbortError') return 'shared';
      }
    }
  }
  const full = data.url ? `${data.text}\n${data.url}` : data.text;
  return (await copyText(full)) ? 'copied' : 'failed';
}

/** `shareContent` + natijaga qarab toast (oyna ochilganda ortiqcha xabar yo'q). */
export async function shareOrCopy(
  data: { title?: string; text: string; url?: string },
  msg: { copied: string; failed: string }
): Promise<void> {
  const result = await shareContent(data);
  if (result === 'copied') toast.success(msg.copied);
  else if (result === 'failed') toast.error(msg.failed);
}
