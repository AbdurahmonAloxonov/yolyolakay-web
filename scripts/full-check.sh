#!/usr/bin/env bash
# YolYolakay — TO'LIQ qabul testi (barcha oqimlar). Aniq ✅/❌ hisobot.
# Ishlatish: bash scripts/full-check.sh
set -u
A="http://192.168.26.62:8080/api/v1"; C="http://192.168.26.62:8081/api/v1"
B="http://192.168.26.62:8082/api/v1"; N="http://192.168.26.62:8083/api/v1"; PC="http://192.168.26.62:8084/api/v1"
G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; NC='\033[0m'; TMO=10
PASS=0; FAIL=0; declare -a REPORT
chk(){ local l="$1" c="$2" extra="${3:-}"; if [[ "$c" =~ ^2 ]]; then REPORT+=("${G}✅${NC} $l ${c} $extra"); PASS=$((PASS+1)); else REPORT+=("${R}❌${NC} $l ${c} $extra"); FAIL=$((FAIL+1)); fi; }
code(){ echo "$1" | tail -1; }
body(){ echo "$1" | sed '$d'; }
req(){ curl -sS -m $TMO -w '\n%{http_code}' "$@" 2>/dev/null; }
uid(){ echo "$1"|cut -d. -f2|base64 -d 2>/dev/null|jq -r .user_id; }
reg(){ local ph="$1" nm="$2" g="$3"; curl -sS -m $TMO -X POST "$A/auth/send-otp" -H 'Content-Type: application/json' -d "{\"phone_number\":\"$ph\"}">/dev/null; local o=$(curl -sS -m $TMO "$A/auth/mock-otp/$ph"|jq -r '.data.otp'); curl -sS -m $TMO -X POST "$A/auth/register" -H 'Content-Type: application/json' -d "{\"phone\":\"$ph\",\"otp_code\":\"$o\",\"device_fingerprint\":\"fp$RANDOM\",\"password\":\"test123456\",\"name\":\"$nm\",\"gender\":\"$g\"}"; }

echo "======================================================================"
echo " TO'LIQ QABUL TESTI — $(date '+%H:%M:%S')"
echo "======================================================================"
DPHONE="+99890$(shuf -i 1000000-9999999 -n1)"; PPHONE="+99893$(shuf -i 1000000-9999999 -n1)"

