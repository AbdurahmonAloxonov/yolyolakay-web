# reactbits komponentlari

Manba: [reactbits.dev](https://reactbits.dev) — `DavidHDev/react-bits`, `src/ts-tailwind/`.
Litsenziya: **MIT + Commons Clause**. Mahsulot ichida ishlatishga ruxsat beradi;
kutubxonaning O'ZINI sotish taqiqlanadi — bizga tegishli emas.

Bu papkadagi kod **ularniki**, `shared/ui/motion/` dagi esa bizniki (o'sha g'oyalar
CSS bilan qayta yozilgan). Ikkalasi ataylab alohida turadi: yangilanish kelganda
qaysi fayl tashqi manbadan ekani aniq ko'rinsin.

Yangi bog'liqlik qo'shilmadi — `framer-motion` loyihada allaqachon bor edi
(reactbits uni `motion/react` yangi nomi bilan import qiladi, biz eski nomga
o'zgartirdik).

## O'rnatilganlar

| Komponent       | Qayerda                                    | Narxi                                                                         |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `RotatingText`  | landing hero — yo'nalish nomlari almashadi | `setInterval` + o'tish paytidagi animatsiya. Doimiy sikl YO'Q                 |
| `SpotlightCard` | tarif kartalari                            | rAF umuman yo'q, faqat hodisa ishlovchilari. Sensorli ekranda ishga tushmaydi |
| `ClickSpark`    | asosiy qidiruv tugmasi                     | bosilganda ~0.4s. Doimiy sikl OLIB TASHLANDI (pastga qarang)                  |

## Kiritilgan o'zgarishlar

Har biri kodda `YOLYOLAKAY O'ZGARTIRISHI` izohi bilan belgilangan.

1. **`ClickSpark` — doimiy rAF sikli to'xtatildi.** Asl kodda `draw()` o'zini
   shartsiz qayta rejalashtirardi: hech kim hech narsa bosmasa ham sahifa ochiq
   turgan davomida har kadrda butun canvas tozalanardi. Endi sikl faqat uchqun
   mavjud bo'lganda aylanadi, bosilganda qayta yoqiladi.
2. **`SpotlightCard` — hardcode ranglar olib tashlandi.** Asl kodda
   `border-neutral-800 bg-neutral-900` qotib yozilgan; loyihada ranglar token
   orqali beriladi.
3. **Import yo'li** — `motion/react` -> `framer-motion` (uchala faylda).

## O'RNATILMAGANLARI va sababi

- **`GradientText`, `ShinyText`** — ikkalasi ham `useAnimationFrame` bilan
  TO'XTOVSIZ aylanadigan sikl quradi (sahifa ochiq turgan davomida). Ko'rinishga
  qo'shadigan narsasi kichik, narxi esa doimiy. O'rniga `globals.css` da
  `.brand-gradient-text` bor — bir xil ko'rinish, animatsiyasiz, narxi nol.
- **Barcha `Backgrounds` (20 ta)** — WebGL/canvas. Aurora kerak bo'lsa
  `shared/ui/brand/AuroraCss` (statik) yoki `AuroraGl` (o'z shaderimiz) bor.
- **Kursor effektlari** (`BlobCursor`, `SplashCursor`, `ImageTrail`, `Crosshair`,
  `MagnetLines`) — foydalanuvchilarimizning katta qismi telefonda, u yerda
  kursor yo'q.
- **`DecryptedText`, `ScrambledText`, `GlitchText`, `FuzzyText`, `ASCIIText`,
  `TextPressure`, `TrueFocus`** — "buzilgan matn" estetikasi. Transport
  xizmatida ishonch muhim, bu effektlar esa xatolik taassurotini beradi va
  yoshi kattaroq foydalanuvchini chalg'itadi.
- **`Dock`, `GooeyNav`, `InfiniteMenu`, `CircularGallery`, `FlyingPosters`,
  `Lanyard`, `RollingGallery`** — portfolio/galereya uchun. Bizda navigatsiya
  allaqachon bor (`BottomNav`), almashtirishga sabab yo'q.
