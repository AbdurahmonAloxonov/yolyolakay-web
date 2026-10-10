#!/usr/bin/env bash
# Qurilma ishonchi sessiyadan ajratildimi? — BACKEND_XAT_QURILMA_2026-08-09.txt tekshiruvi.
#
# Nima uchun: xatning asosiy talabi (logautdan keyin ham qurilma "ishonchli" qolsin)
# swaggerda KO'RINMAYDI — bu xulq-atvor, kontrakt emas. Faqat jonli ketma-ketlik hal qiladi.
#
# Ishlatish:
#   bash scripts/device-trust-check.sh "+998XXXXXXXXX" "parol"
#
# ⚠️ 1 ta SMS ketadi (yangi qurilma ishonchini o'rnatish uchun). Agar backend tuzatmagan
# bo'lsa — oxirgi qadamda YANA 1 ta SMS ketadi, aynan shu muammoni isbotlaydi.
set -u
BASE="${BASE:-https://api.yolyolakay.com}"
API="$BASE/api/v1"
G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; NC='\033[0m'; TMO=20

PHONE="${1:-}"; PASS="${2:-}"
[ -z "$PHONE" ] || [ -z "$PASS" ] && { echo "Ishlatish: bash $0 \"+998XXXXXXXXX\" \"parol\""; exit 1; }

# Har ishga tushirishda YANGI device id — brauzerdagi ishonchli qurilmani buzmaslik uchun.
DEV="trust-check-$(date +%s)"
GHOST="ghost-device-$(date +%s)"   # hech qachon mavjud bo'lmagan qurilma (404 tekshiruvi)
TOKEN=""

ok()   { printf "${G}✅ %s${NC}\n" "$1"; }
bad()  { printf "${R}❌ %s${NC}\n" "$1"; }
note() { printf "${Y}ℹ  %s${NC}\n" "$1"; }

# login PHONE PASS DEVICE -> "HTTP_KOD<TAB>BODY"
login() {
  curl -sS -m $TMO -w '\n%{http_code}' -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' -H "X-Device-ID: $3" -H 'X-OS-Type: web' \
    -d "{\"phone_number\":\"$1\",\"password\":\"$2\"}"
}
code() { printf '%s' "$1" | tail -n1; }
body() { printf '%s' "$1" | sed '$d'; }
tok()  { printf '%s' "$1" | sed '$d' | jq -r '.data.access_token // empty' 2>/dev/null; }

echo "== Qurilma ishonchi tekshiruvi — $API =="
echo "   device_id = $DEV"
echo

# ---------- 1. Yangi qurilmadan kirish (ishonch o'rnatish) ----------
R1=$(login "$PHONE" "$PASS" "$DEV"); C1=$(code "$R1")
if [ "$C1" = "403" ]; then
  note "1) yangi qurilma -> 403 (kutilgan), SMS yuborildi"
  printf "   Telefonga kelgan 5 xonali kodni kiriting: "; read -r CODE
  R2=$(curl -sS -m $TMO -w '\n%{http_code}' -X POST "$API/auth/verify-otp" \
    -H 'Content-Type: application/json' -H "X-Device-ID: $DEV" -H 'X-OS-Type: web' \
    -d "{\"phone_number\":\"$PHONE\",\"code\":\"$CODE\"}")
  [ "$(code "$R2")" = "200" ] || { bad "verify-otp $(code "$R2") — $(body "$R2")"; exit 1; }
  TOKEN=$(tok "$R2"); ok "kod qabul qilindi — qurilma endi ishonchli"
elif [ "$C1" = "200" ]; then
  TOKEN=$(tok "$R1"); note "1) yangi qurilma DARHOL 200 berdi — ishonch qurilmaga emas, foydalanuvchiga bog'langan"
else
  bad "1) login $C1 — $(body "$R1")"; exit 1
fi

# ---------- 2. Nazorat: ishonchli qurilmadan parol bilan kirish ----------
R3=$(login "$PHONE" "$PASS" "$DEV"); C3=$(code "$R3")
[ "$C3" = "200" ] && ok "2) NAZORAT: ishonchli qurilmadan parol bilan kirish = 200" \
  || { bad "2) NAZORAT BUZILDI: $C3 — $(body "$R3"). Ishonch umuman o'rnatilmayapti, keyingi qadamlar ma'nosiz."; exit 1; }
TOKEN=$(tok "$R3")

# ---------- 3. Sessiyalar soni (xatning 1-kuzatuvi: "1 sessiya limiti bormi?") ----------
S=$(curl -sS -m $TMO "$API/auth/sessions" -H "Authorization: Bearer $TOKEN" -H "X-Device-ID: $DEV")
N=$(printf '%s' "$S" | jq -r '(.data // []) | length' 2>/dev/null || echo '?')
note "3) GET /auth/sessions -> $N ta sessiya"
[ "$N" = "1" ] && note "   faqat 1 ta — brauzer sessiyangiz ham ochiq bo'lsa, bu 'bitta sessiya' limitining alomati"

# ---------- 4. Mavjud bo'lmagan qurilmani o'chirish (xatning 2-bandi: 404 kerak) ----------
C4=$(curl -sS -m $TMO -o /dev/null -w '%{http_code}' -X DELETE "$API/auth/sessions/$GHOST" \
  -H "Authorization: Bearer $TOKEN" -H "X-Device-ID: $DEV")
[ "$C4" = "404" ] && ok "4) yo'q qurilmani o'chirish -> 404 (TUZATILGAN)" \
  || bad "4) yo'q qurilmani o'chirish -> $C4 (404 so'ralgan edi — TUZATILMAGAN)"

# ---------- 5. LOGAUT ----------
C5=$(curl -sS -m $TMO -o /dev/null -w '%{http_code}' -X DELETE "$API/auth/sessions/$DEV" \
  -H "Authorization: Bearer $TOKEN" -H "X-Device-ID: $DEV")
note "5) LOGAUT: DELETE /auth/sessions/$DEV -> $C5"

# ---------- 6. ASOSIY SAVOL: logautdan keyin parol bilan kirish ----------
R6=$(login "$PHONE" "$PASS" "$DEV"); C6=$(code "$R6")
echo
if [ "$C6" = "200" ]; then
  ok "6) LOGAUTDAN KEYIN parol bilan kirish = 200 → XAT BAJARILGAN"
  ok "   qurilma ishonchi sessiyadan ajratilgan, SMS ketmadi"
elif [ "$C6" = "403" ]; then
  bad "6) LOGAUTDAN KEYIN = 403 $(body "$R6") → XAT BAJARILMAGAN"
  bad "   o'sha qurilma yana 'yangi' hisoblandi va yana SMS ketdi"
else
  bad "6) kutilmagan javob: $C6 — $(body "$R6")"
fi
