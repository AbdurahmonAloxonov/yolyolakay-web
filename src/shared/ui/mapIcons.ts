import L from 'leaflet';

/**
 * XARITA BELGILARINING YAGONA MANBASI.
 *
 * 🔴 NEGA (17.09.2026): saytda beshta xarita bor edi va har biri o'z
 * belgisini O'ZI yasardi — `RouteMapInner`, `RoutePreviewInner`,
 * `ResultsMapInner`, `RouteChooserMapInner`, `MyRoadsMapInner`. Belgilar
 * ko'zga o'xshash ko'rinardi-yu, o'lchami va bosish maydoni har xil edi:
 * landing xaritasida nuqta atrofida 40 px shaffof maydon bor, natijalar
 * xaritasidagi narx belgisida esa YO'Q edi (ya'ni 22 px balandlikdagi
 * pill — barmoq uchun kichik).
 *
 * Endi belgi bitta joyda yasaladi: o'lcham, rang va BOSISH MAYDONI
 * hamma xaritada bir xil.
 *
 * 🔑 RANGLAR CSS TOKENLARIDAN O'QILADI (17.09.2026), qotirilgan HEX
 * emas. Belgi — oddiy DOM elementi, ya'ni `var(--accent)` unda
 * ishlaydi: tema (yorug'/to'q/neon) almashganda belgilar ham O'ZI
 * almashadi. Ilgari ular qotirilgan edi va tungi temada oq nuqta
 * to'q xaritada begona bo'lib turardi.
 *
 *   --verified  — jo'nash va haydovchi («bor», yashil)
 *   --accent    — manzil va amal (brend pushtisi)
 *   --turquoise — oraliq to'xtash (sokin)
 *   --surface / --foreground / --border-color — sirt va yozuv
 *   --wine-ash  — TANLANGAN holat (temadan mustaqil to'q sirt,
 *                 ustida oq yozuv — saytdagi tanlov chiplari bilan bir xil)
 */

/** Barmoq nishoni — loyiha qoidasi (ilovadagi `tap_target_test` bilan bir xil). */
export const HIT = 44;

/** Oddiy nuqta (jo'nash/manzil/oraliq) — bosilmaydi, shuning uchun maydon kerak emas. */
export function dotIcon(color: string, size = 14): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};` +
      'border:2px solid var(--surface);box-shadow:0 0 0 1px rgba(0,0,0,.25);' +
      'transform:translate(-50%,-50%)"></div>',
    iconSize: [size, size],
    iconAnchor: [0, 0],
  });
}

export const originIcon = dotIcon('var(--verified)', 16);
export const destIcon = dotIcon('var(--accent)', 16);
export const viaIcon = dotIcon('var(--turquoise)', 12);

/**
 * Haydovchi belgisi — marshrut nuqtalaridan KATTAROQ va boshqa rangda.
 *
 * Ikonka SVG bilan chiziladi, emoji bilan EMAS: emoji platformadan
 * platformaga boshqacha ko'rinadi (va loyihada interfeys matnida emoji
 * taqiqlangan — `scripts/check-emoji.mjs`).
 *
 * Yo'nalish MA'LUM bo'lsa strelka (buriladi), aks holda mashina belgisi.
 * Burilmaydigan strelka chalg'itadi: u har doim bir tomonga qarab turadi
 * va odam uni «mashina shu tomonga ketyapti» deb o'qiydi.
 */
export function driverIcon(heading?: number | null): L.DivIcon {
  const hasHeading = typeof heading === 'number' && Number.isFinite(heading);
  const glyph = hasHeading
    ? '<path d="M12 2 19 21 12 17 5 21Z"/>'
    : '<path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm18 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"/>' +
      '<path d="M3 17V9l2-4h10l3 4h3v8"/>';
  const spin = hasHeading ? `transform:rotate(${heading}deg);` : '';
  return L.divIcon({
    className: '',
    html:
      '<div style="width:28px;height:28px;border-radius:50%;background:var(--verified);' +
      'border:3px solid var(--surface);box-shadow:0 1px 6px rgba(0,0,0,.4);' +
      'display:flex;align-items:center;justify-content:center;' +
      'transform:translate(-50%,-50%)">' +
      `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" ` +
      `stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="${spin}">` +
      `${glyph}</svg></div>`,
    iconSize: [28, 28],
    iconAnchor: [0, 0],
  });
}

/**
 * UCHRASHUV NUQTASI — haydovchi xaritada belgilagan aniq joy.
 *
 * 🔑 Jo'nash nuqtasidan ATAYIN farq qiladi: jo'nash — shahar (yo'lovchi
 * so'ragan joy), uchrashuv esa aynan qayerga BORISH kerakligi. Ikkalasi
 * bir xil ko'rinsa xaritada ikkita bir xil nuqta turadi va odam qaysi
 * biriga borishni bilmaydi.
 */
export function pickupIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      '<div style="width:26px;height:26px;border-radius:50% 50% 50% 4px;' +
      'transform:translate(-50%,-50%) rotate(-45deg);background:var(--surface);' +
      'border:3px solid var(--accent);box-shadow:0 1px 5px rgba(0,0,0,.35);' +
      'display:flex;align-items:center;justify-content:center">' +
      '<div style="width:8px;height:8px;border-radius:50%;background:var(--accent);' +
      'transform:rotate(45deg)"></div></div>',
    iconSize: [26, 26],
    iconAnchor: [0, 0],
  });
}

/**
 * NARX BELGISI — qidiruv natijasi xaritada.
 *
 * 🔴 BOSISH MAYDONI 44 px (17.09.2026): belgi bosiladigan element, ya'ni
 * loyihaning 44 px qoidasi unga HAM tegishli. Ko'rinadigan pill 22 px
 * balandlikda qoladi, tepasi va pastiga SHAFFOF joy qo'shiladi — xarita
 * ko'rinishi o'zgarmaydi, barmoq esa yetadi.
 */
