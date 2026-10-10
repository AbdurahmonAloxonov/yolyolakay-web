#!/usr/bin/env bash
# YolYolakay MONOLIT smoke-test — frontend tayangan backend kontraktini jonli tekshiradi.
#
# Nima uchun: backend kontrakti tez-tez o'zgaradi (v1→v2, monolit ko'chishi...). Bu skript
# har o'zgarishdan keyin 30 soniyada "frontend uchun nima sindi"ni aytadi.
#
# Ishlatish:
#   bash scripts/api-smoke.sh                      # lokal monolit (localhost:8090)
#   BASE=https://xxx.trycloudflare.com bash scripts/api-smoke.sh   # tunnel orqali
#
# Talablar: backend MOCK SMS rejimida bo'lishi kerak (ESKIZ env bo'sh) — istalgan raqamga
# OTP 11111. Har ishga tushirishda YANGI tasodifiy raqamlar olinadi (OTP rate-limit va
# "o'z-akkaunt" filtri muammosidan qochish uchun) — shuning uchun DOIM 2 alohida akkaunt.
set -u
BASE="${BASE:-http://localhost:8090}"
API="$BASE/api/v1"
G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; NC='\033[0m'; TMO=15
PASS=0; FAIL=0

ok()   { PASS=$((PASS+1)); printf "${G}✅ %s${NC}\n" "$1"; }
fail() { FAIL=$((FAIL+1)); printf "${R}❌ %s${NC}\n" "$1"; }
note() { printf "${Y}ℹ  %s${NC}\n" "$1"; }
j()    { jq -r "$1" 2>/dev/null; }

# Tasodifiy test raqam (+99891XXXXXXX) — har safar yangi, rate-limit'ga urilmaydi.
rand_phone() { printf "+99891%07d" "$((RANDOM * RANDOM % 10000000))"; }

# register PHONE FP -> stdout: access_token ('' = xato)
register() {
  local phone="$1" fp="$2"
  curl -sS -m $TMO -X POST "$API/auth/send-otp" -H 'Content-Type: application/json' \
    -d "{\"phone_number\":\"$phone\"}" >/dev/null 2>&1
  curl -sS -m $TMO -X POST "$API/auth/verify-otp" -H 'Content-Type: application/json' \
    -d "{\"phone_number\":\"$phone\",\"code\":\"11111\",\"device_fingerprint\":\"$fp\"}" \
    | j '.data.access_token // empty'
}

echo "== YolYolakay API smoke — $API =="

# ---------- 0. Backend tirikligi ----------
CODE=$(curl -sS -m $TMO -o /dev/null -w "%{http_code}" "$API/trips/search" 2>/dev/null || echo 000)
if [ "$CODE" = "401" ]; then ok "backend tirik (trips/search auth so'raydi)"; else
  fail "backend javobi kutilmagan: trips/search=$CODE (401 kutilgan) — BASE to'g'rimi? backend yoqiqmi?"
  echo "-- To'xtatildi --"; exit 1
fi

# ---------- 1. Auth (mock OTP) ----------
DRIVER_PHONE=$(rand_phone); PASSENGER_PHONE=$(rand_phone)
DT=$(register "$DRIVER_PHONE" "smoke-driver")
PT=$(register "$PASSENGER_PHONE" "smoke-passenger")
[ -n "$DT" ] && ok "haydovchi akkaunt ($DRIVER_PHONE) — token olindi" \
  || { fail "haydovchi verify-otp token bermadi — mock SMS o'chiqmi (ESKIZ env to'ldirilganmi)?"; exit 1; }
[ -n "$PT" ] && ok "yo'lovchi akkaunt ($PASSENGER_PHONE) — token olindi" || { fail "yo'lovchi token yo'q"; exit 1; }
AUTHD=(-H "Authorization: Bearer $DT"); AUTHP=(-H "Authorization: Bearer $PT")

# ---------- 2. Mashina ----------
PLATE="01S$(printf '%04d' $((RANDOM % 10000)))SA"
CAR_ID=$(curl -sS -m $TMO -X POST "$API/vehicles" "${AUTHD[@]}" -H 'Content-Type: application/json' \
  -d "{\"brand\":\"Chevrolet\",\"model\":\"Smoke\",\"plate_number\":\"$PLATE\",\"has_ac\":true}" | j '.data.id // empty')
[ -n "$CAR_ID" ] && ok "mashina qo'shildi (POST /vehicles)" || { fail "mashina qo'shilmadi"; exit 1; }

