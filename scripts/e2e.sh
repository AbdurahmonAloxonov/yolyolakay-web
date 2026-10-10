#!/usr/bin/env bash
# To'liq E2E — 10 qadam. Backend: YolYolakay 192.168.26.62
set -u
A="http://192.168.26.62:8080/api/v1"   # auth
C="http://192.168.26.62:8081/api/v1"   # rides/core
B="http://192.168.26.62:8082/api/v1"   # billing
N="http://192.168.26.62:8083/api/v1"   # notif
G='\033[0;32m'; R='\033[0;31m'; Y='\033[0;33m'; NC='\033[0m'
TMO=10

j() { jq -r "$1" 2>/dev/null; }
ok() { [[ "$1" =~ ^2 ]] && printf "${G}[%s]${NC}" "$1" || { [[ "$1" =~ ^4 ]] && printf "${Y}[%s]${NC}" "$1" || printf "${R}[%s]${NC}" "$1"; }; }

# register PHONE -> echoes "TOKEN|USERID"
reg() {
  local phone="$1" name="$2" gender="$3" fp="e2e-$RANDOM-$(date +%s%N)"
  curl -sS -m $TMO -X POST "$A/auth/send-otp" -H 'Content-Type: application/json' -d "{\"phone_number\":\"$phone\"}" >/dev/null 2>&1
  local otp; otp=$(curl -sS -m $TMO "$A/auth/mock-otp/$phone" 2>/dev/null | j '.data.otp // .otp')
  local out; out=$(curl -sS -m $TMO -X POST "$A/auth/register" -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$phone\",\"otp_code\":\"$otp\",\"device_fingerprint\":\"$fp\",\"password\":\"test123456\",\"name\":\"$name\",\"gender\":\"$gender\"}" 2>/dev/null)
  local body; body=$(echo "$out" | jq '.data // .' 2>/dev/null)
  echo "$(echo "$body" | j '.access_token')|$(echo "$body" | j '.user.id // .user_id // .id')"
}

echo "======================================================================"
echo " TO'LIQ E2E — 10 QADAM ($(date '+%H:%M:%S'))"
echo "======================================================================"

# ---------- 1) DRIVER ro'yxat ----------
DPHONE="+99890$(shuf -i 1000000-9999999 -n1)"
IFS='|' read -r DTOK DID <<< "$(reg "$DPHONE" "E2E Driver" "male")"
printf "1) DRIVER register (%s): " "$DPHONE"; [ -n "$DTOK" ] && echo -e "${G}OK${NC} id=$DID" || { echo -e "${R}TOKEN YO'Q${NC}"; exit 1; }

# ---------- 2) auto-TRIAL tarif ----------
ME=$(curl -sS -m $TMO -w '\n%{http_code}' "$A/users/me" -H "Authorization: Bearer $DTOK" 2>/dev/null)
CODE=$(echo "$ME" | tail -1); MEJSON=$(echo "$ME" | sed '$d')
printf "2) GET /users/me: "; ok "$CODE"; echo "  tariff=$(echo "$MEJSON" | j '.data.tariff // .tariff') role=$(echo "$MEJSON" | j '.data.role // .role')"

# ---------- 4) MyID (2-userда noyob bo'lishi kerak) ----------
MYID=$(curl -sS -m $TMO -w '\n%{http_code}' -X POST "$A/auth/verify-myid" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d "{\"code\":\"$(cat /proc/sys/kernel/random/uuid)\"}" 2>/dev/null)
printf "4) POST /auth/verify-myid: "; ok "$(echo "$MYID" | tail -1)"; echo " $(echo "$MYID"|sed '$d'|head -c 120)"

# ---------- role -> DRIVER ----------
curl -sS -m $TMO -X PATCH "$A/users/me" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d '{"role":"DRIVER"}' >/dev/null 2>&1

