"""Transactional recovery outbox. No raw reset tokens or email bodies are stored."""
from datetime import datetime
from sqlalchemy import String, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, uid, now

class PasswordReset(Base):
    __tablename__ = 'password_resets'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    account_id: Mapped[str] = mapped_column(index=True)
    email: Mapped[str]
    password_fingerprint: Mapped[str]
    token_hash: Mapped[str] = mapped_column(String, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class RecoveryThrottle(Base):
    __tablename__ = 'recovery_throttles'
    key: Mapped[str] = mapped_column(String, primary_key=True)
    attempts: Mapped[int] = mapped_column(default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class MailJob(Base):
    __tablename__ = 'mail_jobs'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    account_id: Mapped[str]
    email: Mapped[str]
    kind: Mapped[str]
    reset_id: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(default='pending', index=True)
    attempts: Mapped[int] = mapped_column(default=0)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claim: Mapped[str | None] = mapped_column(nullable=True)
    error: Mapped[str] = mapped_column(default='')
    provider_id: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
