from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import uuid4
import secrets
from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import Field, field_validator, model_validator
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from .db import get_db, Clinic, Case, Proposal, Explanation, Appointment, Consent, Audit, audit, now
from .auth import actor, require, bearer, password_hash, password_matches, token_hash, account_view
from .contracts import StrictModel, ProposalInput
from .interpreter import digest, canonical_source
from .ai_gateway import GatewayStatus, gateway_config, gateway_status
from .login_throttle import begin_attempt, record_failure, clear_attempts
from .runtime import cloud_mode
from .operations_models import Account, LoginSession, ClinicProfile, ClinicLocation, CaseReview, Draft, ProposalState, AppointmentDetail, GlossaryEntry, ExplanationJob, AIExplanationRequest, PlatformSetting, PatientProfile

router=APIRouter()

class LoginInput(StrictModel):
    email: str = Field(min_length=3,max_length=150)
    password: str = Field(min_length=1,max_length=200)
class AccountInput(StrictModel):
    name: str = Field(min_length=2,max_length=100)
    email: str = Field(pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$',max_length=150)
    role: Literal['clinic','admin'] = 'clinic'
    clinic_id: str | None = None
    password: str = Field(min_length=10,max_length=128)
class AccountUpdate(StrictModel):
    active: bool
    password: str | None = Field(default=None,min_length=10,max_length=128)
class ReviewInput(StrictModel):
    status: Literal['new','reviewing','declined']
    notes: str = Field(default='',max_length=3000)
class DraftInput(StrictModel):
    plan: ProposalInput
    revision_of: str | None = None
class PublishInput(DraftInput): pass
class AppointmentUpdate(StrictModel):
    status: Literal['requested','contacted','confirmed','completed','cancelled']
    scheduled_at: datetime | None = None
    notes: str = Field(default='',max_length=3000)
    @field_validator('scheduled_at')
    @classmethod
    def aware(cls,v):
        if v and v.tzinfo is None: raise ValueError('Include a timezone')
        return v
class ProfileInput(StrictModel):
    name: str = Field(min_length=2,max_length=100)
    district: str = Field(min_length=2,max_length=80)
    address: str = Field(min_length=3,max_length=250)
    email: str = Field(pattern=r'^[^\s@]+@[^\s@]+\.[^\s@]+$',max_length=150)
    phone: str = Field(default='',max_length=40)
    website: str = Field(default='',max_length=150)
    description: str = Field(default='',max_length=1500)
    hours: str = Field(default='',max_length=500)
    latitude: float | None = Field(default=None,ge=-90,le=90)
    longitude: float | None = Field(default=None,ge=-180,le=180)
    @model_validator(mode='after')
    def paired_coordinates(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError('Provide both latitude and longitude, or leave both empty')
        return self
class ClinicCreate(ProfileInput):
    region: Literal['Istanbul','Ankara','Izmir']
class ClinicReviewInput(StrictModel):
    status: Literal['pending','active','suspended','rejected']
    review_notes: str = Field(default='',max_length=2000)
class SubscriptionInput(StrictModel):
    subscription: Literal['trial','active','past_due','cancelled']
    monthly_fee_minor: int = Field(ge=0,le=10000000)
    renewal_date: str = Field(default='',pattern=r'^(\d{4}-\d{2}-\d{2})?$')
class CaseAdminInput(StrictModel):
    action: Literal['archive','reopen']
    reason: str = Field(min_length=3,max_length=500)
class DispatchAdminInput(StrictModel):
    clinic_ids: list[str] = Field(min_length=1,max_length=10)
class ModerationInput(StrictModel):
    moderation: Literal['unreviewed','approved','flagged']
    review_notes: str = Field(default='',max_length=2000)
class GlossaryInput(StrictModel):
    explanation: str = Field(min_length=20,max_length=700)
    reviewed: bool
    reviewer: str = Field(default='',max_length=100)
class SettingsInput(StrictModel):
    explanations_enabled: bool
    max_recipients: int = Field(ge=1,le=10)
    upload_limit_mb: int = Field(ge=1,le=10)

def sign_in(data:LoginInput,db,allowed_roles:tuple[str,...]):
    throttle=begin_attempt(db,data.email) if cloud_mode() else None
    user=db.scalar(select(Account).where(Account.email==data.email.lower()))
    if not user or user.role not in allowed_roles or not password_matches(data.password,user.password_hash) or not user.active:
        if cloud_mode():record_failure(db,data.email,throttle)
        raise HTTPException(401,'Email or password is incorrect.')
    profile=db.get(ClinicProfile,user.clinic_id) if user.clinic_id else None
    if profile and profile.status!='active':raise HTTPException(403,'This clinic is awaiting approval or has been suspended.')
    if not user.password_hash.startswith('$argon2id$'):
        user.password_hash=password_hash(data.password)
    if cloud_mode():clear_attempts(db,throttle)
    token=secrets.token_urlsafe(40)
    db.add(LoginSession(token_hash=token_hash(token),account_id=user.id,expires_at=now()+timedelta(hours=12)))
    audit(db,user.id,'session.signed_in',user.id);db.commit()
    return {'token':token,'user':account_view(user)}

@router.post('/auth/login')
def login(data:LoginInput,db=Depends(get_db)):
    return sign_in(data,db,('clinic','admin'))

@router.get('/auth/me')
def me(user=Depends(actor)): return user

@router.post('/auth/logout')
def logout(credential:HTTPAuthorizationCredentials=Depends(bearer),user=Depends(actor),db=Depends(get_db)):
    db.execute(delete(LoginSession).where(LoginSession.token_hash==token_hash(credential.credentials)))
    audit(db,user['id'],'session.signed_out',user['id']);db.commit();return {'ok':True}

def profile_view(db,c):
    from .clinic_discovery import discovery_view
    p=db.get(ClinicProfile,c.id)
    loc=db.get(ClinicLocation,c.id)
    return {'id':c.id,'name':c.name,'region':c.region,'district':c.district,'address':c.address,'latitude':loc.latitude if loc else None,'longitude':loc.longitude if loc else None, **{k:getattr(p,k) if p else '' for k in ['status','email','phone','website','description','hours','subscription','monthly_fee_minor','renewal_date','review_notes']}, **discovery_view(db,c.id)}

def state(db,p): return db.get(ProposalState,p.id)
def proposal_view(db,p):
    from .main import proposal_view as base_view
    data=base_view(db,p);s=state(db,p);c=db.get(Case,p.case_id)
    job=db.get(ExplanationJob,p.explanation_key)
    return data|{'case_title':c.title if c else 'Archived case','status':s.status if s else 'submitted','revision_of':s.revision_of if s else None,'moderation':s.moderation if s else 'unreviewed','review_notes':s.review_notes if s else '', 'explanation_status':job.status if job else data['explanation_status']}

def explanation_job_view(db,job):
    request=db.get(AIExplanationRequest,job.key)
    explanation=db.get(Explanation,job.key)
    return {
        'key':job.key,'proposal_id':job.proposal_id,'status':job.status,
        'attempts':job.attempts,'error':job.error,'created_at':job.created_at,
        'updated_at':job.updated_at,'provider':request.provider if request else 'template',
        'model':request.model if request else 'template-v1',
        'output_mode':explanation.output.get('mode') if explanation else None,
    }

def case_view(db,c,user):
    is_admin=user['role']=='admin';clinic_id=user.get('clinic_id')
    review=db.scalar(select(CaseReview).where(CaseReview.case_id==c.id,CaseReview.clinic_id==clinic_id)) if clinic_id else None
    drafts=db.scalar(select(Draft).where(Draft.case_id==c.id,Draft.clinic_id==clinic_id)) if clinic_id else None
    query=select(Proposal).where(Proposal.case_id==c.id)
    if not is_admin:query=query.where(Proposal.clinic_id==clinic_id)
    plans=db.scalars(query.order_by(Proposal.created_at.desc())).all()
    active=[p for p in plans if not state(db,p) or state(db,p).status=='submitted']
    return {'id':c.id,'reference':'DP-'+c.id[-6:].upper(),'title':c.title,'region':c.region,'status':c.status,'created_at':c.created_at,'asset':({'name':c.asset['name'],'type':c.asset['type'],'available':not c.asset.get('synthetic',False)} if c.asset else None),'recipients':c.recipients if is_admin else [clinic_id], 'review_status':review.status if review else 'new','internal_notes':review.notes if review else '', 'proposal_count':len(plans),'active_proposals':len(active),'draft':({'id':drafts.id,'plan':drafts.plan,'revision_of':drafts.revision_of,'updated_at':drafts.updated_at} if drafts else None),'consent_recorded':bool(db.scalar(select(Consent.id).where(Consent.case_id==c.id)))}

def appointment_view(db,a):
    p=db.get(Proposal,a.proposal_id);c=db.get(Case,p.case_id) if p else None;cl=db.get(Clinic,a.clinic_id);d=db.get(AppointmentDetail,a.id)
    return {'id':a.id,'proposal_id':a.proposal_id,'case_id':p.case_id if p else None,'case_title':c.title if c else 'Case unavailable','clinic_id':a.clinic_id,'clinic_name':cl.name,'kind':a.kind,'status':a.status,'scheduled_at':d.scheduled_at if d else None,'notes':d.notes if d else '', 'created_at':a.created_at, 'patient_name': (db.get(Account,a.user_id).name if db.get(Account,a.user_id) else ''), 'patient_phone': (db.get(PatientProfile,a.user_id).phone if db.get(PatientProfile,a.user_id) else '')}

def scoped_case(db,id,user):
    from .main import access_case
    return access_case(db,id,user)

def scoped_proposal(db,id,user):
    p=db.get(Proposal,id)
    if not p or (user['role']=='clinic' and p.clinic_id!=user['clinic_id']):raise HTTPException(404,'Proposal not found')
    scoped_case(db,p.case_id,user)
    return p

def get_review(db,cid,clinic_id):
    review=db.scalar(select(CaseReview).where(CaseReview.case_id==cid,CaseReview.clinic_id==clinic_id))
    if not review:review=CaseReview(case_id=cid,clinic_id=clinic_id);db.add(review)
    return review

def glossary_snapshot(db):
    return {g.code:{'text':g.explanation,'version':g.version,'reviewed':g.reviewed,'reviewer':g.reviewer} for g in db.scalars(select(GlossaryEntry)).all()}

def enqueue(db,p,force=False):
    glossary=glossary_snapshot(db)
    gateway=gateway_config()
    model_tag='template-v1' if gateway.provider=='template' else f'{gateway.provider}:{gateway.model}:prompt-{gateway.prompt_version}'
    key=digest({'plan':canonical_source(p.plan),'glossary':glossary,'locale':'en','policy':'1','model':model_tag})
    p.explanation_key=key
    job=db.get(ExplanationJob,key)
    if not job:
        db.add(ExplanationJob(key=key,proposal_id=p.id,status='completed' if db.get(Explanation,key) else 'pending',glossary=glossary))
        db.add(AIExplanationRequest(key=key,provider=gateway.provider,model=gateway.model,prompt_version=gateway.prompt_version))
    elif force and job.status=='failed':job.status='pending';job.error='';job.updated_at=now()

@router.get('/clinic/workspace')
def clinic_workspace(user=Depends(require('clinic')),db=Depends(get_db)):
    cid=user['clinic_id'];c=db.get(Clinic,cid)
    cases=[c for c in db.scalars(select(Case).order_by(Case.created_at.desc())).all() if cid in c.recipients]
    proposals=db.scalars(select(Proposal).where(Proposal.clinic_id==cid).order_by(Proposal.created_at.desc())).all()
    return {'clinic':profile_view(db,c),'cases':[case_view(db,c,user) for c in cases],'proposals':[proposal_view(db,p) for p in proposals],'appointments':[appointment_view(db,a) for a in db.scalars(select(Appointment).where(Appointment.clinic_id==cid).order_by(Appointment.created_at.desc())).all()],'members':[account_view(a) for a in db.scalars(select(Account).where(Account.clinic_id==cid)).all()]}

@router.get('/clinic/cases/{case_id}')
def clinic_case(case_id:str,user=Depends(require('clinic')),db=Depends(get_db)):
    c=scoped_case(db,case_id,user)
    return case_view(db,c,user)|{'proposals':[proposal_view(db,p) for p in db.scalars(select(Proposal).where(Proposal.case_id==case_id,Proposal.clinic_id==user['clinic_id']).order_by(Proposal.created_at.desc())).all()]}

@router.patch('/clinic/cases/{case_id}/review')
def update_review(case_id:str,data:ReviewInput,user=Depends(require('clinic')),db=Depends(get_db)):
    c=scoped_case(db,case_id,user)
    if c.status=='archived':raise HTTPException(409,'Archived cases cannot be changed')
    r=get_review(db,case_id,user['clinic_id']);r.status=data.status;r.notes=data.notes;r.updated_at=now()
    audit(db,user['id'],'case.review_updated',case_id);db.commit();return case_view(db,c,user)

@router.put('/clinic/cases/{case_id}/draft')
def save_draft(case_id:str,data:DraftInput,user=Depends(require('clinic')),db=Depends(get_db)):
    c=scoped_case(db,case_id,user)
    if c.status=='archived':raise HTTPException(409,'Archived cases cannot receive proposals')
    if data.revision_of:
        prior=scoped_proposal(db,data.revision_of,user)
        if prior.case_id!=case_id:raise HTTPException(422,'Revision must belong to this case')
    d=db.scalar(select(Draft).where(Draft.case_id==case_id,Draft.clinic_id==user['clinic_id']))
    if not d:d=Draft(case_id=case_id,clinic_id=user['clinic_id'],plan={});db.add(d)
    d.plan=data.plan.model_dump(mode='json');d.revision_of=data.revision_of;d.updated_at=now()
    review=get_review(db,case_id,user['clinic_id']);review.status='reviewing';review.updated_at=now()
    audit(db,user['id'],'proposal.draft_saved',case_id);db.commit();return {'id':d.id,'updated_at':d.updated_at}

@router.delete('/clinic/cases/{case_id}/draft')
def delete_draft(case_id:str,user=Depends(require('clinic')),db=Depends(get_db)):
    scoped_case(db,case_id,user)
    db.execute(delete(Draft).where(Draft.case_id==case_id,Draft.clinic_id==user['clinic_id']))
    audit(db,user['id'],'proposal.draft_discarded',case_id);db.commit();return {'ok':True}

@router.post('/clinic/cases/{case_id}/publish',status_code=201)
def publish(case_id:str,data:PublishInput,idempotency_key:str=Header(min_length=8,max_length=100),user=Depends(require('clinic')),db=Depends(get_db)):
    c=scoped_case(db,case_id,user)
    if c.status=='archived':raise HTTPException(409,'Archived cases cannot receive proposals')
    cid=user['clinic_id'];plan=data.plan.model_dump(mode='json');request_hash=digest({'case_id':case_id,'plan':plan,'revision_of':data.revision_of})
    prior_request=db.scalar(select(Proposal).where(Proposal.clinic_id==cid,Proposal.idempotency_key==idempotency_key))
    if prior_request:
        if prior_request.request_hash!=request_hash:raise HTTPException(409,'Submission key already used for different content')
        return proposal_view(db,prior_request)
    prior=scoped_proposal(db,data.revision_of,user) if data.revision_of else None
    if prior:
        if prior.case_id!=case_id:raise HTTPException(422,'Revision must belong to the same case')
        meta=state(db,prior)
        if meta and meta.status!='submitted':raise HTTPException(409,'Only the current submitted version can be revised')
        if not meta:meta=ProposalState(proposal_id=prior.id);db.add(meta)
        meta.status='superseded'
    elif any(not state(db,p) or state(db,p).status=='submitted' for p in db.scalars(select(Proposal).where(Proposal.case_id==case_id,Proposal.clinic_id==cid)).all()):
        raise HTTPException(409,'This case already has a submitted proposal. Use Revise to publish a new version.')
    p=Proposal(id=str(uuid4()),case_id=case_id,clinic_id=cid,idempotency_key=idempotency_key,request_hash=request_hash,version=(prior.version+1 if prior else 1),plan=plan,total_minor=sum(i.price_minor for i in data.plan.items),explanation_key='pending')
    db.add(p);db.add(ProposalState(proposal_id=p.id,status='submitted',revision_of=prior.id if prior else None));enqueue(db,p)
    db.execute(delete(Draft).where(Draft.case_id==case_id,Draft.clinic_id==cid))
    r=get_review(db,case_id,cid);r.status='reviewing';r.updated_at=now()
    audit(db,user['id'],'proposal.revised' if prior else 'proposal.submitted',p.id)
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,'A competing submission was saved. Refresh before retrying.')
    return proposal_view(db,p)

@router.post('/clinic/proposals/{proposal_id}/withdraw')
def withdraw(proposal_id:str,user=Depends(require('clinic')),db=Depends(get_db)):
    p=scoped_proposal(db,proposal_id,user);m=state(db,p)
    if not m:m=ProposalState(proposal_id=p.id);db.add(m)
    if m.status not in ('submitted','withdrawn'):raise HTTPException(409,'Historical versions cannot be withdrawn')
    m.status='withdrawn';audit(db,user['id'],'proposal.withdrawn',p.id);db.commit();return proposal_view(db,p)

@router.patch('/operations/appointments/{appointment_id}')
def update_appointment(appointment_id:str,data:AppointmentUpdate,user=Depends(require('clinic','admin')),db=Depends(get_db)):
    a=db.get(Appointment,appointment_id)
    if not a or (user['role']=='clinic' and a.clinic_id!=user['clinic_id']):raise HTTPException(404,'Request not found')
    transitions={'requested':{'requested','contacted','confirmed','cancelled'},'contacted':{'contacted','confirmed','cancelled'},'confirmed':{'confirmed','completed','cancelled'},'completed':{'completed'},'cancelled':{'cancelled'}}
    if data.status not in transitions.get(a.status,set()):raise HTTPException(409,'This status transition is not allowed')
    if data.status=='confirmed' and not data.scheduled_at:raise HTTPException(422,'Choose a date and time to confirm an appointment')
    if data.status=='confirmed' and data.scheduled_at<now() and a.status!='confirmed':raise HTTPException(422,'Choose a future appointment time')
    d=db.get(AppointmentDetail,a.id)
    if not d:d=AppointmentDetail(appointment_id=a.id);db.add(d)
    a.status=data.status;d.scheduled_at=data.scheduled_at.isoformat() if data.scheduled_at else None;d.notes=data.notes;d.updated_at=now()
    audit(db,user['id'],'appointment.'+data.status,a.id);db.commit();return appointment_view(db,a)

@router.put('/clinic/profile')
def update_profile(data:ProfileInput,user=Depends(require('clinic')),db=Depends(get_db)):
    c=db.get(Clinic,user['clinic_id']);p=db.get(ClinicProfile,c.id)
    for key in ('name','district','address'):setattr(c,key,getattr(data,key))
    for key in ('email','phone','website','description','hours'):setattr(p,key,getattr(data,key))
    audit(db,user['id'],'clinic.profile_updated',c.id);db.commit();return profile_view(db,c)

@router.post('/operations/accounts',status_code=201)
def create_account(data:AccountInput,user=Depends(require('clinic','admin')),db=Depends(get_db)):
    cid=data.clinic_id
    if user['role']=='clinic':
        if data.role!='clinic' or (cid and cid!=user['clinic_id']):raise HTTPException(403,'You can only create accounts for your clinic')
        cid=user['clinic_id']
    if data.role=='clinic' and (not cid or not db.get(Clinic,cid)):raise HTTPException(422,'Select a clinic for this account')
    if data.role=='admin' and cid:raise HTTPException(422,'Administrator accounts do not belong to a clinic')
    a=Account(id=str(uuid4()),name=data.name,email=data.email.lower(),role=data.role,clinic_id=cid,password_hash=password_hash(data.password))
    db.add(a);audit(db,user['id'],'account.created',a.id)
    try:db.commit()
    except IntegrityError:db.rollback();raise HTTPException(409,'An account with this email already exists')
    return account_view(a)

@router.patch('/operations/accounts/{account_id}')
def update_account(account_id:str,data:AccountUpdate,user=Depends(require('clinic','admin')),db=Depends(get_db)):
    a=db.get(Account,account_id)
    if not a or (user['role']=='clinic' and (a.clinic_id!=user['clinic_id'] or a.role!='clinic')):raise HTTPException(404,'Account not found')
    if a.id==user['id'] and not data.active:raise HTTPException(409,'You cannot disable your own account')
    a.active=data.active
    if data.password:a.password_hash=password_hash(data.password)
    if not data.active or data.password:db.execute(delete(LoginSession).where(LoginSession.account_id==a.id))
    audit(db,user['id'],'account.updated',a.id);db.commit();return account_view(a)

@router.get('/admin/workspace')
def admin_workspace(user=Depends(require('admin')),db=Depends(get_db)):
    cases=db.scalars(select(Case).order_by(Case.created_at.desc())).all()
    props=db.scalars(select(Proposal).order_by(Proposal.created_at.desc())).all()
    jobs=db.scalars(select(ExplanationJob).order_by(ExplanationJob.created_at.desc())).all()
    explanations=db.scalars(select(Explanation)).all()
    gateway=gateway_status()
    return {'clinics':[profile_view(db,c) for c in db.scalars(select(Clinic).order_by(Clinic.name)).all()],'cases':[case_view(db,c,user) for c in cases],'proposals':[proposal_view(db,p) for p in props],'appointments':[appointment_view(db,a) for a in db.scalars(select(Appointment).order_by(Appointment.created_at.desc())).all()],'accounts':[account_view(a) for a in db.scalars(select(Account).order_by(Account.created_at.desc())).all()], 'jobs':[explanation_job_view(db,j) for j in jobs],'glossary':[{'code':g.code,'name':g.name,'explanation':g.explanation,'reviewed':g.reviewed,'reviewer':g.reviewer,'version':g.version} for g in db.scalars(select(GlossaryEntry)).all()], 'settings':db.get(PlatformSetting,'operations').value, 'audit':[{'id':a.id,'actor':a.actor,'action':a.action,'entity':a.entity,'created_at':a.created_at} for a in db.scalars(select(Audit).order_by(Audit.created_at.desc()).limit(1000)).all()], 'telemetry':{'explanations':len(explanations),'input_tokens':sum(e.input_tokens for e in explanations),'output_tokens':sum(e.output_tokens for e in explanations),'cost':sum(float(e.estimated_cost) for e in explanations),'provider':gateway['provider'],'model':gateway['model'],'configured':gateway['configured']}}

@router.get('/admin/ai/gateway',response_model=GatewayStatus)
def admin_ai_gateway(user=Depends(require('admin'))):
    """Non-secret gateway readiness for operations; credentials stay server-side."""
    return gateway_status()

@router.post('/admin/clinics',status_code=201)
def create_clinic(data:ClinicCreate,user=Depends(require('admin')),db=Depends(get_db)):
    c=Clinic(id=str(uuid4()),name=data.name,region=data.region,district=data.district,address=data.address)
    p=ClinicProfile(clinic_id=c.id,**{k:getattr(data,k) for k in ('email','phone','website','description','hours')})
    db.add(c);db.add(p)
    if data.latitude is not None:
        db.add(ClinicLocation(clinic_id=c.id,latitude=data.latitude,longitude=data.longitude))
    audit(db,user['id'],'clinic.created',c.id);db.commit();return profile_view(db,c)

@router.patch('/admin/clinics/{clinic_id}/review')
def review_clinic(clinic_id:str,data:ClinicReviewInput,user=Depends(require('admin')),db=Depends(get_db)):
    c=db.get(Clinic,clinic_id);p=db.get(ClinicProfile,clinic_id)
    if not c or not p:raise HTTPException(404,'Clinic not found')
    if data.status in ('rejected','suspended') and len(data.review_notes.strip())<3:raise HTTPException(422,'Provide a reason for this decision')
    p.status=data.status;p.review_notes=data.review_notes
    if data.status!='active':
        ids=db.scalars(select(Account.id).where(Account.clinic_id==clinic_id)).all()
        db.execute(delete(LoginSession).where(LoginSession.account_id.in_(ids)))
    audit(db,user['id'],'clinic.'+data.status,clinic_id);db.commit();return profile_view(db,c)

@router.put('/admin/clinics/{clinic_id}/subscription')
def subscription(clinic_id:str,data:SubscriptionInput,user=Depends(require('admin')),db=Depends(get_db)):
    p=db.get(ClinicProfile,clinic_id)
    if not p:raise HTTPException(404,'Clinic not found')
    if data.renewal_date:
        try:datetime.strptime(data.renewal_date,'%Y-%m-%d')
        except ValueError:raise HTTPException(422,'Enter a valid renewal date')
    for k,v in data.model_dump().items():setattr(p,k,v)
    audit(db,user['id'],'subscription.updated',clinic_id);db.commit();return {'ok':True}

@router.patch('/admin/cases/{case_id}')
def admin_case(case_id:str,data:CaseAdminInput,user=Depends(require('admin')),db=Depends(get_db)):
    c=scoped_case(db,case_id,user);c.status='archived' if data.action=='archive' else ('shared' if c.recipients else 'draft')
    audit(db,user['id'],'case.'+data.action+': '+data.reason,case_id);db.commit();return case_view(db,c,user)

@router.post('/admin/cases/{case_id}/redispatch')
def redispatch(case_id:str,data:DispatchAdminInput,user=Depends(require('admin')),db=Depends(get_db)):
    c=scoped_case(db,case_id,user)
    # Consent was for explicitly selected recipients. Admins can retry only that set.
    if c.status=='archived':raise HTTPException(409,'Reopen the case before redispatching')
    if not set(data.clinic_ids)<=set(c.recipients):raise HTTPException(422,'New clinic recipients require patient consent through the mobile API')
    if not db.scalar(select(Consent.id).where(Consent.case_id==c.id)):raise HTTPException(409,'Case has no recorded consent')
    for cid in data.clinic_ids:
        profile=db.get(ClinicProfile,cid)
        if not profile or profile.status!='active':raise HTTPException(422,'Only active clinics can receive cases')
        r=get_review(db,case_id,cid);r.status='new';r.updated_at=now()
    audit(db,user['id'],'case.redispatched',case_id);db.commit();return {'ok':True}

@router.patch('/admin/proposals/{proposal_id}/review')
def moderate(proposal_id:str,data:ModerationInput,user=Depends(require('admin')),db=Depends(get_db)):
    p=scoped_proposal(db,proposal_id,user);s=state(db,p)
    if data.moderation=='flagged' and len(data.review_notes)<3:raise HTTPException(422,'Explain why this proposal is flagged')
    if not s:s=ProposalState(proposal_id=p.id);db.add(s)
    s.moderation=data.moderation;s.review_notes=data.review_notes
    audit(db,user['id'],'proposal.reviewed',p.id);db.commit();return proposal_view(db,p)

@router.post('/admin/proposals/{proposal_id}/explain')
def retry_explanation(proposal_id:str,user=Depends(require('admin')),db=Depends(get_db)):
    p=scoped_proposal(db,proposal_id,user);enqueue(db,p,True)
    audit(db,user['id'],'explanation.queued',p.id);db.commit();return {'key':p.explanation_key,'status':db.get(ExplanationJob,p.explanation_key).status}

@router.put('/admin/glossary/{code}')
def glossary_update(code:str,data:GlossaryInput,user=Depends(require('admin')),db=Depends(get_db)):
    g=db.get(GlossaryEntry,code)
    if not g:raise HTTPException(404,'Procedure not found')
    if data.reviewed and len(data.reviewer)<3:raise HTTPException(422,'Record the dentist reviewer’s name')
    g.explanation=data.explanation;g.reviewed=data.reviewed;g.reviewer=data.reviewer;g.version+=1
    audit(db,user['id'],'glossary.updated',code);db.commit();return {'ok':True,'version':g.version}

@router.put('/admin/settings')
def settings_update(data:SettingsInput,user=Depends(require('admin')),db=Depends(get_db)):
    s=db.get(PlatformSetting,'operations');s.value=data.model_dump()
    audit(db,user['id'],'platform.settings_updated','operations');db.commit();return s.value

@router.put('/admin/clinics/{clinic_id}/profile')
def admin_profile(clinic_id:str,data:ClinicCreate,user=Depends(require('admin')),db=Depends(get_db)):
    c=db.get(Clinic,clinic_id);p=db.get(ClinicProfile,clinic_id)
    if not c or not p:raise HTTPException(404,'Clinic not found')
    for key in ('name','region','district','address'):setattr(c,key,getattr(data,key))
    for key in ('email','phone','website','description','hours'):setattr(p,key,getattr(data,key))
    loc=db.get(ClinicLocation,clinic_id)
    if data.latitude is None:
        if loc:db.delete(loc)
    elif loc:
        loc.latitude=data.latitude;loc.longitude=data.longitude
    else:
        db.add(ClinicLocation(clinic_id=clinic_id,latitude=data.latitude,longitude=data.longitude))
    audit(db,user['id'],'clinic.profile_updated',clinic_id);db.commit();return profile_view(db,c)
