#!/usr/bin/env python3
"""Backend da'volarini JONLI o'lchaydi.

Ishlatish:  python3 scripts/backend-probe/probe.py [all|push|ws-origin|chat|phone|contract]

Tuzoqlar va sinov akkauntlari — shu papkadagi README.md da.
"""
import datetime
import json
import os
import pathlib
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api import call, login          # noqa: E402
from ws import WS, handshake_status  # noqa: E402

DRIVER, PA, PB = '+998991234567', '+998001112233', '+998004445566'
ROOT = pathlib.Path(__file__).resolve().parents[2]

OK, BAD, WARN = '\033[32m✅\033[0m', '\033[31m🔴\033[0m', '\033[33m⚠️\033[0m'
# Ruscha kirill harflari — o'zbek lotinida UMUMAN uchramaydi, ya'ni
# matn tarjima qilinganini shu bilan aniqlaymiz.
RU = set('абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ')


def head(title):
    print(f'\n\033[1m═══ {title} ═══\033[0m')


def notifs(token):
    _, r = call('GET', '/notifications', token=token, quiet=True)
    items = r if isinstance(r, list) else (r.get('data') or [])
    return items if isinstance(items, list) else []


def fresh(before, after):
    """Faqat YANGI qo'shilganlar — umumiy sonni solishtirish yetarli emas,
    chunki oraliqda boshqa hodisa ham tushishi mumkin."""
    old = {n.get('id') for n in before}
    return [n for n in after if n.get('id') not in old]


def is_ru(n):
    return any(ch in RU for ch in f"{n.get('title', '')} {n.get('body', '')}")


def show(items, label):
    if not items:
        print(f'  {BAD} {label}: yangi yozuv YO\'Q')
        return
    for n in items:
        mark = f'{WARN} ruscha' if is_ru(n) else f'{OK} o\'zbekcha'
        print(f'  {mark}  {label}: [{n.get("type")}] '
              f'{n.get("title")} — {n.get("body")}')


def car_id(token):
    """Tasdiqlangan mashina — usiz `activate` 400 qaytaradi."""
    _, cars = call('GET', '/users/me/cars', token=token, quiet=True)
    for c in cars if isinstance(cars, list) else []:
        if c.get('moderation_status') == 'approved':
            return c['id']
    return None


def make_ride(token, vehicle, seats=4, negotiable=True):
    dep = (datetime.datetime.now(datetime.timezone.utc)
           + datetime.timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ')
    _, r = call('POST', '/rides/', {
        'origin_lat': 41.2995, 'origin_lon': 69.2401,
        'origin_address': 'Tashkent',
        'destination_lat': 39.6542, 'destination_lon': 66.9597,
        'destination_address': 'Samarkand', 'departure_time': dep,
        'total_seats': seats, 'price_per_seat': 100000,
        'is_negotiable': negotiable, 'vehicle_id': vehicle}, token=token,
        quiet=True)
    rid = r.get('ride_id') or r.get('id')
    if rid:
        call('POST', f'/rides/{rid}/activate', {}, token=token, quiet=True)
    return rid


def booking_id(resp):
    b = resp.get('booking') or resp.get('data') or resp
    return b.get('id') or b.get('booking_id')


def register_tokens(*pairs):
    for name, tok in pairs:
        call('POST', '/notifications/tokens', {
            'fcm_token': f'probe-{name}-{int(time.time() * 1000) % 10 ** 9}',
            'platform': 'android', 'language': 'uz'}, token=tok, quiet=True)


# ─────────────────────────────────────────────────────────────────────

def probe_push():
    head('Push zanjiri: bron → tasdiqlash/rad etish → bekor qilish')
    td, ta, tb = login(DRIVER)[0], login(PA)[0], login(PB)[0]
    if not (td and ta and tb):
        print(f'  {BAD} kirish muvaffaqiyatsiz'); return
    register_tokens(('d', td), ('a', ta), ('b', tb))

    car = car_id(td)
    if not car:
        print(f'  {BAD} tasdiqlangan mashina yo\'q — activate 400 beradi'); return
    rid = make_ride(td, car)
    if not rid:
        print(f'  {BAD} safar yaratilmadi'); return

    d0, a0, b0 = notifs(td), notifs(ta), notifs(tb)
    _, ba = call('POST', f'/rides/{rid}/book', {'seats': 1}, token=ta, quiet=True)
    _, bb = call('POST', f'/rides/{rid}/book', {'seats': 1}, token=tb, quiet=True)
    time.sleep(5)
    show(fresh(d0, notifs(td)), 'haydovchi (booking_created)')

    a1, b1 = notifs(ta), notifs(tb)
    call('POST', f'/rides/{rid}/bookings/{booking_id(ba)}/accept', {},
         token=td, quiet=True)
    call('POST', f'/rides/{rid}/bookings/{booking_id(bb)}/reject', {},
         token=td, quiet=True)
    time.sleep(5)
    a2 = notifs(ta)
    show(fresh(a1, a2), 'A (booking_confirmed)')
    show(fresh(b1, notifs(tb)), 'B (booking_rejected)')

    # 🔑 ENG MUHIM SINOV: A bu yerda TASDIQLANGAN. 2026-08-28 da aynan shu
    # holatda xabar kelmagan, `pending` da esa kelgan.
    call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)
    time.sleep(7)
    show(fresh(a2, notifs(ta)), 'A — TASDIQLANGAN edi (ride_cancelled)')


def ride_row(token, rid):
    """`/rides/my?role=driver` dagi AYNAN shu safar (joy hisobi shu yerda)."""
    _, my = call('GET', '/rides/my?role=driver', token=token, quiet=True)
    for x in (my.get('rides') or []):
        if x.get('id') == rid:
            return x
    return {}


def seats_line(token, rid, label):
    x = ride_row(token, rid)
    rows = [(b.get('status'), b.get('seats_booked')) for b in (x.get('bookings') or [])]
    print(f'    {label}: bo\'sh joy {x.get("available_seats")}/{x.get("total_seats")}  '
          f'bronlar={rows}')
    return x.get('available_seats')


