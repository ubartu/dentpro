"""Server-only transactional mail adapter; no user-controlled message/recipient API."""
import base64
import hashlib
import hmac
import os
import re
from dataclasses import dataclass, field
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlparse
import httpx
from .runtime import cloud_mode

@dataclass(frozen=True)
class MailConfig:
    provider: str
    sender: str = ''
    reset_url: str = ''
    secret: str = field(default='', repr=False)
    api_key: str = field(default='', repr=False)

def secret_value(name):
    filename = os.getenv(name + '_FILE')
    if filename and os.getenv(name): raise ValueError('Ambiguous mail secret configuration')
    return Path(filename).read_text().strip() if filename else os.getenv(name, '').strip()

def mail_config():
    provider = os.getenv('DENTPRO_MAIL_PROVIDER', 'disabled')
    if provider == 'disabled': return MailConfig(provider)
    if provider not in ('resend', 'file') or (cloud_mode() and provider == 'file'):
        raise ValueError('Unsupported mail provider for this environment')
    sender = os.getenv('DENTPRO_MAIL_FROM', '').strip()
    url = os.getenv('DENTPRO_RESET_URL', '').strip()
    parsed = urlparse(url)
    if (not re.fullmatch(r'[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+', sender)
        or parsed.username or parsed.password or not parsed.hostname or parsed.query or parsed.fragment
        or parsed.path != '/reset-password'
        or (parsed.scheme != 'https' and not (not cloud_mode() and parsed.scheme == 'http' and parsed.hostname in ('localhost','127.0.0.1')))):
        raise ValueError('Set a valid mail sender and trusted HTTPS reset-password URL')
    secret = secret_value('DENTPRO_RESET_SECRET')
    key = secret_value('RESEND_API_KEY') if provider == 'resend' else ''
    if len(secret) < 32 or (provider == 'resend' and not key):
        raise ValueError('Mail credentials are missing')
    return MailConfig(provider, sender, url, secret, key)

def reset_token(reset_id, secret):
    # High-entropy UUID plus a private HMAC key allows durable retries without
    # persisting an unencrypted bearer credential or regenerating emailed links.
    digest = hmac.new(secret.encode(), ('dentpro-reset-v1:' + reset_id).encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode().rstrip('=')

def send_mail(config, job_id, recipient, subject, body):
    if config.provider == 'file':
        directory = Path(os.getenv('DENTPRO_MAILBOX_DIR', '.data/mailbox'))
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        message = EmailMessage()
        message['From'] = config.sender; message['To'] = recipient; message['Subject'] = subject
        message.set_content(body)
        filename = directory / (job_id + '.eml')
        fd = os.open(filename, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, 'wb') as target: target.write(message.as_bytes())
        return 'local-file'
    if config.provider != 'resend': raise ValueError('Mail delivery is disabled')
    # Provider errors are deliberately not logged or persisted: payloads contain links.
    response = httpx.post('https://api.resend.com/emails',
        headers={'Authorization':'Bearer ' + config.api_key, 'Idempotency-Key':'dentpro-mail-' + job_id},
        json={'from':config.sender,'to':[recipient],'subject':subject,'text':body}, timeout=8.0)
    response.raise_for_status()
    result = response.json().get('id')
    if not isinstance(result, str) or len(result) > 200: raise ValueError('Invalid mail provider response')
    return result
