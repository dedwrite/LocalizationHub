"""Narrow Telegram ingress for the owner-private AFTERHOURS Site.

The Site remains the sole source of truth. This process schedules authenticated Site sync and streams observations.
The Site keeps all tokens, canonical events and durable notification state.
"""
import hashlib
import hmac
import json
import os
import secrets
import time
import threading
import random
from urllib.parse import urlsplit, parse_qs
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


PATH = '/api/internal/telegram-gateway'
SITE_ORIGIN = os.environ.get('SITE_ORIGIN', '').rstrip('/')
OWNER = os.environ.get('TELEGRAM_CHAT_ID', '')
WEBHOOK_SECRET = os.environ.get('TELEGRAM_WEBHOOK_SECRET', '')
INTERNAL_KEY = os.environ.get('TELEGRAM_GATEWAY_INTERNAL_KEY', '')
MACHINE_TOKEN = os.environ.get('SITES_MACHINE_TOKEN', '')
READY = bool(SITE_ORIGIN.startswith('https://') and OWNER.isdecimal()
             and len(WEBHOOK_SECRET) >= 32 and len(INTERNAL_KEY) >= 40
             and len(MACHINE_TOKEN) >= 40)


def authorized_owner(update):
    message = update.get('message')
    callback = update.get('callback_query')
    if message:
        chat, sender = message.get('chat') or {}, message.get('from') or {}
    elif callback:
        chat = (callback.get('message') or {}).get('chat') or {}
        sender = callback.get('from') or {}
    else:
        return False
    return (str(chat.get('id')) == OWNER and str(sender.get('id')) == OWNER
            and chat.get('type', 'private') == 'private')


def private_outsider(update):
    message = update.get('message') or {}
    chat, sender = message.get('chat') or {}, message.get('from') or {}
    chat_id = chat.get('id')
    return (isinstance(chat_id, int) and not isinstance(chat_id, bool)
            and chat_id > 0 and chat.get('type') == 'private'
            and sender.get('id') == chat_id and str(chat_id) != OWNER
            and isinstance(message.get('text'), str))


def site_request(path, body, timeout=8):
    now = str(int(time.time() * 1000))
    nonce = str(__import__('uuid').uuid4())
    digest = hashlib.sha256(body).hexdigest()
    signed = f'POST\n{path}\n{now}\n{nonce}\n{digest}'.encode()
    signature = hmac.new(INTERNAL_KEY.encode(), signed, hashlib.sha256).hexdigest()
    request = urllib.request.Request(SITE_ORIGIN + path, data=body, method='POST', headers={
        'Content-Type': 'application/json',
        'OAI-Sites-Authorization': 'Bearer ' + MACHINE_TOKEN,
        'X-AF-Time': now, 'X-AF-Nonce': nonce, 'X-AF-Signature': signature,
    })
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            try:
                value = json.loads(raw or b'{}')
            except (ValueError, UnicodeDecodeError):
                value = {}
            return response.status, value
    except urllib.error.HTTPError as error:
        return error.code, {}
    except (urllib.error.URLError, TimeoutError, OSError):
        return 503, {}


def forward_update(body):
    return site_request(PATH, body)[0]


STOP = threading.Event()
CONDITION = threading.Condition()
SNAPSHOT = None
SEQUENCE = 0


def valid_ticket(ticket):
    if len(ticket) > 160:
        return False
    try:
        expiry, nonce, signature = ticket.split('.')
        expires = int(expiry)
        if not 0 < expires - int(time.time() * 1000) <= 300000:
            return False
        if len(nonce) != 36:
            return False
        expected = hmac.new(INTERNAL_KEY.encode(), ('AFTERHOURS-STREAM-v1\n' + expiry + '.' + nonce).encode(), hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)
    except (ValueError, TypeError):
        return False


