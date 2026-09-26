import os
from datetime import datetime, timezone
from uuid import uuid4
from sqlalchemy import create_engine, String, JSON, Integer, DateTime, UniqueConstraint, LargeBinary
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from .runtime import cloud_mode, database_url


def uid(): return str(uuid4())
def now(): return datetime.now(timezone.utc)

class Base(DeclarativeBase): pass

class Clinic(Base):
    __tablename__ = 'clinics'
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    region: Mapped[str]
    district: Mapped[str]
    address: Mapped[str]

class Case(Base):
    __tablename__ = 'dental_cases'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str]
    title: Mapped[str]
    region: Mapped[str]
    status: Mapped[str] = mapped_column(default='draft')
    recipients: Mapped[list] = mapped_column(JSON, default=list)
    asset: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Proposal(Base):
    __tablename__ = 'proposals'
    __table_args__ = (UniqueConstraint('clinic_id', 'idempotency_key'),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    case_id: Mapped[str]
    clinic_id: Mapped[str]
    idempotency_key: Mapped[str]
    request_hash: Mapped[str]
    version: Mapped[int] = mapped_column(Integer, default=1)
    plan: Mapped[dict] = mapped_column(JSON)
    total_minor: Mapped[int] = mapped_column(Integer)
    explanation_key: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Explanation(Base):
    __tablename__ = 'ai_explanations'
    key: Mapped[str] = mapped_column(String, primary_key=True)
    output: Mapped[dict] = mapped_column(JSON)
    model: Mapped[str] = mapped_column(default='template-v1')
    prompt_version: Mapped[str] = mapped_column(default='1')
    policy_version: Mapped[str] = mapped_column(default='1')
    input_tokens: Mapped[int] = mapped_column(default=0)
    output_tokens: Mapped[int] = mapped_column(default=0)
    estimated_cost: Mapped[str] = mapped_column(default='0.00')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Appointment(Base):
    __tablename__ = 'appointments'
    __table_args__ = (UniqueConstraint('proposal_id', 'user_id'),)
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    proposal_id: Mapped[str]
    user_id: Mapped[str]
    clinic_id: Mapped[str]
    kind: Mapped[str]
    status: Mapped[str] = mapped_column(default='requested')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Audit(Base):
    __tablename__ = 'audit_logs'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    actor: Mapped[str]
    action: Mapped[str]
    entity: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class Consent(Base):
    __tablename__ = 'consents'
    id: Mapped[str] = mapped_column(String, primary_key=True, default=uid)
    user_id: Mapped[str]
    case_id: Mapped[str]
    type: Mapped[str] = mapped_column(default='case-sharing')
    version: Mapped[str] = mapped_column(default='demo-1')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

class XrayAsset(Base):
    """Bounded private image/PDF bytes; database backups include the file."""
    __tablename__ = 'xray_assets'
    case_id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)

if not cloud_mode(): os.makedirs('.data', exist_ok=True)
url = database_url()
engine = create_engine(url, connect_args={'check_same_thread': False} if url.startswith('sqlite') else {}, pool_pre_ping=True)
Session = sessionmaker(engine, expire_on_commit=False)

def get_db():
    with Session() as db: yield db

def audit(db, actor, action, entity):
    db.add(Audit(actor=actor, action=action, entity=entity))