def probe_booking():
    """🔴 EGASI 2026-08-30: «so'rov avtomatik qabul qilinyapti, ustiga yana
    Qabul/Rad etish turibdi, va Qabul bosilsa qabul qilinmayapti».

    Uchala shikoyatning ham ildizi SHU YERDA o'lchanadi. Xulosa: mijozda
    avto-qabul YO'Q — joyni backend `pending` broniga DARHOL band qiladi,
    `pending_negotiation` ga esa qilmaydi; va rad etilgan TASDIQLANGAN
    bronning joyi QAYTARILMAYDI."""
    head('Bron mantiqi: joy qachon band bo\'ladi, qabul qilish qachon yiqiladi')
    td, ta, tb = login(DRIVER)[0], login(PA)[0], login(PB)[0]
    if not (td and ta and tb):
        print(f'  {BAD} kirish muvaffaqiyatsiz'); return
    car = car_id(td)
    if not car:
        print(f'  {BAD} tasdiqlangan mashina yo\'q'); return

    print('\n  1) Joy QACHON band bo\'ladi — qabul qilishdan OLDINMI?')
    rid = make_ride(td, car, seats=4)
    call('POST', f'/rides/{rid}/book', {'seats': 2}, token=ta, quiet=True)
    free = seats_line(td, rid, 'yo\'lovchi 2 joy so\'radi (hali QABUL QILINMAGAN)')
    print(f'  {BAD if free != 4 else OK} joy qabul qilinmasdan '
          f'{"BAND QILINDI — «avtomatik qabul» shundan ko\'rinadi" if free != 4 else "band qilinmadi"}')
    call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)

    print('\n  2) Savdolashish broni joy bandlaydimi (`pending_negotiation`)?')
    rid = make_ride(td, car, seats=1)
    call('POST', f'/rides/{rid}/book', {'seats': 1, 'offered_price': 80000},
         token=tb, quiet=True)
    free = seats_line(td, rid, 'B narx taklif qildi')
    # 🔴 KUTILGAN NATIJA 2026-09-03 DA O'ZGARDI.
    #
    # Bu yer ilgari «savdolashish broni joyni bandlamaydi» deb QIZIL
    # bergan edi. Lekin 30.08 da egasi A variantini tanlagan: joy
    # FAQAT `confirmed` da band bo'ladi, `book` joyga TEGMAYDI va
    # so'rovlar soni joydan ko'p bo'lishi NORMAL.
    #
    # Ya'ni bandlamaslik — to'g'ri xatti-harakat, va oddiy bron ham
    # xuddi shunday qiladi (yuqoridagi 1-sinov). Eski qizil YOLG'ON
    # signal edi: har o'lchovda backendni bekorga ayblardik.
    print(f'  {OK if free == 1 else BAD} savdolashish broni joyni '
          f'{"bandlamaydi — oddiy bron bilan BIR XIL (A varianti)" if free == 1 else "BANDLADI — oddiy bron bilan nomuvofiq"}')
    # Endi oddiy bron oxirgi joyni oladi va savdolashishni qabul qilib bo'lmaydi.
    _, bn = call('GET', f'/rides/{rid}', token=td, quiet=True)
    _, ba = call('POST', f'/rides/{rid}/book', {'seats': 1}, token=ta, quiet=True)
    seats_line(td, rid, 'A oddiy bron qildi — oxirgi joy ketdi')
    row = ride_row(td, rid)
    neg = next((b for b in (row.get('bookings') or [])
                if b.get('status') == 'pending_negotiation'), None)
    if neg:
        c, r = call('POST', f'/rides/{rid}/bookings/{neg["id"]}/accept', {},
                    token=td, quiet=True)
        print(f'  {BAD if c != 200 else OK} savdolashish bronini QABUL QILISH '
              f'→ {c} {r.get("error", "")}')
    call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)

    print('\n  3) Rad etish joyni qaytaradimi (pending / confirmed)?')
    for stage in ('pending', 'confirmed'):
        rid = make_ride(td, car, seats=4)
        _, b = call('POST', f'/rides/{rid}/book', {'seats': 2}, token=ta, quiet=True)
        bid = booking_id(b)
        if stage == 'confirmed':
            call('POST', f'/rides/{rid}/bookings/{bid}/accept', {}, token=td, quiet=True)
        call('POST', f'/rides/{rid}/bookings/{bid}/reject', {}, token=td, quiet=True)
        time.sleep(1)
        free = seats_line(td, rid, f'{stage} bron rad etilgandan keyin')
        print(f'  {OK if free == 4 else BAD} {stage}: joy '
              f'{"qaytdi" if free == 4 else "QAYTMADI — safar abadiy to\'la bo\'lib qoladi"}')
        call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)

    print('\n  4) Rad etilgan bron ro\'yxatda qoladimi (haydovchida tarix)?')
    rid = make_ride(td, car, seats=4)
    _, b = call('POST', f'/rides/{rid}/book', {'seats': 1}, token=ta, quiet=True)
    call('POST', f'/rides/{rid}/bookings/{booking_id(b)}/reject', {}, token=td, quiet=True)
    time.sleep(1)
    row = ride_row(td, rid)
    n = len(row.get('bookings') or [])
    print(f'  {OK if n else BAD} rad etilgandan keyin `bookings[]` da {n} ta yozuv'
          f'{" — kimni rad etganini KO\'RIB BO\'LMAYDI" if not n else ""}')
    call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)


