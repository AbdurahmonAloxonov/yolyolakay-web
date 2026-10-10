# Backend o'lchov asbobi

Backend «tuzatdik» deganda **ishonmaymiz, o'lchaymiz**. Bu papka o'sha
o'lchovni bir buyruqqa tushiradi.

```bash
python3 scripts/backend-probe/probe.py all       # hammasi
python3 scripts/backend-probe/probe.py push      # bron/bekor qilish zanjiri + til
python3 scripts/backend-probe/probe.py ws-origin # saytdan WS ulanadimi
python3 scripts/backend-probe/probe.py chat      # chat xabariga push ketadimi
python3 scripts/backend-probe/probe.py phone     # tasdiqlangan bronda telefon
python3 scripts/backend-probe/probe.py contract  # swagger yo'llari o'zgardimi
```

Kutubxona kerak emas — faqat standart Python 3.

## Nega qo'lda yozilgan WebSocket mijozi bor

`websockets` paketi o'rnatilmagan va uni o'rnatish uchun tarmoq kerak
bo'ladi. `ws.py` — RFC 6455 ning bizga kerakli qismi (qo'l berish,
niqoblangan matn kadri, kadr o'qish), taxminan 100 qator.

## Tuzoqlar — vaqt yo'qotmaslik uchun

1. **WAF Python'ning standart `User-Agent` ini bloklaydi** (403).
   Brauzer sarlavhasi bo'lmasa «hamma narsa buzuq» degan yolg'on
   xulosa chiqadi. `api.py` uni doim qo'yadi.

2. **`send-otp` 429 qaytarsa ham `verify-otp` ISHLAYVERADI.**
   Qat'iy test kodi rate-limit'ga bog'liq emas. `send-otp` natijasiga
   qarab to'xtash «test akkaunt o'lgan» degan yolg'on xulosa beradi.
   Shuning uchun token faylga keshlanadi (`tokens.json`, commit
   qilinmaydi) va 429 da kutiladi.

3. **`/rides/search` sinov safarlarini KO'RSATMAYDI** (14.09.2026 dan).
   Backend sinov hisobining safarlarini qidiruvdan chiqardi (o'zimiz
   so'ragandik). Parametrsiz so'rov `n=0` beradi va «qidiruv o'lgan»
   degan yolg'on xulosaga olib keladi. O'lchovda DOIM
   `&include_test=true` qo'shing. ⚠️ Qiymati ishlamaydi — backend
   faqat parametr BORLIGIGA qaraydi, shuning uchun
   `include_test=false` ham sinov safarini qo'shadi.

   Yana bir tuzoq: safar yaratilgandan keyin qidiruvda paydo bo'lishi
   bir necha soniya kechikadi — darhol so'rasangiz topilmaydi.

4. **Javob kalitlari yassi emas.** Safar → `ride_id`, bron →
   `{"booking": {"id": ...}}`. `id` ni ko'r-ko'rona o'qish `None`
   beradi, `accept` 400 bo'ladi va «tasdiqlangan» holat aslida
   sinalmay qoladi — natija esa «ishlayapti» bo'lib ko'rinadi.

5. **WS qo'l berishida `Origin` YUBORMANG.** Backend uni ruxsat
   ro'yxati bilan tekshiradi va sayt domenimiz ro'yxatda yo'q (403).
   Mobil ilova `Origin` yubormaydi — shuning uchun ilovada chat
   ishlaydi, saytda esa yo'q. `ws-origin` buyrug'i shuni o'lchaydi.

## Sinov akkauntlari

| Rol | Raqam | Kod |
|---|---|---|
| Haydovchi | `+998991234567` | `99887` |
| Yo'lovchi | `+998001112233` | `99887` |
| 2-yo'lovchi | `+998004445566` | `99887` |

`+99800…` prefiksli istalgan raqam yangi yo'lovchi sifatida o'zi
yaratiladi.
