"""Database-backed per-identifier throttling for cloud sign-in endpoints."""

import hashlib
from datetime import timedelta, timezone
from fastapi import HTTPException
from sqlalchemy import text
from .db import now
from .operations_models import LoginThrottle

MAX_FAILURES = 10
WINDOW = timedelta(minutes=15)


def begin_attempt(db, email: str) -> LoginThrottle | None:
    key = hashlib.sha256(email.strip().lower().encode()).hexdigest()
    if db.bind.dialect.name == 'postgresql':
        # Serialize updates for the same identifier across API replicas.
        lock = int.from_bytes(bytes.fromhex(key[:16]), 'big', signed=True)
        db.execute(text('SELECT pg_advisory_xact_lock(:lock)'), {'lock': lock})
    row = db.get(LoginThrottle, key)
    if row:
        started = row.window_started_at.replace(tzinfo=timezone.utc)
        if now() - started >= WINDOW:
            row.attempts = 0
            row.window_started_at = now()
        elif row.attempts >= MAX_FAILURES:
            db.rollback()
            raise HTTPException(429, 'Çok fazla giriş denemesi yapıldı. Daha sonra yeniden deneyin.', headers={'Retry-After': '900'})
    return row


def record_failure(db, email: str, row: LoginThrottle | None) -> None:
    if row is None:
        key = hashlib.sha256(email.strip().lower().encode()).hexdigest()
        db.add(LoginThrottle(key=key, attempts=1, window_started_at=now()))
    else:
        row.attempts += 1
    db.commit()


def clear_attempts(db, row: LoginThrottle | None) -> None:
    if row is not None:
        db.delete(row)