def probe_tracking():
    """🔴 EGASI 2026-08-30: «Yandexda o'zi qayerda ketayotganini ko'radi,
    bizda ko'rib bo'lmaydi — hatto haydovchi ham».

    ✅ 2026-09-04: `nearby` YOPILDI — endi u faqat HAYDOVCHIGA ochiq,
    yo'lovchi 403 oladi va safar bo'yicha `/rides/{id}/location` dan
    o'qiydi. Shuning uchun bu yerda `nearby` HAYDOVCHI tokeni bilan
    so'raladi; yo'lovchi uchun 403 ALOHIDA tekshiriladi (to'silganlik
    ham xuddi ruxsat kabi o'lchanadi).

    ⚠️ Ilgari bu probe `nearby` ni yo'lovchi tokeni bilan so'rardi va
    yopilgandan keyin «nearby haydovchini qaytarmadi» deb YOLG'ON QIZIL
    berardi — ya'ni bajarilgan ishni buzilgan deb ko'rsatardi."""
    head('Jonli kuzatuv: telematika nimani beradi, nimani bermaydi')
    td, ta = login(DRIVER)[0], login(PA)[0]
    if not (td and ta):
        print(f'  {BAD} kirish muvaffaqiyatsiz'); return
    _, me = call('GET', '/users/me', token=td, quiet=True)
    did = (me.get('user') or me).get('id')

    c, _ = call('POST', '/telematics/ping',
                {'latitude': 41.3000, 'longitude': 69.2400,
                 'speed': 12.5, 'heading': 90}, token=td, quiet=True)
    print(f'  {OK if c in (200, 202) else BAD} POST /telematics/ping → {c}')
    time.sleep(1)

    # MAXFIYLIK: yo'lovchi butun shahar haydovchilarini KO'RMASLIGI kerak.
    c, _ = call('GET', '/telematics/nearby?lat=41.3090&lon=69.2400&radius=5000',
                token=ta, quiet=True)
    print(f'  {OK if c == 403 else BAD} nearby yo\'lovchiga → {c} '
          + ('(to\'sildi)' if c == 403
             else 'OCHIQ — safarga aloqasi yo\'q odam koordinata oladi'))

    # `distance` BIRLIGI: 41.3000 → 41.3090 taxminan 1 km shimolga.
    _, near = call('GET', '/telematics/nearby?lat=41.3090&lon=69.2400&radius=5000',
                   token=td, quiet=True)
    row = next((x for x in near if x.get('driver_id') == did), None) \
        if isinstance(near, list) else None
    if not row:
        print(f'  {BAD} nearby haydovchiga ham qaytarmadi'); return
    d = row.get('distance')
    print(f'  {OK} nearby koordinata beradi: {row.get("latitude")}, {row.get("longitude")}')
    print(f'  {OK if 900 < d < 1100 else WARN} `distance` = {d} → birlik '
          f'{"METR" if 900 < d < 1100 else "NOANIQ"} (mijozda `distanceKm` deb yozilgan)')
    print(f'  {OK if row.get("heading") is not None else BAD} `heading` javobda '
          f'{"bor" if row.get("heading") is not None else "YO\'Q — mashinani burib bo\'lmaydi"}')

    # RADIUS HURMAT QILINADIMI: Jizzax markazidan 1 km so'raymiz, haydovchi
    # Toshkentda — 178 km narida. Chiqsa, radius e'tiborga olinmayapti.
    _, far = call('GET', '/telematics/nearby?lat=40.12&lon=67.84&radius=1000',
                  token=td, quiet=True)
    leaked = next((x for x in far if x.get('driver_id') == did), None) \
        if isinstance(far, list) else None
    print(f'  {BAD if leaked else OK} radius=1000 m so\'ralganda 178 km '
          f'naridagi haydovchi {"QAYTDI — radius E\'TIBORGA OLINMAYDI" if leaked else "qaytmadi"}')

    # ⚠️ HAYDOVCHI tokeni bilan: `eta` ham 2026-09-04 dan yopiq
    # (faqat haydovchi va TASDIQLANGAN yo'lovchi). Yo'lovchi tokeni
    # bilan so'ralsa natija uning boshqa sinovlardan qolgan tirik
    # safariga bog'liq bo'lib qoladi — ya'ni probe goh yashil, goh
    # qizil beradi. Ruxsat o'zi `probe_driver_telemetry` da o'lchanadi.
    for tgt, name in (((41.35, 69.30), '~6 km'), ((39.65, 66.96), '~280 km')):
        _, e = call('GET', f'/telematics/eta?driver_id={did}'
                           f'&target_lat={tgt[0]}&target_lon={tgt[1]}',
                    token=td, quiet=True)
        m = e.get('eta_minutes')
        print(f'  {BAD if not m else OK} eta ({name}) → {m} daqiqa'
              f'{" — HAR DOIM 0, ishlatib bo\'lmaydi" if not m else ""}')

    # ✅ `/routing/route` ISHLAYDI — parametrlari `origin_*`/`dest_*`
    # (30.08 da bir marta `from_*` bilan so'rab, «buzuq» degan YOLG'ON
    # xulosa chiqargan edik va xatga ham yozib yuborgandik).
    _, rt = call('GET', '/routing/route?origin_lat=41.2995&origin_lon=69.2401'
                        '&dest_lat=39.6542&dest_lon=66.9597',
                 token=ta, quiet=True)
    pts = len(rt.get('geometry') or []) if isinstance(rt, dict) else 0
    print(f'  {OK if pts > 100 else BAD} routing/route → {pts} nuqta, '
          f'{(rt.get("distance") or 0) / 1000:.0f} km')

    for p in (f'/telematics/drivers/{did}/location',
              f'/telematics/location?driver_id={did}',
              f'/rides/last/location'):
        c, _ = call('GET', p, token=ta, quiet=True)
        print(f'  {BAD if c == 404 else OK} {p} → {c}')
    # ✅ 2026-09-03: safar bo'yicha MAXFIY joylashuv qo'shildi.
    # `GET /rides/{id}/location` — faqat haydovchi va SHU safarda
    # TASDIQLANGAN yo'lovchi ko'radi. Sinovi `probe_ride_location`
    # da: kutayotgan bron ham, begona foydalanuvchi ham 403 olishi
    # SHART — aks holda haydovchining joyi ochilib qoladi.