export function priceIcon(label: string, active = false): L.DivIcon {
  // Tanlangan belgi — saytdagi tanlov chipi bilan bir xil: to'q sirt,
  // oq yozuv (`bg-wine-ash text-white`). U temadan MUSTAQIL.
  const bg = active ? 'var(--wine-ash)' : 'var(--accent)';
  const pad = (HIT - 24) / 2;
  /*
   * 🔴 `width:max-content` SHART (17.09.2026 da o'lchandi).
   *
   * Leaflet belgi elementiga `iconSize` dan o'lcham beradi, bu yerda esa
   * u [0,0] — ya'ni ota element ENSIZ. Ichkaridagi qatlam odatdagidek
   * ota eniga moslashib, atigi 20 px bo'lib qolgandi: PILL ko'rinardi-yu,
   * uning o'ng yarmiga bosilganda HECH NIMA bo'lmasdi (Playwright bilan
   * o'lchandi: bosiladigan maydon 20×48, ko'rinadigan belgi ~80 px).
   * Bu — «ko'ringan joy ≠ bosiladigan joy» xatosining aynan o'zi.
   */
  return L.divIcon({
    className: '',
    html:
      `<div style="width:max-content;padding:${pad}px 8px;transform:translate(-50%,-100%);` +
      'display:flex;align-items:center;justify-content:center">' +
      `<div style="white-space:nowrap;background:${bg};color:#fff;font-weight:800;` +
      'font-size:11px;padding:4px 8px;border-radius:999px;border:2px solid var(--surface);' +
      `box-shadow:0 1px 5px rgba(0,0,0,.35);${active ? 'outline:2px solid var(--accent);' : ''}">` +
      `${label}</div></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * SHAHAR NUQTASI — xaritadan yo'nalish tanlash uchun.
 *
 * Ko'rinadigan nuqta 11 px (xaritada to'g'ri o'lcham), bosish maydoni
 * 44 px. Bu qoida 16.09.2026 da landing xaritasida o'lchov bilan
 * chiqqan edi: 11 px nuqta bilan Buxoro o'rniga Navoiy bosilardi.
 */
export function cityIcon(state: 'from' | 'to' | null): L.DivIcon {
  const bg =
    state === 'from' ? 'var(--verified)' : state === 'to' ? 'var(--accent)' : 'var(--surface)';
  const border = state ? 'var(--surface)' : 'var(--accent)';
  const size = state ? 16 : 11;
  return L.divIcon({
    className: '',
    html:
      `<div style="width:${HIT}px;height:${HIT}px;display:flex;align-items:center;` +
      'justify-content:center">' +
      `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};` +
      `border:2.5px solid ${border};box-shadow:0 1px 4px rgba(0,0,0,.35)"></div></div>`,
    iconSize: [HIT, HIT],
    // Markaz — nuqta AYNAN koordinata ustida tursin (chetida emas).
    iconAnchor: [HIT / 2, HIT / 2],
  });
}

/**
 * YO'NALISH YOZUVI — mashhur yo'nalish chizig'i ustidagi safar soni.
 *
 * ⚠️ ENI MATNGA QARAB o'sadi (qat'iy emas). 17.09.2026 da ilovada shu
 * belgi 74 px qat'iy enda edi va matn HAR UCHALA tilda kesilardi
 * (o'lchandi: «12 ta safar» uz — 82.7 px). `ellipsis` toshishni yutgani
 * uchun buni hech qanday sinov tutmaydi.
 */
export function routeCountIcon(label: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html:
      '<div style="transform:translate(-50%,-50%);white-space:nowrap;' +
      'background:var(--surface);color:var(--text-color);font-weight:800;font-size:10px;' +
      'padding:2px 7px;border-radius:999px;border:1px solid var(--border-color);' +
      `box-shadow:0 1px 3px rgba(0,0,0,.2)">${label}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

/**
 * «MEN SHU YERDAMAN» — foydalanuvchining O'ZI.
 *
 * 🔴 NEGA QO'SHILDI (18.09.2026, Yandex Go bilan solishtirish): xaritada
 * haydovchi ham, manzil ham, uchrashuv nuqtasi ham bor edi — odamning
 * o'zi YO'Q edi. Ya'ni «uchrashuv nuqtasiga qancha qoldi» degan savolga
 * xarita javob bermasdi, holbuki javob barmoq ostida turardi.
 *
 * 🔑 ANIQLIK DOIRASI NUQTANING O'ZIDA EMAS — u alohida `Circle` bo'lib
 * xaritaga chiziladi (metr bilan o'lchanadi, piksel bilan emas). Doirani
 * belgi ichida chizsak u zum bilan o'zgarmay qolardi va 20 metrlik
 * xatoni shahar kattaligida ko'rsatib qo'yardi.
 *
 * ⚠️ Nuqta atrofidagi oq halqa SHART: ko'k nuqta ko'k daryo yoki to'q
 * plitka ustida yo'qoladi.
 */
export function myLocationIcon(): L.DivIcon {
  const size = 16;
  return L.divIcon({
    className: '',
    html:
      `<div style="width:${size}px;height:${size}px;border-radius:50%;` +
      'background:var(--my-location);border:3px solid #fff;' +
      'box-shadow:0 0 0 1px rgba(0,0,0,.25),0 1px 5px rgba(0,0,0,.35);' +
      'transform:translate(-50%,-50%)"></div>',
    iconSize: [size, size],
    iconAnchor: [0, 0],
  });
}
