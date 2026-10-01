"""Public recovery endpoints with uniform responses and database-backed limits."""
import time
import secrets
from datetime import timedelta, timezone
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import Field
from sqlalchemy import select, update, delete, text, func
from sqlalchemy.exc import IntegrityError
from .contracts import StrictModel
from .db import get_db, now, audit
from .auth import token_hash, password_hash, require
from .operations_models import Account, LoginSession, ClinicProfile, LoginThrottle
from .mail_models import PasswordReset, RecoveryThrottle, MailJob
from .mail_gateway import mail_config, reset_token

router = APIRouter(tags=['password recovery'])
GENERIC = 'Uygun bir hesap varsa şifre yenileme e-postası gönderilecektir. Gelen kutunuzu ve spam klasörünü kontrol edin.'

class ForgotInput(StrictModel):
    email: str = Field(pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$', max_length=150)
class ResetInput(StrictModel):
    token: str = Field(pattern=r'^[A-Za-z0-9_-]{43}$')
    new_password: str = Field(min_length=10, max_length=128)
class RecoveryResult(StrictModel):
    message: str

def utc(value): return value.replace(tzinfo=timezone.utc)
def eligible(db, account):
    if not account or not account.active: return False
    if account.clinic_id:
        profile = db.get(ClinicProfile, account.clinic_id)
        return bool(profile and profile.status == 'active')
    return True

def consume_limit(db, identifier, limit, minutes):
    key = token_hash(identifier)
    if db.bind.dialect.name == 'postgresql':
        db.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key':int.from_bytes(bytes.fromhex(key[:16]), 'big', signed=True)})
    # A conditional UPDATE also makes counters atomic in the local SQLite store.
    try:
        with db.begin_nested():
            if not db.get(RecoveryThrottle, key): db.add(RecoveryThrottle(key=key))
    except IntegrityError: pass
    db.execute(update(RecoveryThrottle).where(RecoveryThrottle.key==key, RecoveryThrottle.started_at<=now()-timedelta(minutes=minutes)).values(attempts=0, started_at=now()))
    return db.execute(update(RecoveryThrottle).where(RecoveryThrottle.key==key, RecoveryThrottle.attempts<limit).values(attempts=RecoveryThrottle.attempts+1)).rowcount == 1

def configuration():
    try:
        config = mail_config()
        if config.provider == 'disabled': raise ValueError()
        return config
    except (ValueError, OSError):
        raise HTTPException(503, 'Şifre yenileme geçici olarak kullanılamıyor. Lütfen destek ekibiyle iletişime geçin.')

def no_store(response): response.headers['Cache-Control'] = 'no-store'

@router.post('/auth/password/forgot', response_model=RecoveryResult, status_code=202)
def forgot(data:ForgotInput, request:Request, response:Response, db=Depends(get_db)):
    started = time.monotonic()
    config = configuration()
    email = data.email.lower()
    no_store(response)
    ip = request.client.host if request.client else 'unknown'
    if not consume_limit(db, 'forgot-ip:' + ip, 30, 15):
        db.commit(); raise HTTPException(429, 'Çok fazla istek gönderdiniz. Daha sonra yeniden deneyin.', headers={'Retry-After':'900'})
    allowed = consume_limit(db, 'forgot-email:' + email, 3, 30)
    account = db.scalar(select(Account).where(Account.email==email).with_for_update())
    if allowed and eligible(db, account):
        db.execute(update(PasswordReset).where(PasswordReset.account_id==account.id, PasswordReset.consumed==False).values(consumed=True))
        rid = str(uuid4())
        reset = PasswordReset(id=rid, account_id=account.id, email=email,
            password_fingerprint=token_hash(account.password_hash), token_hash=token_hash(reset_token(rid, config.secret)), expires_at=now()+timedelta(minutes=30))
        db.add(reset)
        db.add(MailJob(account_id=account.id,email=email,kind='password_reset',reset_id=rid))
        audit(db, account.id, 'password_reset.requested', rid)
    db.commit()
    # Account-independent response floor; mail delivery runs in the worker.
    time.sleep(max(0, 0.25 + secrets.randbelow(50)/1000 - (time.monotonic()-started)))
    return {'message':GENERIC}

@router.post('/auth/password/reset', response_model=RecoveryResult)
def reset_password(data:ResetInput, request:Request, response:Response, db=Depends(get_db)):
    config = configuration(); no_store(response)
    ip = request.client.host if request.client else 'unknown'
    allowed = consume_limit(db, 'reset-ip:' + ip, 30, 15)
    allowed_token = consume_limit(db, 'reset-token:' + data.token, 10, 15)
    if not allowed or not allowed_token:
        db.commit(); raise HTTPException(429, 'Çok fazla istek gönderdiniz. Daha sonra yeniden deneyin.', headers={'Retry-After':'900'})
    reset = db.scalar(select(PasswordReset).where(PasswordReset.token_hash==token_hash(data.token)))
    account = db.scalar(select(Account).where(Account.id==reset.account_id).with_for_update()) if reset else None
    if (not reset or reset.consumed or utc(reset.expires_at)<=now() or not eligible(db, account)
        or account.email!=reset.email or token_hash(account.password_hash)!=reset.password_fingerprint
        or not secrets.compare_digest(data.token, reset_token(reset.id, config.secret))):
        db.commit(); raise HTTPException(400, 'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.')
    # Consume and change the password in the same transaction; GET never consumes links.
    used = db.execute(update(PasswordReset).where(PasswordReset.id==reset.id, PasswordReset.consumed==False).values(consumed=True)).rowcount
    if used != 1:
        db.commit(); raise HTTPException(400, 'Şifre yenileme bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.')
    account.password_hash = password_hash(data.new_password)
    db.execute(update(PasswordReset).where(PasswordReset.account_id==account.id).values(consumed=True))
    db.execute(delete(LoginSession).where(LoginSession.account_id==account.id))
    db.execute(delete(LoginThrottle).where(LoginThrottle.key==token_hash(account.email)))
    db.add(MailJob(account_id=account.id,email=account.email,kind='password_changed'))
    audit(db, account.id, 'password_reset.completed', reset.id)
    db.commit()
    return {'message':'Şifreniz güncellendi. Yeni şifrenizle yeniden giriş yapın.'}

@router.get('/admin/mail/status')
def mail_status(user=Depends(require('admin')), db=Depends(get_db)):
    try:
        config=mail_config(); configured=config.provider!='disabled'; provider=config.provider
    except (ValueError,OSError): configured=False; provider='unavailable'
    counts=dict(db.execute(select(MailJob.status,func.count()).group_by(MailJob.status)).all())
    return {'provider':provider,'configured':configured,'jobs':counts}