# 1. AUTH — register driver
RO=$(reg "$DPHONE" "Haydovchi Akmal" "male"); DTOK=$(echo "$RO"|jq -r '.data.access_token'); DREF=$(echo "$RO"|jq -r '.data.refresh_token')
[ -n "$DTOK" ] && [ "$DTOK" != "null" ] && chk "1. Register (haydovchi) + OTP" "200" || chk "1. Register (haydovchi)" "500"
# 2. LOGIN
LO=$(req -X POST "$A/auth/login" -H 'Content-Type: application/json' -d "{\"phone\":\"$DPHONE\",\"password\":\"test123456\",\"device_fingerprint\":\"fpX\"}"); chk "2. Login (telefon+parol)" "$(code "$LO")"
# 3. REFRESH token
RF=$(req -X POST "$A/auth/refresh" -H 'Content-Type: application/json' -d "{\"refresh_token\":\"$DREF\"}"); chk "3. Refresh token" "$(code "$RF")"
# 4. MyID
MY=$(req -X POST "$A/auth/verify-myid" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d "{\"code\":\"$(cat /proc/sys/kernel/random/uuid)\"}"); chk "4. MyID verify" "$(code "$MY")"
# 5. Tariflar ro'yxati
TL=$(req "$B/tariffs" -H "Authorization: Bearer $DTOK"); chk "5. Tariflar ro'yxati (/tariffs)" "$(code "$TL")"
# 6. TRIAL obuna
TR=$(req -X POST "$B/subscription/subscribe" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d '{"role":"DRIVER","type":"TRIAL"}'); chk "6. TRIAL obuna" "$(code "$TR")"
# 7. PLUS pullik obuna (auto-complete)
PL=$(req -X POST "$B/subscription/subscribe" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d '{"role":"DRIVER","type":"PLUS"}'); chk "7. PLUS pullik obuna (auto-complete)" "$(code "$PL")"
# 8. role -> DRIVER
PR=$(req -X PATCH "$A/users/me" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d '{"role":"DRIVER"}'); chk "8. Rolni DRIVER qilish (PATCH)" "$(code "$PR")"
# 9. Vehicle yaratish
VO=$(req -X POST "$C/vehicles" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d '{"brand":"Chevrolet","model":"Cobalt","color":"white","plate_number":"01AK'"$RANDOM"'","year":2022}'); VID=$(body "$VO"|jq -r '.data.id // .id'); chk "9. Mashina yaratish (/vehicles)" "$(code "$VO")"
# 10. /vehicles/my
VM=$(req "$C/vehicles/my" -H "Authorization: Bearer $DTOK"); chk "10. Mashinalar ro'yxati (/vehicles/my)" "$(code "$VM")"
# 11. /users/me TO'LIQ (role+tariff+vehicles)
UM=$(req "$A/users/me" -H "Authorization: Bearer $DTOK"); UMB=$(body "$UM")
HASROLE=$(echo "$UMB"|jq -r '(.data.role//.role) // ""'); HASTAR=$(echo "$UMB"|jq 'has("data") and (.data|has("tariff")) or has("tariff")'); HASVEH=$(echo "$UMB"|jq '(.data.vehicles//.vehicles//[])|length')
if [ "$HASROLE" = "driver" ] && [ "$HASTAR" = "true" ] && [ "$HASVEH" -ge 1 ] 2>/dev/null; then chk "11. /users/me TO'LIQ (role+tariff+vehicles)" "200" "role=$HASROLE, vehicles=$HASVEH"; else chk "11. /users/me TO'LIQ" "500" "role=$HASROLE tariff=$HASTAR veh=$HASVEH"; fi
# 12. Trip e'lon
PRICE=$((70000+RANDOM%2000)); DTIME=$(date -u -d '+1 day' '+%Y-%m-%dT09:00:00Z' 2>/dev/null || date -u '+%Y-%m-%dT09:00:00Z')
TO=$(req -X POST "$C/trips" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d "{\"departure_lat\":41.311081,\"departure_lon\":69.240562,\"arrival_lat\":39.627012,\"arrival_lon\":66.974975,\"pickup_point\":\"Toshkent, Chorsu\",\"departure_time\":\"$DTIME\",\"total_seats\":4,\"takes_parcels\":true,\"has_ac\":true,\"has_luggage\":true,\"base_price\":$PRICE,\"vehicle_id\":\"$VID\",\"waypoints\":[]}"); chk "12. Safar e'lon (POST /trips)" "$(code "$TO")"
TID=$(req "$C/trips/my" -H "Authorization: Bearer $DTOK"|sed '$d'|jq -r '(.data//.)[0]|(.id//.ID)')
# 13. /trips/my
TM=$(req "$C/trips/my" -H "Authorization: Bearer $DTOK"); chk "13. Haydovchi safarlari (/trips/my)" "$(code "$TM")"

