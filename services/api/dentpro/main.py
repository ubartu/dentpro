import os
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote
from uuid import UUID, uuid4
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from sqlalchemy import select, text, delete
from sqlalchemy.exc import IntegrityError
from .db import Base, engine, get_db, Case, Clinic, Proposal, Explanation, Appointment, Consent, Audit, XrayAsset, audit
from .auth import actor, require, TOKENS, ACTORS
from .runtime import cloud_mode, cors_origins
from .contracts import CaseInput, DispatchInput, ProposalInput, AppointmentInput, PROCEDURES, ClinicOutput, CaseOutput, ProposalOutput, ComparisonOutput, AppointmentOutput, AuditOutput
from .interpreter import cache_key, digest, localize_legacy_output
from .operations_models import ClinicProfile, PlatformSetting, ProposalState, ExplanationJob, PatientCaseRequest

@asynccontextmanager
async def lifespan(app):
    if cloud_mode():
        from .cloud_schema import initialize_cloud_schema
        initialize_cloud_schema()
    else:
        Base.metadata.create_all(engine)
        from .seed import seed
        seed()
        from .operations_seed import seed_operations
        seed_operations()
    yield

app = FastAPI(title='DENTRIVO API', version='0.1.0', lifespan=lifespan,
              docs_url=None if cloud_mode() else '/docs', redoc_url=None if cloud_mode() else '/redoc',
              openapi_url=None if cloud_mode() else '/openapi.json')
app.add_middleware(CORSMiddleware, allow_origins=cors_origins(), allow_methods=['GET','POST','PUT','PATCH','DELETE'], allow_headers=['Authorization','Content-Type','Idempotency-Key'])

