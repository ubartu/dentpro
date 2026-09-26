"""Deployment settings. Cloud mode fails closed when its security boundary is absent."""

import os
from pathlib import Path
from urllib.parse import urlparse, parse_qs


def environment() -> str:
    value = os.getenv('APP_ENV', 'development')
    if value not in {'development', 'cloud'}:
        raise RuntimeError('APP_ENV must be development or cloud')
    return value


def cloud_mode() -> bool:
    return environment() == 'cloud'


def database_url() -> str:
    secret_file = os.getenv('DATABASE_URL_FILE')
    if secret_file and os.getenv('DATABASE_URL'):
        raise RuntimeError('Set only one of DATABASE_URL and DATABASE_URL_FILE')
    value = Path(secret_file).read_text().strip() if secret_file else os.getenv('DATABASE_URL', '')
    if cloud_mode():
        if not value.startswith('postgresql+psycopg://'):
            raise RuntimeError('Cloud mode requires a managed PostgreSQL DATABASE_URL')
        query = parse_qs(urlparse(value).query)
        if query.get('sslmode') != ['verify-full']:
            raise RuntimeError('Cloud PostgreSQL must use sslmode=verify-full')
    return value or 'sqlite:///.data/dentpro.db'


def cors_origins() -> list[str]:
    if not cloud_mode():
        return ['http://localhost:3000', 'http://127.0.0.1:3000']
    raw = os.getenv('DENTPRO_CORS_ORIGINS', '')
    origins = [part.strip().rstrip('/') for part in raw.split(',') if part.strip()]
    def invalid(origin: str) -> bool:
        parsed = urlparse(origin)
        return (parsed.scheme != 'https' or not parsed.hostname or parsed.username is not None
                or parsed.password is not None or parsed.path or parsed.query or parsed.fragment)
    if not origins or any(invalid(origin) for origin in origins):
        raise RuntimeError('Cloud mode requires explicit HTTPS DENTPRO_CORS_ORIGINS')
    return origins
