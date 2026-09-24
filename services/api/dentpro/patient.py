"""Patient account and mobile-facing views; staff-only notes never leave this API."""
from datetime import timedelta
import secrets
from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from .auth import require, password_hash, password_matches, token_hash, account_view
from .contracts import StrictModel, AppointmentOutput
from .db import get_db, now, audit, Appointment, Proposal, Case, Clinic
from .operations_models import Account, LoginSession, PatientProfile, ClinicProfile, AppointmentDetail, PlatformSetting
from .operations import LoginInput, login

router = APIRouter(prefix='/patient', tags=['patient'])

class PatientInput(StrictModel):
    name: str = Field(min_length=2, max_length=100)
    email: str = Field(pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$', max_length=150)
    phone: str = Field(min_length=7, max_length=40, pattern=r'^\+?[0-9 ()-]+$')

class Registration(PatientInput):
    password: str = Field(min_length=10, max_length=128)

class PasswordChange(StrictModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)

class PatientAccount(StrictModel):
    id: str
    name: str
    email: str
    phone: str
    role: str

class PatientSession(StrictModel):
    token: str
    user: PatientAccount

class Capabilities(StrictModel):
    regions: list[str]
    upload_limit_mb: int
    max_recipients: int
    consent_version: str
    consent_text: str

class PatientAppointment(AppointmentOutput):
    case_id: str
    case_title: str
    clinic_name: str
    clinic_phone: str
    scheduled_at: str | None

class PatientClinic(StrictModel):
    id: str
    name: str
    region: str
    district: str
    address: str
    phone: str
    description: str
    hours: str

CONSENT_VERSION = 'patient-sharing-1'
CONSENT_TEXT = 'I agree to store this case and share its X-ray and case details with the clinics I select for a preliminary treatment proposal. My contact details will be shared with a clinic when I request an appointment or callback.'

def patient_view(db, user):
    profile = db.get(PatientProfile, user['id'])
    return {k: user[k] for k in ('id', 'name', 'email', 'role')} | {'phone': profile.phone if profile else ''}

@router.post('/register', response_model=PatientSession, status_code=201)
def register(data: Registration, db=Depends(get_db)):
    account = Account(name=data.name, email=data.email.lower(), role='patient', password_hash=password_hash(data.password))
    db.add(account)
    try:
        db.flush()
        db.add(PatientProfile(account_id=account.id, phone=data.phone))
        token = secrets.token_urlsafe(40)
        db.add(LoginSession(token_hash=token_hash(token), account_id=account.id, expires_at=now()+timedelta(hours=12)))
        audit(db, account.id, 'patient.registered', account.id)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'An account with this email already exists. Sign in instead.')
    return {'token': token, 'user': patient_view(db, account_view(account))}

@router.post('/login', response_model=PatientSession)
def patient_login(data: LoginInput, db=Depends(get_db)):
    account = db.scalar(select(Account).where(Account.email == data.email.lower()))
    if not account or account.role != 'patient':
        raise HTTPException(401, 'Email or password is incorrect.')
    result = login(data, db)
    return result | {'user': patient_view(db, result['user'])}

@router.get('/me', response_model=PatientAccount)
def me(user=Depends(require('patient')), db=Depends(get_db)):
    if not db.get(Account, user['id']): raise HTTPException(401, 'Sign in with a patient account.')
    return patient_view(db, user)

@router.put('/me', response_model=PatientAccount)
def update_me(data: PatientInput, user=Depends(require('patient')), db=Depends(get_db)):
    account = db.get(Account, user['id'])
    if not account: raise HTTPException(401)
    account.name = data.name
    account.email = data.email.lower()
    profile = db.get(PatientProfile, account.id)
    if not profile:
        profile = PatientProfile(account_id=account.id); db.add(profile)
    profile.phone = data.phone
    audit(db, account.id, 'patient.profile_updated', account.id)
    try: db.commit()
    except IntegrityError:
        db.rollback(); raise HTTPException(409, 'An account with this email already exists.')
    return patient_view(db, account_view(account))

@router.put('/password')
def change_password(data: PasswordChange, user=Depends(require('patient')), db=Depends(get_db)):
    account = db.get(Account, user['id'])
    if not account or not password_matches(data.current_password, account.password_hash):
        raise HTTPException(400, 'Current password is incorrect.')
    account.password_hash = password_hash(data.new_password)
    db.execute(delete(LoginSession).where(LoginSession.account_id == account.id))
    audit(db, account.id, 'patient.password_changed', account.id)
    db.commit()
    return {'ok': True}

@router.get('/capabilities', response_model=Capabilities)
def capabilities(user=Depends(require('patient')), db=Depends(get_db)):
    settings = db.get(PlatformSetting, 'operations')
    values = settings.value if settings else {}
    return {'regions': ['Istanbul','Ankara','Izmir'], 'upload_limit_mb': values.get('upload_limit_mb',10), 'max_recipients': values.get('max_recipients',10), 'consent_version': CONSENT_VERSION, 'consent_text': CONSENT_TEXT}

@router.get('/clinics', response_model=list[PatientClinic])
def clinics(user=Depends(require('patient')), db=Depends(get_db)):
    rows = db.execute(select(Clinic, ClinicProfile).join(ClinicProfile, Clinic.id == ClinicProfile.clinic_id).where(ClinicProfile.status == 'active').order_by(Clinic.name)).all()
    return [{k: getattr(c,k) for k in ('id','name','region','district','address')} | {k: getattr(p,k) for k in ('phone','description','hours')} for c,p in rows]

@router.get('/appointments', response_model=list[PatientAppointment])
def appointments(user=Depends(require('patient')), db=Depends(get_db)):
    results = []
    for a in db.scalars(select(Appointment).where(Appointment.user_id == user['id']).order_by(Appointment.created_at.desc())):
        p = db.get(Proposal,a.proposal_id); c = db.get(Case,p.case_id); clinic = db.get(Clinic,a.clinic_id)
        detail = db.get(AppointmentDetail,a.id); profile = db.get(ClinicProfile,a.clinic_id)
        results.append({k: getattr(a,k) for k in AppointmentOutput.model_fields} | {'case_id': c.id, 'case_title': c.title, 'clinic_name': clinic.name, 'clinic_phone': profile.phone if profile else '', 'scheduled_at': detail.scheduled_at if detail else None})
    return results

@router.post('/appointments/{appointment_id}/cancel')
def cancel(appointment_id: str, user=Depends(require('patient')), db=Depends(get_db)):
    a = db.get(Appointment,appointment_id)
    if not a or a.user_id != user['id']: raise HTTPException(404, 'Request not found')
    if a.status == 'completed': raise HTTPException(409, 'A completed appointment cannot be cancelled')
    if a.status != 'cancelled':
        a.status = 'cancelled'; audit(db,user['id'],'appointment.cancelled',a.id); db.commit()
    return {'ok': True}
