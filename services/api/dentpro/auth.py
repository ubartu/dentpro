import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError, VerificationError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .db import Session
from .operations_models import Account, LoginSession, ClinicProfile
from .runtime import cloud_mode

# Local synthetic patient identity for exercising the future mobile API.
TOKENS = {} if cloud_mode() else {'patient': secrets.token_urlsafe(32)}
ACTORS = {} if cloud_mode() else {'patient': {'id':'patient-demo','role':'patient'}}
bearer = HTTPBearer()
hasher = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)

def password_hash(password):
    return hasher.hash(password)

def password_matches(password, stored):
    if stored.startswith('$argon2id$'):
        try: return hasher.verify(stored,password)
        except (VerifyMismatchError, InvalidHashError, VerificationError): return False
    # Existing local demo accounts remain usable until their passwords are rotated.
    try:
        salt, expected=stored.split(':',1)
        value=hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),310000).hex()
        return hmac.compare_digest(value,expected)
    except (ValueError, TypeError): return False

def token_hash(token): return hashlib.sha256(token.encode()).hexdigest()

def account_view(a):
    return {'id':a.id,'name':a.name,'email':a.email,'role':a.role,'clinic_id':a.clinic_id,'active':a.active}

def actor(credential: HTTPAuthorizationCredentials = Depends(bearer)):
    for role, token in TOKENS.items():
        if secrets.compare_digest(credential.credentials, token):
            with Session() as db:
                profile=db.get(ClinicProfile,ACTORS[role].get('clinic_id')) if role=='clinic' else None
                if profile and profile.status!='active': raise HTTPException(403,'Klinik erişimi aktif değil. Platform yöneticisiyle iletişime geçin.')
            return ACTORS[role]
    with Session() as db:
        session=db.get(LoginSession,token_hash(credential.credentials))
        if session:
            expiry=session.expires_at.replace(tzinfo=timezone.utc)
            user=db.get(Account,session.account_id)
            if user and user.active and expiry>datetime.now(timezone.utc):
                profile=db.get(ClinicProfile,user.clinic_id) if user.clinic_id else None
                if profile and profile.status!='active': raise HTTPException(403,'Klinik erişimi aktif değil. Platform yöneticisiyle iletişime geçin.')
                return account_view(user)
    raise HTTPException(401,'Oturumunuzun süresi doldu. Lütfen yeniden giriş yapın.')

def require(*roles):
    def check(user=Depends(actor)):
        if user['role'] not in roles: raise HTTPException(403,'Bu işlem rolünüz için kullanılamıyor.')
        return user
    return check