# ---------- 3. E'lon yaratish (frontend payload'i bilan aynan) ----------
DEP=$(date -u -d "+3 hours" +"%Y-%m-%dT%H:%M:%SZ")
TRIP_JSON=$(curl -sS -m $TMO -X POST "$API/trips" "${AUTHD[@]}" -H 'Content-Type: application/json' -d "{
  \"departure_lat\":41.311081,\"departure_lon\":69.240562,
  \"arrival_lat\":39.6542,\"arrival_lon\":66.9597,
  \"departure_city\":\"Toshkent\",\"arrival_city\":\"Samarqand\",
  \"pickup_point\":\"smoke test\",\"departure_time\":\"$DEP\",
  \"available_seats\":3,\"takes_parcels\":true,\"has_ac\":true,\"has_luggage\":true,
  \"price_per_seat\":90000,\"base_price\":90000,\"is_negotiable\":true,\"car_id\":\"$CAR_ID\"}")
TRIP_ID=$(echo "$TRIP_JSON" | j '.data.id // empty')
[ -n "$TRIP_ID" ] && ok "e'lon yaratildi (POST /trips)" || { fail "e'lon yaratilmadi: $(echo "$TRIP_JSON" | head -c 200)"; exit 1; }
ST=$(echo "$TRIP_JSON" | j '.data.status')
[ "$ST" = "active" ] && ok "kontrakt: status kichik harf 'active'" \
  || fail "kontrakt o'zgardi: yangi trip status='$ST' ('active' kutilgan — frontend normalizeStatus tayanadi)"
DC=$(echo "$TRIP_JSON" | j '.data.departure_city')
[ "$DC" = "Toshkent" ] && ok "kontrakt: departure_city saqlanadi (qidiruv nom-filtri asosi)" \
  || fail "departure_city saqlanmadi ('$DC') — nom bo'yicha qidiruv sinadi!"

# ---------- 4. Qidiruv ----------
FOUND=$(curl -sS -m $TMO "$API/trips/search?departure_city=Toshkent&arrival_city=Samarqand&limit=100" \
  "${AUTHP[@]}" | jq --arg id "$TRIP_ID" '[.data[]? | select(.id==$id)] | length' 2>/dev/null)
[ "$FOUND" = "1" ] && ok "YO'LOVCHI yangi e'lonni DARHOL topdi (shahar-nom filtri)" \
  || fail "yo'lovchi e'lonni topmadi! Ehtimol EARLY_ACCESS_DELAY>0 (env tekshiring) yoki nom-filtr sinди"
SELF=$(curl -sS -m $TMO "$API/trips/search?departure_city=Toshkent&arrival_city=Samarqand&limit=100" \
  "${AUTHD[@]}" | jq --arg id "$TRIP_ID" '[.data[]? | select(.id==$id)] | length' 2>/dev/null)
[ "$SELF" = "0" ] && ok "hujjatlangan xulq: haydovchi O'Z e'lonini qidiruvda KO'RMAYDI (bu norma!)" \
  || note "backend o'zgardi: o'z e'loni endi qidiruvda chiqyapti ($SELF) — frontend eslatmasini olib tashlash mumkin"

# ---------- 5. Booking (oddiy) ----------
BK=$(curl -sS -m $TMO -X POST "$API/bookings" "${AUTHP[@]}" -H 'Content-Type: application/json' \
  -d "{\"trip_id\":\"$TRIP_ID\",\"price\":85000,\"seats\":2,\"is_buyout\":false}")
BID=$(echo "$BK" | j '.data.id // empty')
[ -n "$BID" ] && ok "ariza yaratildi (POST /bookings, seats=2)" || { fail "ariza yaratilmadi: $(echo "$BK" | head -c 200)"; exit 1; }
LOB=$(echo "$BK" | j '.data.last_offer_by')
[ "$LOB" = "passenger" ] && ok "kontrakt: last_offer_by bor (accept-gating tayanadi)" \
  || fail "last_offer_by yo'q/o'zgardi ('$LOB') — bidding accept-gating sinadi"

# ---------- 6. Buyout kontrakti ----------
NB=$(curl -sS -m $TMO -o /dev/null -w "%{http_code}" -X POST "$API/bookings" "${AUTHP[@]}" \
  -H 'Content-Type: application/json' -d "{\"trip_id\":\"$TRIP_ID\",\"price\":90000,\"is_buyout\":true}")
if [ "$NB" = "400" ]; then ok "hujjatlangan xulq: buyout seats'siz 400 (frontend seats yuboradi — a198e94)"
else note "backend o'zgardi: buyout seats'siz endi $NB — frontend moslashuvi ortiqcha bo'ldi (zarar yo'q)"; fi

# ---------- 7. Counter → Accept → joy kamayishi ----------
CN=$(curl -sS -m $TMO -X POST "$API/bookings/$BID/counter" "${AUTHD[@]}" -H 'Content-Type: application/json' \
  -d '{"price":95000,"new_price":95000}' | j '.data.offered_price')
