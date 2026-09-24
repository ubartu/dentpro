"""Additive operations tables; existing patient records are preserved."""
from datetime import datetime
from sqlalchemy import String, JSON, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from .db import Base, uid, now

class Account(Base):
    __tablename__ = 'accounts'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[str]
    role: Mapped[str]
    clinic_id: Mapped[str | None] = mapped_column(nullable=True)
    password_hash: Mapped[str]
    active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class LoginSession(Base):
    __tablename__ = 'login_sessions'
    token_hash: Mapped[str] = mapped_column(String, primary_key=True)
    account_id: Mapped[str]
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

class ClinicProfile(Base):
    __tablename__ = 'clinic_profiles'
    clinic_id: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[str] = mapped_column(default='pending')
    email: Mapped[str] = mapped_column(default='')
    phone: Mapped[str] = mapped_column(default='')
    website: Mapped[str] = mapped_column(default='')
    description: Mapped[str] = mapped_column(default='')
    hours: Mapped[str] = mapped_column(default='Monday–Friday, 09:00–18:00')
    subscription: Mapped[str] = mapped_column(default='trial')
    monthly_fee_minor: Mapped[int] = mapped_column(default=0)
    renewal_date: Mapped[str] = mapped_column(default='')
    review_notes: Mapped[str] = mapped_column(default='')

class CaseReview(Base):
    __tablename__ = 'clinic_case_reviews'
    __table_args__ = (UniqueConstraint('case_id', 'clinic_id'),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    case_id: Mapped[str]
    clinic_id: Mapped[str]
    status: Mapped[str] = mapped_column(default='new')
    notes: Mapped[str] = mapped_column(default='')
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Draft(Base):
    __tablename__ = 'proposal_drafts'
    __table_args__ = (UniqueConstraint('case_id', 'clinic_id'),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    case_id: Mapped[str]
    clinic_id: Mapped[str]
    plan: Mapped[dict] = mapped_column(JSON)
    revision_of: Mapped[str | None] = mapped_column(nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class ProposalState(Base):
    __tablename__ = 'proposal_states'
    proposal_id: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[str] = mapped_column(default='submitted')
    revision_of: Mapped[str | None] = mapped_column(nullable=True)
    moderation: Mapped[str] = mapped_column(default='unreviewed')
    review_notes: Mapped[str] = mapped_column(default='')

class AppointmentDetail(Base):
    __tablename__ = 'appointment_details'
    appointment_id: Mapped[str] = mapped_column(String, primary_key=True)
    scheduled_at: Mapped[str | None] = mapped_column(nullable=True)
    notes: Mapped[str] = mapped_column(default='')
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class GlossaryEntry(Base):
    __tablename__ = 'procedure_glossary'
    code: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    explanation: Mapped[str]
    reviewed: Mapped[bool] = mapped_column(default=False)
    reviewer: Mapped[str] = mapped_column(default='')
    version: Mapped[int] = mapped_column(default=1)

class ExplanationJob(Base):
    __tablename__ = 'explanation_jobs'
    key: Mapped[str] = mapped_column(String, primary_key=True)
    proposal_id: Mapped[str]
    status: Mapped[str] = mapped_column(default='pending')
    attempts: Mapped[int] = mapped_column(default=0)
    error: Mapped[str] = mapped_column(default='')
    glossary: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class PlatformSetting(Base):
    __tablename__ = 'platform_settings'
    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)

class PatientProfile(Base):
    __tablename__ = 'patient_profiles'
    account_id: Mapped[str] = mapped_column(String, primary_key=True)
    phone: Mapped[str] = mapped_column(default='')

class PatientCaseRequest(Base):
    __tablename__ = 'patient_case_requests'
    __table_args__ = (UniqueConstraint('user_id', 'request_key'),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str]
    request_key: Mapped[str]
    request_hash: Mapped[str]
    case_id: Mapped[str]
