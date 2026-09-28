"""Narrow Telegram ingress for the owner-private AFTERHOURS Site.

The Site remains the sole source of truth. This process has no Spotify logic,
database, notification queue or local state that affects correctness.
"""
import hashlib
import hmac
import json
import os
import secrets
import time
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


def forward_update(body):
    now = str(int(time.time() * 1000))
    nonce = str(__import__('uuid').uuid4())
    digest = hashlib.sha256(body).hexdigest()
    signed = f'POST\n{PATH}\n{now}\n{nonce}\n{digest}'.encode()
    signature = hmac.new(INTERNAL_KEY.encode(), signed, hashlib.sha256).hexdigest()
    request = urllib.request.Request(SITE_ORIGIN + PATH, data=body, method='POST', headers={
        'Content-Type': 'application/json',
        'OAI-Sites-Authorization': 'Bearer ' + MACHINE_TOKEN,
        'X-AF-Time': now, 'X-AF-Nonce': nonce, 'X-AF-Signature': signature,
    })
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except (urllib.error.URLError, TimeoutError, OSError):
        return 503


class Handler(BaseHTTPRequestHandler):
    def respond(self, status, body=b''):
        self.send_response(status)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
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
    ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '10000'))), Handler).serve_forever()
