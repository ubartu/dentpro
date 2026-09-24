import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .db import Session
from .operations_models import Account, LoginSession, ClinicProfile

# Local synthetic patient identity for exercising the future mobile API.
TOKENS = {name: secrets.token_urlsafe(32) for name in ('patient',)}
ACTORS = {'patient': {'id':'patient-demo','role':'patient'}}
bearer = HTTPBearer()

def password_hash(password):
    salt=secrets.token_hex(16)
    value=hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),310000).hex()
    return f'{salt}:{value}'

def password_matches(password, stored):
    salt, expected=stored.split(':',1)
    value=hashlib.pbkdf2_hmac('sha256',password.encode(),salt.encode(),310000).hex()
    return hmac.compare_digest(value,expected)

def token_hash(token): return hashlib.sha256(token.encode()).hexdigest()

def account_view(a):
    return {'id':a.id,'name':a.name,'email':a.email,'role':a.role,'clinic_id':a.clinic_id,'active':a.active}

def actor(credential: HTTPAuthorizationCredentials = Depends(bearer)):
    for role, token in TOKENS.items():
        if secrets.compare_digest(credential.credentials, token):
            with Session() as db:
                profile=db.get(ClinicProfile,ACTORS[role].get('clinic_id')) if role=='clinic' else None
                if profile and profile.status!='active': raise HTTPException(403,'Clinic access is not active. Contact the platform administrator.')
            return ACTORS[role]
    with Session() as db:
        session=db.get(LoginSession,token_hash(credential.credentials))
        if session:
            expiry=session.expires_at.replace(tzinfo=timezone.utc)
            user=db.get(Account,session.account_id)
            if user and user.active and expiry>datetime.now(timezone.utc):
                profile=db.get(ClinicProfile,user.clinic_id) if user.clinic_id else None
                if profile and profile.status!='active': raise HTTPException(403,'Clinic access is not active. Contact the platform administrator.')
                return account_view(user)
    raise HTTPException(401,'Your session has expired. Please sign in again.')

def require(*roles):
    def check(user=Depends(actor)):
        if user['role'] not in roles: raise HTTPException(403,'This action is not available for your role.')
        return user
    return check