def probe_driver_telemetry():
    """MAXFIYLIK: haydovchi telematikasini KIM ko'radi.

    🔴 NEGA ALOHIDA (2026-09-04): `nearby` yopilgani bilan haydovchining
    AYNIQ koordinatasini beradigan yana uchta manzil ochiq qolgan edi va
    ular hech qanday bog'liqlikni tekshirmasdi. To'liq zanjir shunday
    edi: begona odam ochiq qidiruvdan safarni ochadi → `driver.id` ni
    oladi → koordinatani so'raydi. Bron ham, safar ham kerak emas.

    Bizning xatimizdan keyin yopildi. Bu yerda TO'SILGANLIK ham,
    RUXSAT ham o'lchanadi: ikkinchisisiz «yopdik» degani yo'lovchining
    xaritasini o'ldirgan bo'lardi (aynan shunday bo'lgan edi).
    """
    head('Maxfiylik: haydovchi telematikasini kim ko\'radi')
    td, ta = login(DRIVER)[0], login(PB)[0]
    _, me = call('GET', '/users/me', token=td, quiet=True)
    did = (me.get('user') or me).get('id')
    car = car_id(td)
    if not (did and car):
        print(f'  {BAD} haydovchi yoki mashina yo\'q'); return

    paths = {
        'drivers/{id}/location': f'/telematics/drivers/{did}/location',
        'location?driver_id':    f'/telematics/location?driver_id={did}',
        'eta':                   f'/telematics/eta?driver_id={did}'
                                 f'&target_lat=41.35&target_lon=69.30',
    }

    rid = make_ride(td, car)
    if not rid:
        print(f'  {BAD} safar yaratilmadi'); return
    call('POST', '/telematics/ping',
         {'latitude': 41.3000, 'longitude': 69.2400,
          'speed': 12.5, 'heading': 90}, token=td, quiet=True)
    time.sleep(2)

    # ⚠️ B yo'lovchisi ATAYIN: A da boshqa sinovlardan qolgan TIRIK
    # safar bo'lishi mumkin va u yerda broni tasdiqlangan bo'lsa 200
    # olishi TO'G'RI — bu esa yolg'on qizil berardi (bir marta berdi ham).
    for label, path in paths.items():
        c, _ = call('GET', path, token=ta, quiet=True)
        print(f'  {OK if c == 403 else BAD} bronsiz begona · {label:22} → {c}'
              + ('' if c == 403 else ' OCHIQ — MAXFIYLIK BUZILGAN'))

    _, bb = call('POST', f'/rides/{rid}/book', {'seats': 1}, token=ta, quiet=True)
    bid = booking_id(bb)
    c, _ = call('GET', paths['drivers/{id}/location'], token=ta, quiet=True)
    print(f'  {OK if c == 403 else BAD} KUTAYOTGAN bron bilan → {c} (403 kutiladi)')

    call('POST', f'/rides/{rid}/bookings/{bid}/accept', {}, token=td, quiet=True)
    for label, path in paths.items():
        c, _ = call('GET', path, token=ta, quiet=True)
        print(f'  {OK if c == 200 else BAD} TASDIQLANGAN · {label:22} → {c}'
              + ('' if c == 200 else ' — yo\'lovchining xaritasi O\'LIK'))

    # Safar tugagach ruxsat ham TUGASHI kerak.
    call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)
    time.sleep(1)
    c, _ = call('GET', paths['drivers/{id}/location'], token=ta, quiet=True)
    print(f'  {OK if c == 403 else BAD} safar BEKOR qilingandan keyin → {c} '
          f'(403 kutiladi)')


def probe_ride_location():
    """MAXFIYLIK: safar haydovchisining joyini KIM ko'radi.

    🔑 Bu eng nozik tekshiruv: xato bo'lsa hech narsa «buzilmaydi»,
    shunchaki begona odam haydovchining aniq koordinatasini oladi.
    Shuning uchun bu yerda TO'SILGANLIK ham tasdiqlanadi, faqat
    ruxsat emas.
    """
    head('Maxfiylik: safar haydovchisining joyini kim ko\'radi')
    td, ta, tb = login(DRIVER)[0], login(PA)[0], login(PB)[0]
    car = car_id(td)
    if not car:
        print(f'  {BAD} tasdiqlangan mashina yo\'q'); return
    rid = make_ride(td, car)
    if not rid:
        print(f'  {BAD} safar yaratilmadi'); return

    c, _ = call('GET', f'/rides/{rid}/location', token=ta, quiet=True)
    print(f'  {OK if c == 403 else BAD} bronsiz yo\'lovchi → {c} (403 kutiladi)')

    _, ba = call('POST', f'/rides/{rid}/book', {'seats': 1}, token=ta, quiet=True)
    c, _ = call('GET', f'/rides/{rid}/location', token=ta, quiet=True)
    print(f'  {OK if c == 403 else BAD} KUTAYOTGAN bron bilan → {c} (403 kutiladi)')

    call('POST', f'/rides/{rid}/bookings/{booking_id(ba)}/accept', {},
         token=td, quiet=True)
    # ⚠️ MAYDON NOMLARI TO'LIQ: `lat`/`lon` bilan ping 400 beradi va
    # keyingi so'rov «joylashuv yo'q» (404) qaytarib, MAXFIYLIK
    # sinovi YOLG'ON qizil bo'lardi.
    call('POST', '/telematics/ping',
         {'latitude': 41.3000, 'longitude': 69.2400,
          'speed': 12.5, 'heading': 90}, token=td, quiet=True)
    time.sleep(2)
    c, loc = call('GET', f'/rides/{rid}/location', token=ta, quiet=True)
    print(f'  {OK if c == 200 else BAD} TASDIQLANGAN yo\'lovchi → {c}'
          + (f'  ({loc.get("latitude")}, {loc.get("longitude")})' if c == 200 else ''))

    c, _ = call('GET', f'/rides/{rid}/location', token=tb, quiet=True)
    print(f'  {OK if c in (403, 404) else BAD} begona foydalanuvchi → {c} '
          + ('(to\'sildi)' if c in (403, 404) else 'KO\'RA OLDI — MAXFIYLIK BUZILGAN'))
    call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)


