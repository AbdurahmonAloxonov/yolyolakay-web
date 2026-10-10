#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Backend "smoke test" — kontraktni tez tekshirish.
#
# Ishlatish:
#   bash scripts/smoke.sh                      # faqat ulanish + ochiq endpointlar
#   bash scripts/smoke.sh "+998901234567" "parol"   # + login qilib himoyalangan endpointlar
#
# Manzillarni o'zgartirish (kerak bo'lsa):
#   AUTH_URL=http://192.168.26.62:8080 CORE_URL=http://192.168.26.62:8081 bash scripts/smoke.sh ...
# ---------------------------------------------------------------------------
set -u

AUTH_URL="${AUTH_URL:-http://192.168.26.62:8080}/api/v1"
CORE_URL="${CORE_URL:-http://192.168.26.62:8081}/api/v1"
PHONE="${1:-}"
PASSWORD="${2:-}"
TIMEOUT=8

GREEN='\033[0;32m'; RED='\033[0;31m'; YEL='\033[0;33m'; NC='\033[0m'

# req METHOD URL [json_body] [auth_token]
req() {
  local method="$1" url="$2" body="${3:-}" token="${4:-}"
  local args=(-sS -m "$TIMEOUT" -X "$method" -H "Content-Type: application/json" -w $'\n__HTTP__%{http_code}')
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}" "$url" 2>&1
}

show() {
  local label="$1" out="$2"
  local code="${out##*__HTTP__}"
  local payload="${out%__HTTP__*}"
  local color="$RED"
  [[ "$code" =~ ^2 ]] && color="$GREEN"
  [[ "$code" =~ ^4 ]] && color="$YEL"
  printf "${color}[%s]${NC} %s\n" "$code" "$label"
  # javobning birinchi ~300 belgisini ko'rsatamiz
  echo "    ${payload:0:300}" | tr '\n' ' '; echo ""
}

echo "==================================================================="
echo " AUTH: $AUTH_URL"
echo " CORE: $CORE_URL"
echo "==================================================================="

echo ""
echo "--- 1) ULANISH ---"
show "GET CORE /tariffs"            "$(req GET  "$CORE_URL/tariffs")"
show "POST AUTH /auth/send-otp (test raqam — SMS yuborilishi mumkin!)" "$(req POST "$AUTH_URL/auth/send-otp" '{"phone_number":"'"${PHONE:-+998000000000}"'"}')"

if [ -z "$PHONE" ] || [ -z "$PASSWORD" ]; then
  echo ""
  echo -e "${YEL}Himoyalangan endpointlarni tekshirish uchun:${NC} bash scripts/smoke.sh \"+998...\" \"parol\""
  exit 0
fi

echo ""
echo "--- 2) LOGIN ---"
LOGIN_OUT="$(req POST "$AUTH_URL/auth/login" '{"phone_number":"'"$PHONE"'","password":"'"$PASSWORD"'","device_fingerprint":"smoke-test"}')"
show "POST AUTH /auth/login" "$LOGIN_OUT"
LOGIN_JSON="${LOGIN_OUT%__HTTP__*}"
# access_token ni ajratib olamiz (jq bo'lmasa grep bilan)
if command -v jq >/dev/null 2>&1; then
  TOKEN="$(echo "$LOGIN_JSON" | jq -r '.access_token // .data.access_token // .token // empty' 2>/dev/null)"
else
  TOKEN="$(echo "$LOGIN_JSON" | grep -oE '"access_token"[: ]*"[^"]+"' | head -1 | grep -oE '"[^"]+"$' | tr -d '"')"
fi

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Token topilmadi — login javobini tekshiring (yuqorida).${NC}"
  exit 1
fi
echo -e "${GREEN}Token olindi.${NC}"

echo ""
echo "--- 3) HIMOYALANGAN ENDPOINTLAR (GET) ---"
show "GET AUTH /users/me"            "$(req GET "$AUTH_URL/users/me" '' "$TOKEN")"
show "GET CORE /trips/my"            "$(req GET "$CORE_URL/trips/my" '' "$TOKEN")"
show "GET CORE /trips/search?origin_lat=41.31&origin_lng=69.24" \
                                     "$(req GET "$CORE_URL/trips/search?origin_lat=41.311081&origin_lng=69.240562" '' "$TOKEN")"
show "GET CORE /vehicles"            "$(req GET "$CORE_URL/vehicles" '' "$TOKEN")"
show "GET CORE /bookings/my"         "$(req GET "$CORE_URL/bookings/my" '' "$TOKEN")"
show "GET CORE /conversations"       "$(req GET "$CORE_URL/conversations" '' "$TOKEN")"

echo ""
echo "==================================================================="
echo " Tugadi. [2xx]=OK, [4xx]=auth/validatsiya, [000]=ulanmadi."
echo " Maydon nomlarini BACKEND_CONTRACT.ru.md bilan solishtiring."
echo "==================================================================="