[ "$CN" = "95000" ] && ok "counter ishladi (price/new_price → 95000)" || fail "counter sinadi (offered_price='$CN')"
AC=$(curl -sS -m $TMO -X POST "$API/bookings/$BID/accept" "${AUTHP[@]}" | j '.data.status')
[ "$AC" = "accepted" ] && ok "yo'lovchi haydovchi counter'ini accept qildi (status=accepted)" \
  || fail "accept sinadi (status='$AC') — last_offer_by gating o'zgarganmi?"
LEFT=$(curl -sS -m $TMO "$API/trips/$TRIP_ID" "${AUTHP[@]}" | j '.data.available_seats')
[ "$LEFT" = "1" ] && ok "joylar to'g'ri kamaydi (3 - 2 = 1)" || fail "joy hisobi noto'g'ri (available_seats=$LEFT, 1 kutilgan)"

# ---------- 8. Chat (accepted booking ustida) ----------
CH=$(curl -sS -m $TMO -o /dev/null -w "%{http_code}" "$API/chat/history?booking_id=$BID" "${AUTHP[@]}")
[ "$CH" = "200" ] && ok "chat tarixi ochiladi (GET /chat/history?booking_id)" || fail "chat history $CH"
CM=$(curl -sS -m $TMO -o /dev/null -w "%{http_code}" -X POST "$API/chat/message" "${AUTHP[@]}" \
  -H 'Content-Type: application/json' -d "{\"booking_id\":\"$BID\",\"content\":\"smoke xabar\"}")
[ "$CM" = "201" ] || [ "$CM" = "200" ] && ok "chat xabar ketdi (POST /chat/message)" || fail "chat message $CM"

# ---------- 9. Parcels zanjiri ----------
PJ=$(curl -sS -m $TMO -X POST "$API/parcels" "${AUTHP[@]}" -H 'Content-Type: application/json' \
  -d '{"from_city":"Toshkent","to_city":"Samarqand","receiver_phone":"+998901112233","description":"smoke box","price":40000}')
PID=$(echo "$PJ" | j '.data.id // empty')
[ -n "$PID" ] && ok "posilka yaratildi (POST /parcels)" || fail "posilka yaratilmadi: $(echo "$PJ" | head -c 150)"
if [ -n "$PID" ]; then
  PF=$(curl -sS -m $TMO "$API/parcels/search?from_city=Toshkent&to_city=Samarqand" "${AUTHD[@]}" \
    | jq --arg id "$PID" '[.data[]? | select(.id==$id)] | length' 2>/dev/null)
  [ "$PF" = "1" ] && ok "haydovchi posilkani topdi (GET /parcels/search)" || fail "posilka qidiruvda yo'q ($PF)"
  PR=$(curl -sS -m $TMO -X POST "$API/parcels/$PID/responses" "${AUTHD[@]}" -H 'Content-Type: application/json' \
    -d "{\"ride_id\":\"$TRIP_ID\",\"price\":45000}")
  RID=$(echo "$PR" | j '.data.id // empty')
  if [ -n "$RID" ]; then
    ok "otklik yaratildi (POST /parcels/:id/responses)"
    AR=$(curl -sS -m $TMO -o /dev/null -w "%{http_code}" -X POST "$API/parcels/responses/$RID/accept" "${AUTHP[@]}")
    [ "$AR" = "200" ] && ok "otklik accept qilindi" || fail "otklik accept $AR"
  elif echo "$PR" | grep -q 'parcel_responses.*does not exist'; then
    note "MA'LUM BLOKER: parcel_responses jadvali yo'q (BACKEND_XAT_PARCEL_RESPONSES_JADVAL_2026-07-14) — migratsiya kutilmoqda"
  else
    fail "otklik yaratilmadi: $(echo "$PR" | head -c 150)"
  fi
fi

# ---------- 10. Tozalash ----------
CC=$(curl -sS -m $TMO -o /dev/null -w "%{http_code}" -X POST "$API/trips/$TRIP_ID/cancel" "${AUTHD[@]}")
[ "$CC" = "200" ] && ok "test e'loni bekor qilindi (tozalash)" || note "e'lon bekor bo'lmadi ($CC) — bazada smoke trip qoladi"
if [ -n "${PID:-}" ]; then
  curl -sS -m $TMO -o /dev/null -X PUT "$API/parcels/$PID/status" "${AUTHP[@]}" \
    -H 'Content-Type: application/json' -d '{"status":"cancelled"}' || true
fi

echo
if [ $FAIL -eq 0 ]; then
  printf "${G}== HAMMASI O'TDI: %d ta tekshiruv ==${NC}\n" $PASS
else
  printf "${R}== %d O'TDI / %d YIQILDI — yuqoridagi ❌ larni backend bilan solishtiring ==${NC}\n" $PASS $FAIL
  exit 1
fi