def probe_parcel():
    """Posilka zanjiri: taklif → qabul → OLINDI → yetkazildi.

    ⚠️ `deliver` dan OLDIN `pickup` bor — 03.09 da o'lchab topildi.
    Usiz `deliver` 400 beradi («parcel must be in picked up status»).
    Mijozda ham IKKALA qadam bo'lishi shart.
    """
    head('Posilka: taklifdan yetkazishgacha')
    td, ta = login(DRIVER)[0], login(PA)[0]
    c, p = call('POST', '/parcels', {
        'origin_lat': 41.2995, 'origin_lon': 69.2401,
        'destination_lat': 39.6542, 'destination_lon': 66.9597,
        'from_address': 'Toshkent', 'to_address': 'Samarqand',
        'price': 30000, 'receiver_phone': '+998901234567',
        'size': 'small', 'description': 'hujjatlar'}, token=ta, quiet=True)
    pid = p.get('id')
    if not pid:
        print(f'  {BAD} posilka yaratilmadi → {c}'); return
    _, resp = call('POST', f'/parcels/{pid}/respond',
                   {'offered_price': 30000}, token=td, quiet=True)
    oid = (resp or {}).get('id')
    c, _ = call('POST', f'/parcels/{pid}/responses/{oid}/accept', {},
                token=ta, quiet=True)
    print(f'  {OK if c == 200 else BAD} taklif qabul qilindi → {c}')

    # 🔴 TAKLIF HOLATI qabuldan keyin `accepted` bo'lishi SHART.
    # 2026-09-04 gacha u `pending` da qolardi — mijozda posilka
    # allaqachon yo'lda bo'lsa ham «Qabul / Rad etish» tugmalari
    # turaverardi va bosilganda 400 qaytarardi.
    _, rs = call('GET', f'/parcels/{pid}/responses', token=ta, quiet=True)
    sts = [x.get('status') for x in rs] if isinstance(rs, list) else []
    print(f'  {OK if "accepted" in sts else BAD} taklif holati qabuldan '
          f'keyin: {sts}')
    c, _ = call('POST', f'/parcels/{pid}/pickup', {}, token=td, quiet=True)
    print(f'  {OK if c == 200 else BAD} haydovchi OLDI (pickup) → {c}')
    c, _ = call('POST', f'/parcels/{pid}/deliver', {}, token=td, quiet=True)
    _, one = call('GET', f'/parcels/{pid}', token=ta, quiet=True)
    st = (one.get('parcel') or one).get('status')
    print(f'  {OK if st == "delivered" else BAD} yetkazildi → {c}, holat: {st}')

    # ✅ 2026-09-04: JO'NATUVCHI ham yopa oladi.
    # 🔴 Nega so'ralgandi: posilka `picked_up` da abadiy qolib ketardi —
    # haydovchi tugmani bosmasa, jo'natuvchining qo'lidan hech narsa
    # kelmasdi. Endi ikkala tomon ham yopa oladi.
    # ⚠️ Begona odam yopa OLMASLIGI ham shu yerda o'lchanadi: bu
    # kim posilkani yopganini o'zgartiradigan ruxsat.
    p2 = _parcel(ta, td)
    if p2:
        # ⚠️ AYNAN 403: 2026-09-04 gacha 400 kelardi (ruxsat masalasi
        # so'rov shakli sifatida ko'rsatilardi) — biz so'radik, tuzatildi.
        c, _ = call('POST', f'/parcels/{p2}/confirm-delivery', {},
                    token=tb_token(), quiet=True)
        print(f'  {OK if c == 403 else BAD} begona odam yopa olmadi → {c} '
              f'(403 kutiladi)')
        c, _ = call('POST', f'/parcels/{p2}/confirm-delivery', {},
                    token=ta, quiet=True)
        _, one = call('GET', f'/parcels/{p2}', token=ta, quiet=True)
        st = (one.get('parcel') or one).get('status')
        print(f'  {OK if c == 200 and st == "delivered" else BAD} '
              f'JO\'NATUVCHI o\'zi yopdi → {c}, holat: {st}')


def tb_token():
    return login(PB)[0]


def _parcel(sender, driver):
    """Posilkani `picked_up` holatiga olib boradi va id sini qaytaradi.

    ⚠️ Har qadam TEKSHIRILADI. Aks holda zanjirning o'rtasi uzilganda
    (masalan haydovchining posilka kvotasi tugasa) oxirgi qadam
    tabiiyki 400 beradi va probe «jo'natuvchi yopa olmadi» deb YOLG'ON
    QIZIL ko'rsatadi — aslida gap boshqa joyda.
    """
    _, p = call('POST', '/parcels', {
        'origin_lat': 41.2995, 'origin_lon': 69.2401,
        'destination_lat': 39.6542, 'destination_lon': 66.9597,
        'from_address': 'Toshkent', 'to_address': 'Samarqand',
        'price': 30000, 'receiver_phone': '+998901234567',
        'size': 'small', 'description': 'hujjatlar'}, token=sender, quiet=True)
    pid = (p or {}).get('id')
    if not pid:
        return None
    c, resp = call('POST', f'/parcels/{pid}/respond',
                   {'offered_price': 30000}, token=driver, quiet=True)
    oid = (resp or {}).get('id')
    if not oid:
        print(f'  {WARN} ikkinchi posilkaga taklif berilmadi → {c} '
              f'({str(resp)[:80]}) — jo\'natuvchi sinovi o\'tkazib yuborildi')
        return None
    c, _ = call('POST', f'/parcels/{pid}/responses/{oid}/accept', {},
                token=sender, quiet=True)
    if c != 200:
        print(f'  {WARN} taklif qabul qilinmadi → {c} — o\'tkazib yuborildi')
        return None
    c, _ = call('POST', f'/parcels/{pid}/pickup', {}, token=driver, quiet=True)
    if c != 200:
        print(f'  {WARN} pickup → {c} — o\'tkazib yuborildi')
        return None
    return pid


def probe_ws_origin():
    head('Saytdan WebSocket ulanadimi (`Origin` ruxsat ro\'yxati)')
    td, _ = login(DRIVER)
    if not td:
        print(f'  {BAD} kirish muvaffaqiyatsiz'); return
    # Sayt AYNAN `.co.uz` da ishlaydi va brauzer `Origin` ni MAJBURAN
    # qo'shadi — ya'ni bu qatorlar saytdagi haqiqiy holatni ko'rsatadi.
    for origin in [None,
                   'https://yolyolakay.co.uz',
                   'https://www.yolyolakay.co.uz',
                   'https://yolyolakay.com',
                   'http://localhost:3000',
                   'https://yolyolakay-frontend.vercel.app']:
        code = handshake_status(td, origin)
        mark = OK if code == 101 else BAD
        print(f'  {mark} {str(origin or "(Origin yuborilmadi)"):42} {code}')