# ---------- user-sync kutish (rides FK) ----------
printf "   user-sync kutilmoqda (rides DB FK)"; VEH=""; VCODE=""
for i in $(seq 1 12); do
  VOUT=$(curl -sS -m $TMO -w '\n%{http_code}' -X POST "$C/vehicles" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' \
    -d '{"brand":"Chevrolet","model":"Cobalt","color":"white","plate_number":"01E2E'"$RANDOM"'","year":2022}' 2>/dev/null)
  VCODE=$(echo "$VOUT" | tail -1); VEH=$(echo "$VOUT" | sed '$d')
  [[ "$VCODE" =~ ^2 ]] && break
  echo "$VEH" | grep -q "duplicate" && break
  printf "."; sleep 2
done; echo ""

# ---------- 5) vehicle ----------
printf "5) POST /vehicles: "; ok "$VCODE"; echo " $(echo "$VEH" | head -c 120)"

# ---------- 6) trip e'lon (Toshkent -> Samarqand) ----------
DEP_LAT=41.311081; DEP_LON=69.240562      # Toshkent markazi
ARR_LAT=39.627012; ARR_LON=66.974975      # Samarqand
DTIME=$(date -u -d '+1 day' '+%Y-%m-%dT08:00:00Z' 2>/dev/null || date -u '+%Y-%m-%dT08:00:00Z')
TRIP=$(curl -sS -m $TMO -w '\n%{http_code}' -X POST "$C/trips" -H "Authorization: Bearer $DTOK" -H 'Content-Type: application/json' -d "{
  \"departure_lat\":$DEP_LAT,\"departure_lon\":$DEP_LON,\"arrival_lat\":$ARR_LAT,\"arrival_lon\":$ARR_LON,
  \"pickup_point\":\"Toshkent, Amir Temur xiyoboni\",\"departure_time\":\"$DTIME\",\"total_seats\":3,
  \"takes_parcels\":true,\"has_ac\":true,\"has_luggage\":true,\"base_price\":50000,\"vehicle_id\":\"$(echo "$VEH"|j '.data.id // .id // .data.ID // .ID')\",\"waypoints\":[]}" 2>/dev/null)
TCODE=$(echo "$TRIP" | tail -1); TJSON=$(echo "$TRIP" | sed '$d')
printf "6) POST /trips (e'lon): "; ok "$TCODE"; echo " $(echo "$TJSON" | head -c 160)"
# trip id ni /trips/my dan olamiz
TID=$(curl -sS -m $TMO "$C/trips/my" -H "Authorization: Bearer $DTOK" 2>/dev/null | jq -r '(.data // .)[0] | (.id // .ID)' 2>/dev/null)
echo "   trip_id=$TID"

# ---------- 7) PASSENGER ro'yxat + qidiruv (aniq nuqta) ----------
PPHONE="+99893$(shuf -i 1000000-9999999 -n1)"
IFS='|' read -r PTOK PID <<< "$(reg "$PPHONE" "E2E Passenger" "female")"
printf "7a) PASSENGER register (%s): " "$PPHONE"; [ -n "$PTOK" ] && echo -e "${G}OK${NC} id=$PID" || echo -e "${R}TOKEN YO'Q${NC}"
SRCH=$(curl -sS -m $TMO -w '\n%{http_code}' "$C/trips/search?origin_lat=$DEP_LAT&origin_lon=$DEP_LON&dest_lat=$ARR_LAT&dest_lon=$ARR_LON" -H "Authorization: Bearer $PTOK" 2>/dev/null)
SCODE=$(echo "$SRCH" | tail -1); SJSON=$(echo "$SRCH" | sed '$d')
CNT=$(echo "$SJSON" | jq '(.data // .) | length' 2>/dev/null)
printf "7b) SEARCH aniq nuqta (Toshkent): "; ok "$SCODE"; echo "  topildi=$CNT ta"
echo "$SJSON" | jq -c '(.data // .)[0] | {id:(.id//.ID), distance_km:(.distance_km//.DistanceKM), is_nearest:(.is_nearest//.IsNearest)}' 2>/dev/null | sed 's/^/     /'

# ---------- 8) qidiruv UZOQ nuqtadan (fallback = eng yaqin) ----------
FAR_LAT=42.460000; FAR_LON=59.610000     # Nukus (Toshkentdan ~800km)
FSR=$(curl -sS -m $TMO -w '\n%{http_code}' "$C/trips/search?origin_lat=$FAR_LAT&origin_lon=$FAR_LON&dest_lat=$ARR_LAT&dest_lon=$ARR_LON" -H "Authorization: Bearer $PTOK" 2>/dev/null)
FCODE=$(echo "$FSR" | tail -1); FJSON=$(echo "$FSR" | sed '$d')
FCNT=$(echo "$FJSON" | jq '(.data // .) | length' 2>/dev/null)
printf "8) SEARCH UZOQ nuqta (Nukus) -> ENG YAQIN fallback: "; ok "$FCODE"; echo "  topildi=$FCNT ta"
echo "$FJSON" | jq -c '(.data // .)[] | {id:(.id//.ID), distance_km:(.distance_km//.DistanceKM), is_nearest:(.is_nearest//.IsNearest)}' 2>/dev/null | head -5 | sed 's/^/     /'

# ---------- 9) booking + accept ----------
BK=$(curl -sS -m $TMO -w '\n%{http_code}' -X POST "$C/bookings" -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"trip_id\":\"$TID\",\"seats\":1}" 2>/dev/null)
BCODE=$(echo "$BK" | tail -1); BJSON=$(echo "$BK" | sed '$d')
BID=$(echo "$BJSON" | j '.data.id // .id // .data.ID // .ID')
printf "9a) POST /bookings (yo'lovchi): "; ok "$BCODE"; echo "  booking_id=$BID"
if [ -n "$BID" ] && [ "$BID" != "null" ]; then
  AC=$(curl -sS -m $TMO -w '\n%{http_code}' -X POST "$C/bookings/$BID/accept" -H "Authorization: Bearer $DTOK" 2>/dev/null)
  printf "9b) POST /bookings/{id}/accept (haydovchi): "; ok "$(echo "$AC"|tail -1)"; echo ""
fi

# ---------- 10) chat ----------
CM=$(curl -sS -m $TMO -w '\n%{http_code}' -X POST "$N/chat/message" -H "Authorization: Bearer $PTOK" -H 'Content-Type: application/json' -d "{\"booking_id\":\"$BID\",\"content\":\"E2E salom\"}" 2>/dev/null)
printf "10a) POST /chat/message: "; ok "$(echo "$CM"|tail -1)"; echo ""
CH=$(curl -sS -m $TMO -w '\n%{http_code}' "$N/chat/history?booking_id=$BID" -H "Authorization: Bearer $PTOK" 2>/dev/null)
printf "10b) GET /chat/history: "; ok "$(echo "$CH"|tail -1)"; echo " $(echo "$CH"|sed '$d'|head -c 100)"

echo "======================================================================"
echo " TUGADI"
echo "======================================================================"
