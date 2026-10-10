"""Backend bilan gaplashadigan yordamchi.

⚠️ WAF Python `urllib` ning standart User-Agent'ini BLOKLAYDI (403) —
brauzer sarlavhasi bo'lmasa "hamma narsa buzuq" degan yolg'on xulosa
chiqadi. Shuning uchun UA majburiy.
"""
import json, os, time, urllib.request, urllib.error

CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tokens.json')

BASE = 'https://api.yolyolakay.com/api/v1'
UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/127.0 Safari/537.36')


def call(method, path, body=None, token=None, quiet=False):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('User-Agent', UA)
    req.add_header('Content-Type', 'application/json')
    if token:
        req.add_header('Authorization', 'Bearer ' + token)
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            raw = r.read().decode('utf-8', 'replace')
            code = r.status
    except urllib.error.HTTPError as e:
        raw = e.read().decode('utf-8', 'replace')
        code = e.code
    except Exception as e:
        return 0, {'error': str(e)}
    try:
        parsed = json.loads(raw) if raw else {}
    except Exception:
        parsed = {'raw': raw[:400]}
    if not quiet:
        print(f'  {method} {path} → {code}')
    return code, parsed


def login(phone, code='99887'):
    """OTP bir martalik — har `verify-otp` dan oldin yangi `send-otp`."""
    # Token keshi: qayta-qayta login qilish `429` ga olib keladi va
    # o'lchov «backend o'lgan» degan yolg'on natija beradi. Token 1 soat
    # yashaydi (27.08 da o'lchangan), o'lchov esa daqiqalar ichida tugaydi.
    cache = {}
    if os.path.exists(CACHE):
        try:
            cache = json.load(open(CACHE))
        except Exception:
            cache = {}
    hit = cache.get(phone)
    if hit and time.time() - hit['at'] < 2400:
        c, _ = call('GET', '/notifications', token=hit['token'], quiet=True)
        if c == 200:
            return hit['token'], {'cached': True}

    # ⚠️ `send-otp` 429 («too many requests») qaytarsa ham `verify-otp`
    # qat'iy test kodi bilan ISHLAYVERADI — shuning uchun send-otp
    # natijasiga qarab to'xtamaymiz (aks holda yolg'on «login o'lgan»).
    for typ in ('login', 'register'):
        call('POST', '/auth/send-otp',
             {'phone_number': phone, 'type': typ}, quiet=True)
        for attempt in range(4):
            c2, r2 = call('POST', '/auth/verify-otp',
                          {'phone_number': phone, 'code': code, 'type': typ},
                          quiet=True)
            if c2 == 429:
                time.sleep(int(r2.get('retry_after', 60)) + 3)
                continue
            break
        if c2 in (200, 201):
            tok = r2.get('access_token') or (r2.get('data') or {}).get('access_token')
            if tok:
                cache[phone] = {'token': tok, 'at': time.time()}
                json.dump(cache, open(CACHE, 'w'))
                return tok, r2
    return None, None