def probe_chat():
    head('Chat: xabar yetadimi, tarix to\'g\'ri qaytadimi')
    td, ta = login(DRIVER)[0], login(PA)[0]
    if not (td and ta):
        print(f'  {BAD} kirish muvaffaqiyatsiz'); return
    _, me = call('GET', '/users/me', token=ta, quiet=True)
    passenger = (me.get('user') or me).get('id')
    _, med = call('GET', '/users/me', token=td, quiet=True)
    driver = (med.get('user') or med).get('id')

    w = WS(td)
    print(f'  qo\'l berish: {w.status}')
    if '101' not in w.status:
        print(f'  {BAD} ulanmadi'); w.close(); return
    time.sleep(1)
    marker = f'probe {int(time.time())}'
    w.send({'event': 'send_message',
            'data': {'receiver_id': passenger, 'recipient_id': passenger,
                     'content': marker}})
    got = [f for f in w.drain(6) if 'new_message' in f]
    w.close()
    print(f'  {OK if got else BAD} serverdan «new_message» kadri')

    # ⚠️ Chat ATAYIN `/notifications` ga YOZILMAYDI — backend xati
    # 2026-08-28: u faqat tizim lentasi (bron, safar, tarif). Chat pushi
    # to'g'ridan-to'g'ri FCM'ga ketadi va uni CLI dan KO'RIB BO'LMAYDI —
    # bannerni faqat qurilmada tekshirish mumkin.
    time.sleep(3)
    _, hist = call('GET', f'/notifications/history?user_id_1={passenger}'
                          f'&user_id_2={driver}', token=ta, quiet=True)
    items = hist if isinstance(hist, list) else (hist.get('data')
                                                 or hist.get('messages') or [])
    found = any(marker in json.dumps(m, ensure_ascii=False) for m in items)
    print(f'  {OK if found else BAD} xabar tarixda ({len(items)} ta)')

    # 🔴 2026-08-28: `history` PARAMETR TARTIBIGA SEZGIR edi — bitta
    # suhbat uchun 4 / 3 / 0 ta natija qaytardi. Mijozlarimiz «o'zini
    # birinchi» yuboradi va shu bilan to'g'ri ishlaydi, lekin bu tasodif.
    # Simmetriklik so'raldi; shu yerda qo'riqlanadi.
    def count(token, a, b):
        _, r = call('GET', f'/notifications/history?user_id_1={a}&user_id_2={b}',
                    token=token, quiet=True)
        x = r if isinstance(r, list) else (r.get('data') or r.get('messages') or [])
        return len(x)

    same = count(ta, passenger, driver)
    swapped = count(ta, driver, passenger)
    mark = OK if same == swapped else BAD
    print(f'  {mark} tartib simmetrikmi: o\'zi-birinchi {same} ta, '
          f'teskari {swapped} ta')

    print(f'  {WARN} push bannerini CLI dan tekshirib BO\'LMAYDI — qurilmada')


def probe_phone():
    head('Tasdiqlangan bronda haydovchi telefoni ochiladimi')
    td, ta = login(DRIVER)[0], login(PA)[0]
    if not (td and ta):
        print(f'  {BAD} kirish muvaffaqiyatsiz'); return
    car = car_id(td)
    rid = make_ride(td, car) if car else None
    if not rid:
        print(f'  {BAD} safar yaratilmadi'); return
    _, ba = call('POST', f'/rides/{rid}/book', {'seats': 1}, token=ta, quiet=True)
    call('POST', f'/rides/{rid}/bookings/{booking_id(ba)}/accept', {},
         token=td, quiet=True)
    time.sleep(2)
    _, r = call('GET', f'/rides/{rid}', token=ta, quiet=True)
    blob = json.dumps(r, ensure_ascii=False)
    # 🔑 SAVOL BITTA: raqam KELDIMI. Kalit nomi backendning ishi —
    # uchala nomni ALOHIDA qizil qilish yolg'on signal berardi
    # (`driver_phone` hech qachon bo'lmagan, lekin har o'lchovda
    # qizil chiqib turardi).
    keys = [k for k in ('phone', 'phone_number', 'driver_phone')
            if f'"{k}"' in blob]
    print(f'  {OK if keys else BAD} tasdiqlangan bronda telefon '
          + (f'KELDI (kalit: {", ".join(keys)})' if keys else 'KELMADI'))
    d = (r.get('ride') or r).get('driver') or {}
    print(f'  haydovchi obyekti: {sorted(d.keys()) or "(yo\'q)"}')
    call('POST', f'/rides/{rid}/cancel', {'reason': 'probe'}, token=td, quiet=True)


def probe_contract():
    head('Swagger yo\'llari o\'zgardimi')
    frozen = ROOT / 'contracts' / 'swagger-paths.txt'
    out = subprocess.run(
        ['curl', '-s', '-A', 'Mozilla/5.0', '-u', 'KernelStingray:KeRSt!n90$8!',
         'https://api.yolyolakay.com/api/v1/docs/doc.json'],
        capture_output=True, text=True).stdout
    try:
        doc = json.loads(out)
    except Exception:
        print(f'  {BAD} doc.json o\'qilmadi'); return
    live = sorted(f'{m.upper():6} {p}' for p, ops in doc['paths'].items()
                  for m in ops)
    old = [l.rstrip('\n') for l in frozen.read_text().splitlines() if l.strip()]
    norm = lambda xs: {' '.join(x.split()) for x in xs}
    a, b = norm(old), norm(live)
    print(f'  muzlatilgan: {len(a)} yo\'l · jonli: {len(b)} yo\'l')
    # 🔑 Backend QO'SHGANINI aytadi, OLIB TASHLAGANINI aytmaydi — shuning
    # uchun diff har hisobotdan keyin olinadi.
    for p in sorted(a - b):
        print(f'  {BAD} YO\'QOLDI:  {p}')
    for p in sorted(b - a):
        print(f'  {WARN} qo\'shildi: {p}')
    if a == b:
        print(f'  {OK} farq yo\'q')


# ─────────────────────────────────────────────────────────────────────
# HAR BIR FUNKSIYA ISHLAYDIMI
#
# 🔴 NEGA (egasi, 2026-09-04: «yangiliklar qo'shmasdan har bir
# funksiyamizni ishlashini ta'minlashimiz kerak»).
#
# Yuqoridagi o'lchovlar ALOHIDA zanjirlarni tekshiradi (push, bron,
# posilka, chat...). Lekin ilovada va saytda ulardan tashqari o'nlab
# amal bor va ularning ko'pi hech qachon jonli o'lchanmagan: mashina
# qo'shish, safarni yakunlash, kelishuv, reyting, bloklash, sessiyalar,
# yo'nalish obunasi.
#
# Bu bo'lim har birini AYNAN foydalanuvchi bosadigan ketma-ketlikda
# chaqiradi va javobni yozadi. Maqsad — «ishlayapti deb o'ylayapmiz»
# degan gapni «o'lchandi» ga aylantirish.
#
# ⚠️ BUZUVCHI AMALLAR ATAYIN CHAQIRILMAYDI: `DELETE /users/me`
# (hisobni o'chirish) va `POST /billing/pay` (haqiqiy to'lov). Ular
# «o'lchanmadi» deb belgilanadi — chunki sinov akkaunti yo'qolsa
# qolgan hamma o'lchov ham yo'qoladi.
OK, BAD, SKIP = '✅', '🔴', '⚠️'
_results = []