def background_loop(action):
    global SNAPSHOT, SEQUENCE
    failures = 0
    last_report = 0
    while not STOP.is_set():
        delay = 30
        if READY:
            status, value = site_request('/api/internal/realtime', json.dumps({'action': action}).encode(), timeout=80 if action == 'delivery' else 40)
            if status == 200 and value.get('ok'):
                failures = 0
                if action == 'tick':
                    delay = max(3, min(3600, float(value.get('pollAfterMs', 20000)) / 1000))
                    if not value.get('busy'):
                        with CONDITION:
                            SNAPSHOT = value
                            SEQUENCE += 1
                            CONDITION.notify_all()
                else:
                    delay = 15
            else:
                failures += 1
                delay = min(300, 5 * 2 ** min(failures, 6))
            if failures == 1 or time.time() - last_report >= 60:
                last_report = time.time()
                print(json.dumps({'event': 'realtime-' + action, 'site_status': status, 'ok': status == 200 and bool(value.get('ok')),
                              'state': value.get('state'), 'poll_ms': value.get('pollAfterMs'),
                              'history_result': value.get('historyResult'), 'history_revision': value.get('historyRevision')}), flush=True)
        STOP.wait(delay + random.uniform(0, 0.25))


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body=b''):
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == '/realtime/events':
            ticket = parse_qs(parsed.query).get('ticket', [''])[0]
            if self.headers.get('Origin') != SITE_ORIGIN or not READY or not valid_ticket(ticket):
                return self.respond(401)
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Access-Control-Allow-Origin', SITE_ORIGIN)
            self.send_header('Vary', 'Origin')
            self.send_header('X-Accel-Buffering', 'no')
            self.end_headers()
            previous = -1
            try:
                while not STOP.is_set() and valid_ticket(ticket):
                    with CONDITION:
                        if SEQUENCE == previous:
                            CONDITION.wait(timeout=10)
                        value, sequence = SNAPSHOT, SEQUENCE
                    if sequence != previous and value:
                        self.wfile.write(('event: playback\nid: ' + str(sequence) + '\ndata: ' + json.dumps(value, ensure_ascii=False) + '\n\n').encode())
                        previous = sequence
                    else:
                        self.wfile.write(b': heartbeat\n\n')
                    self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            self.close_connection = True
            return
        if self.path != '/health':
            return self.respond(404)
        # Liveness only: credentials can be provisioned after deployment.
        return self.respond(200, b'ok')

    def do_POST(self):
        if self.path != '/telegram/webhook':
            return self.respond(404)
        actual = self.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        if not WEBHOOK_SECRET or not hmac.compare_digest(actual, WEBHOOK_SECRET):
            return self.respond(401)
        if not READY:
            return self.respond(503)
        length = self.headers.get('Content-Length', '')
        if not length.isdecimal() or int(length) > 32000:
            return self.respond(413)
        try:
            body = self.rfile.read(int(length))
            update = json.loads(body)
            update_id = update.get('update_id')
            if not isinstance(update_id, int) or isinstance(update_id, bool) or update_id < 0:
                return self.respond(400)
        except (ValueError, UnicodeDecodeError, AttributeError):
            return self.respond(400)
        owner = authorized_owner(update)
        if not owner and not private_outsider(update):
            return self.respond(200, b'ok')
        status = forward_update(body)
        message = update.get('message') or {}
        callback = update.get('callback_query') or {}
        command = str(message.get('text') or '').split(' ', 1)[0]
        kind = 'callback' if callback else 'command' if command.startswith('/') else 'message'
        print(json.dumps({'event': 'telegram-update', 'kind': kind if owner else 'outsider',
                          'update_id': update_id, 'site_status': status}), flush=True)
        return self.respond(200 if status == 200 else 503, b'ok' if status == 200 else b'retry')

    def log_message(self, format, *args):
        # No headers, URL parameters, message content or secrets in access logs.
        pass


if __name__ == '__main__':
    for action in ('tick', 'delivery'):
        threading.Thread(target=background_loop, args=(action,), daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '10000'))), Handler).serve_forever()

