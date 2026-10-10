"""Eng kichik WebSocket mijozi (RFC 6455) — `websockets` kutubxonasi yo'q.

Faqat o'lchov uchun: qo'l berish, matnli kadr yuborish, kadrlarni o'qish.
Bo'lingan (fragmented) kadrlar va 125 baytdan uzun niqoblanmagan
javoblar oddiy holda ishlanadi; bizga shuncha yetadi.
"""
import base64, json, os, socket, ssl, struct, time

HOST, PORT = 'api.yolyolakay.com', 443


class WS:
    def __init__(self, token, timeout=12):
        raw = socket.create_connection((HOST, PORT), timeout=timeout)
        self.s = ssl.create_default_context().wrap_socket(
            raw, server_hostname=HOST)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f'GET /ws?token={token} HTTP/1.1\r\n'
            f'Host: {HOST}\r\n'
            'Upgrade: websocket\r\n'
            'Connection: Upgrade\r\n'
            f'Sec-WebSocket-Key: {key}\r\n'
            'Sec-WebSocket-Version: 13\r\n'
            # WAF standart Python UA'sini bloklaydi (403) — brauzer sarlavhasi.
            'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/127.0 Safari/537.36\r\n\r\n'
            # 🔴 `Origin` ATAYIN yuborilmaydi: backend uni ruxsat ro'yxati
            # bilan tekshiradi va `yolyolakay.co.uz` ro'yxatda YO'Q (403).
            # Mobil ilova ham `Origin` yubormaydi — shuning uchun mobil
            # chat ishlaydi, saytdagisi esa yo'q.
        )
        self.s.sendall(req.encode())
        self.buf = b''
        while b'\r\n\r\n' not in self.buf:
            chunk = self.s.recv(4096)
            if not chunk:
                break
            self.buf += chunk
        head, _, self.buf = self.buf.partition(b'\r\n\r\n')
        self.status = head.split(b'\r\n')[0].decode('latin1')

    def send(self, obj):
        data = json.dumps(obj).encode()
        mask = os.urandom(4)
        n = len(data)
        if n < 126:
            hdr = struct.pack('!BB', 0x81, 0x80 | n)
        else:
            hdr = struct.pack('!BBH', 0x81, 0x80 | 126, n)
        self.s.sendall(hdr + mask +
                       bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _need(self, n):
        while len(self.buf) < n:
            self.s.settimeout(3)
            try:
                chunk = self.s.recv(8192)
            except (socket.timeout, ssl.SSLWantReadError):
                return False
            if not chunk:
                return False
            self.buf += chunk
        return True

    def recv(self):
        """Bitta kadr qaytaradi yoki vaqt tugasa None."""
        if not self._need(2):
            return None
        b1, b2 = self.buf[0], self.buf[1]
        ln, off = b2 & 0x7F, 2
        if ln == 126:
            if not self._need(4):
                return None
            ln, off = struct.unpack('!H', self.buf[2:4])[0], 4
        elif ln == 127:
            if not self._need(10):
                return None
            ln, off = struct.unpack('!Q', self.buf[2:10])[0], 10
        if not self._need(off + ln):
            return None
        payload = self.buf[off:off + ln]
        self.buf = self.buf[off + ln:]
        if b1 & 0x0F == 0x08:
            return '__CLOSE__'
        return payload.decode('utf-8', 'replace')

    def drain(self, seconds=6):
        out, until = [], time.time() + seconds
        while time.time() < until:
            f = self.recv()
            if f is None:
                continue
            out.append(f)
            if f == '__CLOSE__':
                break
        return out

    def close(self):
        try:
            self.s.close()
        except Exception:
            pass


def handshake_status(token, origin=None):
    """Faqat qo'l berish kodini qaytaradi (101 / 403 / …).

    🔴 `origin` berilsa backend uni RUXSAT RO'YXATI bilan tekshiradi.
    Brauzer WebSocket ochganda `Origin` ni majburan qo'shadi va uni olib
    tashlab bo'lmaydi — ya'ni `origin` berilgan qator saytdagi HAQIQIY
    holatni ko'rsatadi, `None` esa mobil ilovanikini.
    """
    raw = socket.create_connection((HOST, PORT), timeout=15)
    s = ssl.create_default_context().wrap_socket(raw, server_hostname=HOST)
    key = base64.b64encode(os.urandom(16)).decode()
    extra = (
        'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/127.0 Safari/537.36\r\n'
    ) + (f'Origin: {origin}\r\n' if origin else '')
    s.sendall((f'GET /ws?token={token} HTTP/1.1\r\nHost: {HOST}\r\n'
               'Upgrade: websocket\r\nConnection: Upgrade\r\n'
               f'Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n'
               + extra + '\r\n').encode())
    data = b''
    try:
        while b'\r\n\r\n' not in data and len(data) < 8192:
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
    finally:
        s.close()
    try:
        return int(data.split(b'\r\n')[0].split()[1])
    except Exception:
        return 0