@app.middleware('http')
async def security_headers(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith('/auth/password/'):
        response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['X-Frame-Options'] = 'DENY'
    if cloud_mode():
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    return response

@app.get('/health')
def health():
    with engine.connect() as connection: connection.execute(text('SELECT 1'))
    return {'status':'ok', 'environment':'cloud-staging' if cloud_mode() else 'local-demo'}

if not cloud_mode():
    @app.post('/demo/session/{role}')
    def session(role: str):
        if role not in TOKENS: raise HTTPException(404)
        return {'token': TOKENS[role], 'user': ACTORS[role]}

@app.get('/catalog')
def catalog(user=Depends(actor)):
    return [{'code':k, 'name':v[0]} for k,v in PROCEDURES.items()]

@app.get('/clinics', response_model=list[ClinicOutput])
def clinics(user=Depends(actor), db=Depends(get_db)):
    return db.scalars(select(Clinic).order_by(Clinic.name)).all()

def access_case(db, case_id, user, lock=False):
    c = db.scalar(select(Case).where(Case.id==case_id).with_for_update()) if lock else db.get(Case, case_id)
    if not c: raise HTTPException(404, 'Vaka bulunamadı')
    allowed = user['role'] == 'admin' or (user['role'] == 'patient' and c.user_id == user['id']) or (user['role'] == 'clinic' and user['clinic_id'] in c.recipients)
    if not allowed: raise HTTPException(404, 'Vaka bulunamadı')
    return c

def case_view(c):
    return {'id':c.id, 'title':c.title, 'region':c.region, 'status':c.status, 'recipients':c.recipients, 'created_at':c.created_at, 'asset':{'name':c.asset['name'],'type':c.asset['type']} if c.asset else None}

def proposal_view(db, p):
    e = db.get(Explanation,p.explanation_key)
    clinic = db.get(Clinic,p.clinic_id)
    job = db.get(ExplanationJob, p.explanation_key)
    setting = db.get(PlatformSetting, 'operations')
    explanation_status = 'ready' if e else 'failed' if job and job.status == 'failed' else 'paused' if setting and not setting.value.get('explanations_enabled', True) else 'pending'
    return {'id':p.id,'case_id':p.case_id,'clinic_id':p.clinic_id,'clinic_name':clinic.name,'district':clinic.district,'plan':p.plan,'total_minor':p.total_minor,'version':p.version,'created_at':p.created_at,'explanation':localize_legacy_output(e.output, p.plan) if e else None,'explanation_status':explanation_status}

@app.get('/cases', response_model=list[CaseOutput])
def cases(user=Depends(actor),db=Depends(get_db)):
    records = db.scalars(select(Case).order_by(Case.created_at.desc())).all()
    return [case_view(c) for c in records if user['role']=='admin' or (user['role']=='patient' and c.user_id==user['id']) or (user['role']=='clinic' and user['clinic_id'] in c.recipients)]

@app.post('/cases',status_code=201, response_model=CaseOutput)
def create_case(data: CaseInput,user=Depends(require('patient')),db=Depends(get_db),idempotency_key: str | None=Header(default=None,min_length=8,max_length=100)):
    request_hash = digest(data.model_dump())
    if idempotency_key:
        prior = db.scalar(select(PatientCaseRequest).where(PatientCaseRequest.user_id==user['id'],PatientCaseRequest.request_key==idempotency_key))
        if prior:
            if prior.request_hash != request_hash: raise HTTPException(409, 'Bu gönderim başka bir vaka için kullanılmış')
            existing=db.get(Case,prior.case_id)
            if not existing: raise HTTPException(410,'Bu taslak silindi. Yeni bir vaka oluşturun.')
            return case_view(existing)
    c = Case(id=str(uuid4()),user_id=user['id'],title=data.title,region=data.region)
    from .patient import CONSENT_VERSION
    if data.consent_version and data.consent_version != CONSENT_VERSION: raise HTTPException(409, 'Onay koşulları değişti. Güncel koşulları yenileyip inceleyin.')
    db.add(c); db.add(Consent(user_id=user['id'],case_id=c.id,version=data.consent_version or 'demo-1'))
    if idempotency_key: db.add(PatientCaseRequest(user_id=user['id'],request_key=idempotency_key,request_hash=request_hash,case_id=c.id))
    audit(db,user['id'],'case.created',c.id); audit(db,user['id'],'consent.recorded',c.id)
    try: db.commit()
    except IntegrityError:
        db.rollback()
        prior = db.scalar(select(PatientCaseRequest).where(PatientCaseRequest.user_id==user['id'],PatientCaseRequest.request_key==idempotency_key))
        if not prior or prior.request_hash != request_hash: raise HTTPException(409, 'Gönderim çakışması oluştu; vakalarınızı yenileyin')
        return case_view(db.get(Case,prior.case_id))
    return case_view(c)

@app.delete('/cases/{case_id}', status_code=204)
def delete_draft(case_id:str,user=Depends(require('patient')),db=Depends(get_db)):
    c=access_case(db,case_id,user,lock=True)
    if c.status!='draft' or c.recipients or db.scalar(select(Proposal.id).where(Proposal.case_id==case_id).limit(1)):
        raise HTTPException(409,'Yalnızca paylaşılmamış taslak vakalar silinebilir.')
    asset_path=None
    if not cloud_mode() and c.asset and not c.asset.get('synthetic'):
        # Upload keys are server-generated UUIDs, never user-supplied paths.
        asset_path=Path('.data/assets')/str(UUID(c.asset['key']))
    result=db.execute(delete(Case).where(Case.id==case_id,Case.user_id==user['id'],Case.status=='draft'))
    if result.rowcount!=1:
        db.rollback(); raise HTTPException(409,'Vaka değişti. Vakalarınızı yenileyin.')
    db.execute(delete(Consent).where(Consent.case_id==case_id))
    db.execute(delete(XrayAsset).where(XrayAsset.case_id==case_id))
    # Keep audit events and the request mapping as a tombstone against stale retries.
    audit(db,user['id'],'case.draft_deleted',case_id); db.commit()
    if asset_path: asset_path.unlink(missing_ok=True)
    return Response(status_code=204)

@app.post('/cases/{case_id}/xray',status_code=201, response_model=CaseOutput)
async def upload(case_id:str,file:UploadFile=File(...),user=Depends(require('patient')),db=Depends(get_db)):
    c=access_case(db,case_id,user,lock=True)
    if c.status != 'draft': raise HTTPException(409,'Paylaşımdan sonra görseller değiştirilemez. Yeni bir vaka oluşturun.')
    setting=db.get(PlatformSetting,'operations')
    limit=(setting.value.get('upload_limit_mb',10) if setting else 10)*1024*1024
    data=await file.read(limit+1)
    if len(data)>limit: raise HTTPException(413,f'En büyük dosya boyutu {limit//1024//1024} MB')
    kind = 'image/png' if data.startswith(b'\x89PNG\r\n\x1a\n') else 'image/jpeg' if data.startswith(b'\xff\xd8\xff') else 'application/pdf' if data.startswith(b'%PDF-') else None
    if not kind: raise HTTPException(415,'PNG, JPEG veya PDF dosyası yükleyin')
    key=str(uuid4())
    if cloud_mode():
        existing=db.get(XrayAsset,c.id)
        if existing: existing.data=data
        else: db.add(XrayAsset(case_id=c.id,data=data))
    else:
        path=Path('.data/assets')/key; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
    c.asset={'key':key,'name':Path(file.filename or 'xray').name[:150],'type':kind}
    audit(db,user['id'],'xray.uploaded',c.id); db.commit()
    return case_view(c)

@app.get('/cases/{case_id}/xray')
def download(case_id:str,user=Depends(actor),db=Depends(get_db)):
    c=access_case(db,case_id,user)
    if not c.asset or c.asset.get('synthetic'): raise HTTPException(404,'Bu örnek vakada klinik görüntü yok. Yeni bir vakaya örnek dosya yükleyin.')
    audit(db,user['id'],'xray.accessed',c.id); db.commit()
    headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
    if cloud_mode():
        asset=db.get(XrayAsset,c.id)
        if not asset: raise HTTPException(404,'Görsel kullanılamıyor')
        headers['Content-Disposition']="attachment; filename*=UTF-8''"+quote(c.asset['name'],safe='')
        return Response(content=asset.data,media_type=c.asset['type'],headers=headers)
    return FileResponse(Path('.data/assets')/c.asset['key'],media_type=c.asset['type'],filename=c.asset['name'],headers=headers)

@app.post('/cases/{case_id}/dispatch', response_model=CaseOutput)
def dispatch(case_id:str,data:DispatchInput,user=Depends(require('patient')),db=Depends(get_db)):
    c=access_case(db,case_id,user,lock=True)
    if c.status=='archived':raise HTTPException(409,'Vaka arşivlendi')
    if not c.asset: raise HTTPException(409,'Vakayı paylaşmadan önce görsel yükleyin')
    setting=db.get(PlatformSetting,'operations')
    if len(set(c.recipients+data.clinic_ids))>(setting.value.get('max_recipients',10) if setting else 10):raise HTTPException(422,'Klinik alıcı sınırı aşıldı')
    for cid in data.clinic_ids:
        profile=db.get(ClinicProfile,cid)
        if not profile or profile.status!='active':raise HTTPException(422,'Seçilen klinik vaka kabul etmiyor')
    selected=db.scalars(select(Clinic).where(Clinic.id.in_(data.clinic_ids))).all()
    if len(selected)!=len(set(data.clinic_ids)): raise HTTPException(422,'Platformdaki klinikleri seçin')
    c.recipients=sorted(set(c.recipients+data.clinic_ids));c.status='shared'
    audit(db,user['id'],'case.dispatched',c.id);db.commit();return case_view(c)

@app.get('/cases/{case_id}/proposals', response_model=list[ProposalOutput])
def proposals(case_id:str,user=Depends(actor),db=Depends(get_db)):
    access_case(db,case_id,user)
    query=select(Proposal).where(Proposal.case_id==case_id).order_by(Proposal.created_at)
    if user['role']=='clinic': query=query.where(Proposal.clinic_id==user['clinic_id'])
    return [proposal_view(db,p) for p in db.scalars(query).all() if user['role']!='patient' or is_visible(db,p)]

@app.post('/clinic/cases/{case_id}/proposals',status_code=201, response_model=ProposalOutput)
def submit(case_id:str,data:ProposalInput,idempotency_key:str=Header(min_length=8,max_length=100),user=Depends(require('clinic')),db=Depends(get_db)):
    # All clinic submissions share the same lifecycle and cache semantics.
    from .operations import publish, PublishInput
    return publish(case_id, PublishInput(plan=data), idempotency_key, user, db)

@app.get('/proposals/{proposal_id}', response_model=ProposalOutput)
def proposal(proposal_id:str,user=Depends(actor),db=Depends(get_db)):
    p=db.get(Proposal,proposal_id)
    if not p: raise HTTPException(404)
    access_case(db,p.case_id,user)
    if user['role']=='clinic' and p.clinic_id!=user['clinic_id']: raise HTTPException(404)
    if user['role']=='patient' and not is_visible(db,p):raise HTTPException(404)
    return proposal_view(db,p)

@app.post('/cases/{case_id}/compare', response_model=ComparisonOutput)
def compare(case_id:str,user=Depends(require('patient')),db=Depends(get_db)):
    access_case(db,case_id,user)
    rows=db.scalars(select(Proposal).where(Proposal.case_id==case_id).order_by(Proposal.created_at)).all()
    # Source order only; no score, winner, clinical equivalence or sponsored ranking.
    proposals=[proposal_view(db,p) for p in rows if is_visible(db,p)]
    currencies={p['plan']['currency'] for p in proposals}
    notice='Farklı işlemler farklı tedavi kapsamlarını ifade edebilir. Fiyatlar ön bilgilendirme amaçlıdır; karşılaştırma klinik öneri değildir.'
    if len(currencies)>1: notice+=' Bu teklifler farklı para birimlerindedir. Döviz kuru dönüşümü yapılmadığı için toplam tutarlar doğrudan karşılaştırılamaz.'
    return {'case_id':case_id,'currency':next(iter(currencies)) if len(currencies)==1 else None,'proposals':proposals, 'notice':notice}

@app.post('/appointments',status_code=201, response_model=AppointmentOutput)
def book(data:AppointmentInput,user=Depends(require('patient')),db=Depends(get_db)):
    p=db.get(Proposal,data.proposal_id)
    if not p: raise HTTPException(404)
    c=access_case(db,p.case_id,user)
    if c.status=='archived' or not is_visible(db,p):raise HTTPException(409,'Bu teklif artık taleplere açık değil')
    prior=db.scalar(select(Appointment).where(Appointment.proposal_id==p.id,Appointment.user_id==user['id']))
    if prior:return prior
    a=Appointment(proposal_id=p.id,user_id=user['id'],clinic_id=p.clinic_id,kind=data.kind)
    db.add(a);audit(db,user['id'],'appointment.requested',p.id)
    try: db.commit()
    except IntegrityError:
        db.rollback();return db.scalar(select(Appointment).where(Appointment.proposal_id==p.id,Appointment.user_id==user['id']))
    return a

@app.get('/appointments', response_model=list[AppointmentOutput])
def appointments(user=Depends(actor),db=Depends(get_db)):
    q=select(Appointment).order_by(Appointment.created_at.desc())
    if user['role']=='patient':q=q.where(Appointment.user_id==user['id'])
    if user['role']=='clinic':q=q.where(Appointment.clinic_id==user['clinic_id'])
    return db.scalars(q).all()

@app.get('/admin/audit', response_model=list[AuditOutput])
def audit_list(user=Depends(require('admin')),db=Depends(get_db)):
    return db.scalars(select(Audit).order_by(Audit.created_at.desc()).limit(100)).all()


def is_visible(db,p):
    s=db.get(ProposalState,p.id)
    return not s or (s.status=='submitted' and s.moderation!='flagged')

from .operations import router as operations_router
app.include_router(operations_router)

from .patient import router as patient_router
app.include_router(patient_router)

from .clinic_discovery import router as discovery_router
app.include_router(discovery_router)

from .password_recovery import router as recovery_router
app.include_router(recovery_router)