def mark(sign, name, note=''):
    _results.append((sign, name, note))
    print(f'  {sign} {name}' + (f' — {note}' if note else ''))


def probe_features():
    head('HAR BIR FUNKSIYA ISHLAYDIMI')
    td, ta = login(DRIVER)[0], login(PA)[0]
    _results.clear()

    # ===== PROFIL =====
    print('\nProfil')
    code, me = call('GET', '/users/me', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'profilni o\'qish', f'{code}')
    uid = (me.get('user') or me).get('id') if isinstance(me, dict) else None
    old_name = ((me.get('user') or me).get('name') or 'Sinov')
    code, _ = call('PUT', '/users/profile',
                   {'name': old_name, 'locale': 'uz'}, token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'profilni tahrirlash (ism + til)', f'{code}')
    if uid:
        code, _ = call('GET', f'/users/{uid}', token=ta, quiet=True)
        mark(OK if code == 200 else BAD, 'begona profilni ochish', f'{code}')

    # ===== MASHINA =====
    print('\nMashina')
    code, car = call('POST', '/users/me/cars', {
        'brand': 'Chevrolet', 'model': 'Cobalt', 'year': 2021,
        'color': 'oq', 'gov_number': f'01A{int(time.time()) % 1000}BC',
        'seats': 4}, token=td, quiet=True)
    new_car = car.get('id') if isinstance(car, dict) else None
    mark(OK if code in (200, 201) and new_car else BAD, 'mashina qo\'shish', f'{code}')
    if new_car:
        code, _ = call('PUT', f'/users/me/cars/{new_car}',
                       {'color': 'qora'}, token=td, quiet=True)
        mark(OK if code == 200 else BAD, 'mashinani tahrirlash', f'{code}')
        code, _ = call('DELETE', f'/users/me/cars/{new_car}', token=td, quiet=True)
        mark(OK if code in (200, 204) else BAD, 'mashinani o\'chirish', f'{code}')

    # ===== SAFAR HAYOT SIKLI =====
    print('\nSafar')
    vehicle = car_id(td)
    if not vehicle:
        mark(SKIP, 'safar zanjiri', 'tasdiqlangan mashina yo\'q')
    else:
        rid = make_ride(td, vehicle, seats=3)
        mark(OK if rid else BAD, 'safar yaratish + faollashtirish', str(rid)[:8])
        if rid:
            code, _ = call('GET', f'/rides/{rid}', token=td, quiet=True)
            mark(OK if code == 200 else BAD, 'safarni ochish', f'{code}')
            code, my = call('GET', '/rides/my', token=td, quiet=True)
            mark(OK if code == 200 else BAD, 'mening safarlarim', f'{code}')
            code, _ = call('POST', f'/rides/{rid}/start', {}, token=td, quiet=True)
            mark(OK if code in (200, 201) else BAD, 'safarni boshlash', f'{code}')
            code, _ = call('POST', f'/rides/{rid}/complete', {}, token=td, quiet=True)
            mark(OK if code in (200, 201) else BAD, 'safarni yakunlash', f'{code}')

            # Bekor qilish — ALOHIDA safarda (yakunlangan safar bekor
            # qilinmaydi, aks holda o'lchov yolg'on «buzuq» beradi).
            rid2 = make_ride(td, vehicle, seats=2)
            if rid2:
                code, _ = call('POST', f'/rides/{rid2}/cancel',
                               {'reason': 'sinov'}, token=td, quiet=True)
                mark(OK if code in (200, 201) else BAD, 'safarni bekor qilish', f'{code}')

    # ===== QIDIRUV =====
    print('\nQidiruv')
    # ⚠️ MAYDON NOMLARI MIJOZDAN OLINADI (`ride.dart` → `toQuery`).
    # Birinchi o'lchovda bu yerda `destination_lat`/`seats` yozilgandi va
    # 400 keldi — men uni «qidiruv buzuq» deb yozishimga oz qolgandi.
    # Backend to'g'ri edi, so'rov noto'g'ri edi.
    #
    # 🔑 `include_test` SHART (14.09.2026 dan): backend sinov hisobining
    # safarlarini qidiruvdan CHIQARIB tashladi (biz o'zimiz so'ragandik).
    # Parametrsiz so'rov SINOV SAFARINI TOPMAYDI va o'lchov «qidiruv
    # o'lgan» degan yolg'on xulosa beradi — bu tuzoqqa bir kun ichida
    # besh marta tushdim. Qiymati ahamiyatsiz: backend faqat BORLIGIGA
    # qaraydi (`include_test=false` ham sinov safarini QO'SHADI — bu
    # backendning xatosi, xatda yozilgan).
    TEST = '&include_test=true'
    code, found = call(
        'GET', '/rides/search?origin_lat=41.2995&origin_lon=69.2401'
               '&dest_lat=39.6542&dest_lon=66.9597&radius_km=50&min_seats=1'
               + TEST,
        token=ta, quiet=True)
    mark(OK if code == 200 else BAD, 'qidiruv (koordinata + o\'rindiq)', f'{code}')
    code, _ = call(
        'GET', '/rides/search?origin_lat=41.2995&origin_lon=69.2401'
               '&dest_lat=39.6542&dest_lon=66.9597&radius_km=50'
               '&price_min=1000&price_max=999000' + TEST, token=ta, quiet=True)
    mark(OK if code == 200 else BAD, 'qidiruv (narx filtri)', f'{code}')
    code, _ = call('GET', '/rides/recommendations', token=ta, quiet=True)
    mark(OK if code == 200 else BAD, 'tavsiyalar', f'{code}')

    # ===== KELISHUV =====
    print('\nKelishuv (narx muhokamasi)')
    if vehicle:
        rid3 = make_ride(td, vehicle, seats=4, negotiable=True)
        if rid3:
            # Maydon nomi mijozdan (`booking.dart` → `toJson`): `seats`.
            code, resp = call('POST', f'/rides/{rid3}/book',
                              {'seats': 1, 'offered_price': 80000},
                              token=ta, quiet=True)
            bid = booking_id(resp) if code in (200, 201) else None
            mark(OK if bid else BAD, 'narx taklif qilib bron', f'{code}')
            if bid:
                # Maydon nomi mijozdan: `new_price` (`price` EMAS).
                code, _ = call(
                    'POST', f'/rides/{rid3}/bookings/{bid}/counter',
                    {'new_price': 90000}, token=td, quiet=True)
                mark(OK if code in (200, 201) else BAD,
                     'haydovchining qarshi taklifi', f'{code}')
                code, _ = call(
                    'POST', f'/rides/{rid3}/bookings/{bid}/accept', {},
                    token=td, quiet=True)
                mark(OK if code in (200, 201) else BAD, 'bronni qabul qilish', f'{code}')
            call('POST', f'/rides/{rid3}/cancel', {'reason': 'sinov'},
                 token=td, quiet=True)

    # ===== REYTING =====
    print('\nReyting va sharh')
    if uid:
        code, _ = call('POST', '/rating',
                       {'reviewee_id': uid, 'rating': 5,
                        'comment': 'Sinov o\'lchovi'}, token=ta, quiet=True)
        mark(OK if code in (200, 201, 400, 409) else BAD, 'baho berish',
             f'{code}' + (' (takroriy baho rad etiladi — normal)'
                          if code in (400, 409) else ''))
        code, _ = call('GET', f'/rating?reviewee_id={uid}', token=ta, quiet=True)
        mark(OK if code == 200 else BAD, 'sharhlarni o\'qish', f'{code}')

    # ===== TARIF =====
    print('\nTarif va to\'lov')
    code, _ = call('GET', '/billing/plans', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'tariflar ro\'yxati', f'{code}')
    code, _ = call('GET', '/billing/subscription', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'joriy obuna', f'{code}')
    code, _ = call('GET', '/billing/cards', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'saqlangan kartalar', f'{code}')
    mark(SKIP, 'tarif sotib olish', 'ATAYIN chaqirilmadi — haqiqiy to\'lov')

    # ===== BILDIRISHNOMA =====
    print('\nBildirishnomalar')
    code, _ = call('GET', '/notifications', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'bildirishnomalar ro\'yxati', f'{code}')
    # ⚠️ `/notifications/history` — bu CHAT tarixi (mijozda shunday
    # ishlatiladi): ikkala suhbatdoshning id si SHART. Uni bo'sh
    # chaqirib «buzuq» deb yozish yolg'on bo'lardi.
    _, me_a = call('GET', '/users/me', token=ta, quiet=True)
    aid = (me_a.get('user') or me_a).get('id') if isinstance(me_a, dict) else None
    if uid and aid:
        code, _ = call('GET',
                       f'/notifications/history?user_id_1={aid}&user_id_2={uid}',
                       token=ta, quiet=True)
        mark(OK if code == 200 else BAD, 'yozishma tarixi', f'{code}')
    code, _ = call('GET', '/notifications/chats', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'suhbatlar ro\'yxati', f'{code}')

    # ===== XAVFSIZLIK =====
    print('\nXavfsizlik')
    code, _ = call('GET', '/auth/sessions', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'kirilgan qurilmalar', f'{code}')
    code, _ = call('GET', '/users/blocked', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'bloklanganlar ro\'yxati', f'{code}')
    mark(SKIP, 'hisobni o\'chirish', 'ATAYIN chaqirilmadi — sinov akkaunti yo\'qoladi')

    # ===== YO'NALISH OBUNASI =====
    print('\nYo\'nalish obunasi')
    # Mijoz KOORDINATA yuboradi, manzil matnini emas.
    code, sub = call('POST', '/rides/route-subscriptions', {
        'origin_lat': 41.2995, 'origin_lon': 69.2401,
        'dest_lat': 39.6542, 'dest_lon': 66.9597}, token=ta, quiet=True)
    sub_id = sub.get('id') if isinstance(sub, dict) else None
    mark(OK if code in (200, 201) else BAD, 'yo\'nalishga obuna', f'{code}')
    code, _ = call('GET', '/rides/route-subscriptions', token=ta, quiet=True)
    mark(OK if code == 200 else BAD, 'obunalar ro\'yxati', f'{code}')
    if sub_id:
        code, _ = call('DELETE', f'/rides/route-subscriptions/{sub_id}',
                       token=ta, quiet=True)
        mark(OK if code in (200, 204) else BAD, 'obunani bekor qilish', f'{code}')

    # ===== DAROMAD =====
    print('\nDaromad')
    code, _ = call('GET', '/rides/earnings', token=td, quiet=True)
    mark(OK if code == 200 else BAD, 'haydovchi daromadi', f'{code}')

    # ===== XULOSA =====
    bad = [r for r in _results if r[0] == BAD]
    skip = [r for r in _results if r[0] == SKIP]
    print(f'\n{"─" * 60}')
    print(f'  O\'lchandi: {len(_results)} ta amal · '
          f'ishlaydi: {len(_results) - len(bad) - len(skip)} · '
          f'buzuq: {len(bad)} · o\'lchanmadi: {len(skip)}')
    for _, name, note in bad:
        print(f'  {BAD} {name} — {note}')


COMMANDS = {'push': probe_push, 'ws-origin': probe_ws_origin,
            'booking': probe_booking, 'tracking': probe_tracking,
            'ride-location': probe_ride_location,
            'driver-telemetry': probe_driver_telemetry, 'parcel': probe_parcel,
            'chat': probe_chat, 'phone': probe_phone,
            'features': probe_features,
            'contract': probe_contract}

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if what == 'all':
        for fn in COMMANDS.values():
            fn()
    elif what in COMMANDS:
        COMMANDS[what]()
    else:
        print(f'Noma\'lum buyruq: {what}\nMavjud: all, ' + ', '.join(COMMANDS))
        sys.exit(2)