# --- YO'LOVCHI ---
PO=$(reg "$PPHONE" "Yolovchi Dilnoza" "female"); PTOK=$(echo "$PO"|jq -r '.data.access_token')
[ -n "$PTOK" ] && [ "$PTOK" != "null" ] && chk "14. Register (yo'lovchi)" "200" || chk "14. Register (yo'lovchi)" "500"
# 15. Qidiruv ANIQ nuqta — haydovchi safarini topadimi?
SR=$(req "$C/trips/search?origin_lat=41.311081&origin_lon=69.240562&dest_lat=39.627012&dest_lon=66.974975" -H "Authorization: Bearer $PTOK")
GOT=$(body "$SR"|jq --arg t "$TID" '[(.data//.)[]|select((.id//.ID)==$t)]|length')
[ "$GOT" = "1" ] && chk "15. Qidiruv: haydovchi safari YO'LOVCHIGA yetdi" "200" "(narx=$PRICE topildi)" || chk "15. Qidiruv: safar topilmadi" "404"
# 16. Nearest fallback (uzoq nuqta)
FR=$(req "$C/trips/search?origin_lat=42.460000&origin_lon=59.610000&dest_lat=39.627012&dest_lon=66.974975" -H "Authorization: Bearer $PTOK")
NEAR=$(body "$FR"|jq '[(.data//.)[]|select((.is_nearest//.IsNearest)==true and (.distance_km//.DistanceKM)>0)]|length')
[ "$NEAR" -ge 1 ] 2>/dev/null && chk "16. 'Eng yaqin' fallback (is_nearest+distance_km)" "200" "($NEAR ta yaqin safar)" || chk "16. 'Eng yaqin' fallback" "500"
# 17. Booking
BO=$(req -X POST "$C/bookings" -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"trip_id\":\"$TID\",\"seats\":1}"); BID=$(body "$BO"|jq -r '.data.id//.id'); chk "17. Bron (POST /bookings, yo'lovchi)" "$(code "$BO")"
# 18. Haydovchi bron(lar)ni ko'radi
DB=$(req "$C/trips/$TID/bookings" -H "Authorization: Bearer $DTOK"); chk "18. Haydovchi bronlarni ko'radi" "$(code "$DB")"
# 19. Accept
AC=$(req -X POST "$C/bookings/$BID/accept" -H "Authorization: Bearer $DTOK"); chk "19. Bronni qabul qilish (accept)" "$(code "$AC")"
# 20. Chat message
CM=$(req -X POST "$N/chat/message" -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"booking_id\":\"$BID\",\"content\":\"Assalomu alaykum, qayerdan olasiz?\"}"); chk "20. Chat: xabar yuborish" "$(code "$CM")"
# 21. Chat history
CH=$(req "$N/chat/history?booking_id=$BID" -H "Authorization: Bearer $PTOK"); CNT=$(body "$CH"|jq '(.data//.)|length'); chk "21. Chat: tarix (round-trip)" "$(code "$CH")" "($CNT xabar)"
# 22. Trip start
TS=$(req -X POST "$C/trips/$TID/start" -H "Authorization: Bearer $DTOK"); chk "22. Safarni boshlash (start)" "$(code "$TS")"
# 23. Trip complete
TC=$(req -X POST "$C/trips/$TID/complete" -H "Authorization: Bearer $DTOK"); chk "23. Safarni yakunlash (complete)" "$(code "$TC")"
# 24. Trip cancel (alohida yangi safar)
TO2=$(req -X POST "$C/trips" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d "{\"departure_lat\":41.311081,\"departure_lon\":69.240562,\"arrival_lat\":40.0,\"arrival_lon\":65.0,\"pickup_point\":\"Toshkent\",\"departure_time\":\"$DTIME\",\"total_seats\":2,\"takes_parcels\":false,\"has_ac\":true,\"has_luggage\":false,\"base_price\":30000,\"vehicle_id\":\"$VID\",\"waypoints\":[]}")
TID2=$(req "$C/trips/my" -H "Authorization: Bearer $DTOK"|sed '$d'|jq -r '[(.data//.)[]|select((.status)=="CREATED")][0]|(.id//.ID)')
CN=$(req -X POST "$C/trips/$TID2/cancel" -H "Authorization: Bearer $DTOK"); chk "24. Safarni bekor qilish (cancel)" "$(code "$CN")"
# 25. Parcels servisi javob beradimi (to'g'ri yo'l: /parcels/my)
PCK=$(req "$PC/parcels/my" -H "Authorization: Bearer $PTOK"); pc=$(code "$PCK"); [[ "$pc" =~ ^2 ]] && chk "25. Parcels servisi tirik (/parcels/my)" "$pc" || chk "25. Parcels servisi (/parcels/my)" "$pc"

echo ""
echo "======================================================================"
for line in "${REPORT[@]}"; do echo -e "  $line"; done
echo "======================================================================"
echo -e "  JAMI: ${G}$PASS ✅${NC}  |  ${R}$FAIL ❌${NC}  (25 dan)"
echo "======================================================================"
