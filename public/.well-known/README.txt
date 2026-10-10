ANDROID APP LINKS — assetlinks.json
====================================

Nima uchun: ulashilgan `https://yolyolakay.co.uz/...` havolasi bosilganda
ilova o'rnatilgan bo'lsa BRAUZER emas, ILOVA ochilsin. Android shu faylni
o'qib, ilova haqiqatan shu saytga tegishli ekanini tekshiradi.

Manzil (o'zgarmasin): https://yolyolakay.co.uz/.well-known/assetlinks.json
Content-Type `application/json` bo'lishi shart (Next.js `public/` dan
o'zi shunday beradi), redirect BO'LMASLIGI kerak.

Hozir ro'yxatda BITTA barmoq izi bor — bizning YUKLASH (upload) kalitimiz:
  AF:46:E1:48:...:9C:D3   (yolyolakay-release.keystore, alias `yolyolakay`)

🔴 MUHIM — PLAY APP SIGNING
Play ilovani O'Z kaliti bilan QAYTA IMZOLAYDI. Ya'ni foydalanuvchidagi
paketning barmoq izi yuqoridagidan BOSHQA bo'ladi va tekshiruv o'tmaydi.

Shuning uchun Play'ga yuklangandan keyin:
  Play Console -> Test and release -> App integrity -> App signing
  -> "App signing key certificate" -> SHA-256 ni nusxalang
va uni yuqoridagi ro'yxatga QO'SHING (o'chirmang — ikkalasi ham turadi,
massiv bir nechta qiymatni qabul qiladi):

  "sha256_cert_fingerprints": [
    "AF:46:...:D3",              <- upload kaliti (lokal build uchun)
    "<Play bergan SHA-256>"      <- foydalanuvchidagi paket
  ]

Keyin qayta deploy qiling. Tekshirish:
  adb shell pm verify-app-links --re-verify uz.yolyolakay.mobile
  adb shell pm get-app-links uz.yolyolakay.mobile
"verified" chiqishi kerak.

Play kaliti qo'shilmaguncha havola ochilganda tizim TANLOV oynasini
ko'rsatadi (brauzer yoki ilova) — bu ham hozirgidan yaxshi, lekin
avtomatik emas.
