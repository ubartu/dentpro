import os
import tempfile
from pathlib import Path

TEST_DIR = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = f'sqlite:///{TEST_DIR.name}/test.db'
os.environ['APP_ENV'] = 'development'
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, func
from dentpro.main import app
from dentpro.auth import actor, ACTORS
from dentpro.db import Session, Explanation, Proposal, Case, Audit
from dentpro.worker import run_once
from dentpro.interpreter import cache_key, canonical_source

@pytest.fixture(scope='module')
def client():
    with TestClient(app) as c: yield c

def auth(c, role):
    if role=='clinic':return signin(c)
    if role=='admin':return admin_signin(c)
    return {'Authorization':'Bearer '+c.post('/demo/session/'+role).json()['token']}

def plan(**overrides):
    return {'items':[{'tooth':'16','procedure_code':'ROOT_CANAL','material':None,'price_minor':650050,'sessions':2}], 'sessions':2,'requires_exam':True,'notes':'','currency':'TRY', **overrides}

def test_full_marketplace_and_cached_worker(client):
    patient=auth(client,'patient');clinic=auth(client,'clinic')
    r=client.post('/cases',headers=patient,json={'title':'Integration case','region':'Istanbul','consent':True})
    assert r.status_code==201
    cid=r.json()['id']
    assert client.post(f'/cases/{cid}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']}).status_code==409
    assert client.get(f'/cases/{cid}/proposals',headers=clinic).status_code==404
    r=client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('synthetic.png',b'\x89PNG\r\n\x1a\nTEST','image/png')})
    assert r.status_code==201
    assert client.post(f'/cases/{cid}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']}).status_code==200
    assert client.get(f'/cases/{cid}/xray',headers=clinic).status_code==200
    assert client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('a.png',b'\x89PNG\r\n\x1a\nTEST')}).status_code==409
    endpoint=f'/clinic/cases/{cid}/proposals';headers=clinic|{'Idempotency-Key':'integration-key'}
    r=client.post(endpoint,headers=headers,json=plan())
    assert r.status_code==201
    p=r.json(); assert p['total_minor']==650050 and p['explanation'] is None
    assert client.post(endpoint,headers=headers,json=plan()).json()['id']==p['id']
    assert client.post(endpoint,headers=headers,json=plan(sessions=3)).status_code==409
    run_once()
    with Session() as db: before=db.scalar(select(func.count()).select_from(Explanation))
    for _ in range(3): assert client.get('/proposals/'+p['id'],headers=patient).json()['explanation']['mode']=='template'
    assert run_once()==0
    with Session() as db: assert db.scalar(select(func.count()).select_from(Explanation))==before
    compare=client.post(f'/cases/{cid}/compare',headers=patient).json()
    assert compare['proposals'][0]['total_minor']==650050
    a=client.post('/appointments',headers=patient,json={'proposal_id':p['id']})
    assert a.status_code==201
    assert client.post('/appointments',headers=patient,json={'proposal_id':p['id']}).json()['id']==a.json()['id']
    assert any(x['id']==a.json()['id'] for x in client.get('/appointments',headers=clinic).json())

def test_rbac_and_patient_ownership(client):
    assert client.get('/cases').status_code in (401,403)
    assert client.get('/admin/audit',headers=auth(client,'patient')).status_code==403
    assert client.get('/proposals/proposal-2',headers=auth(client,'clinic')).status_code==404
    assert client.post('/appointments',headers=auth(client,'clinic'),json={'proposal_id':'proposal-1'}).status_code==403
    app.dependency_overrides[actor]=lambda:{'id':'another-patient','role':'patient'}
    try:
        assert client.get('/cases').json()==[]
        assert client.get('/proposals/proposal-1').status_code==404
        assert client.get('/cases/case-demo/xray').status_code==404
        assert client.post('/cases/case-demo/compare').status_code==404
    finally: app.dependency_overrides.clear()

def test_input_validation_and_consent(client):
    patient=auth(client,'patient');clinic=auth(client,'clinic')
    assert client.post('/cases',headers=patient,json={'title':'No consent','consent':False}).status_code==422
    assert client.post('/cases',headers=patient,json={'title':'No consent'}).status_code==422
    bad=plan();bad['items'][0]['procedure_code']='AI_DIAGNOSIS'
    assert client.post('/clinic/cases/case-demo/proposals',headers=clinic|{'Idempotency-Key':'invalid-taxonomy'},json=bad).status_code==422
    bad=plan();bad['items'][0]['price_minor']=-1
    assert client.post('/clinic/cases/case-demo/proposals',headers=clinic|{'Idempotency-Key':'invalid-price'},json=bad).status_code==422
    bad=plan();bad['items'][0]['tooth']='99'
    assert client.post('/clinic/cases/case-demo/proposals',headers=clinic|{'Idempotency-Key':'invalid-tooth'},json=bad).status_code==422
    assert client.post('/clinic/cases/case-demo/proposals',headers=clinic|{'Idempotency-Key':'invalid-time'},json=plan(first_available_slot='2026-10-01T10:00:00')).status_code==422

def test_interpreter_boundary_and_hash():
    p=plan(notes='Secret patient name and phone')
    assert 'Secret' not in str(canonical_source(p))
    assert 'notes' not in canonical_source(p)
    assert cache_key(p)==cache_key(plan(notes='Different patient'))
    assert cache_key(p)!=cache_key(plan(sessions=3))

def test_reject_invalid_upload_and_region(client):
    patient=auth(client,'patient')
    cid=client.post('/cases',headers=patient,json={'title':'Upload validation','region':'Ankara','consent':True}).json()['id']
    assert client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('evil.png',b'<html>bad</html>','image/png')}).status_code==415
    assert client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('large.png',b'\x89PNG\r\n\x1a\n'+b'0'*(10*1024*1024),'image/png')}).status_code==413
    client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('a.png',b'\x89PNG\r\n\x1a\nTEST','image/png')})
    assert client.post(f'/cases/{cid}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']}).status_code==422

def test_audit_records_access_and_consent(client):
    events=client.get('/admin/audit',headers=auth(client,'admin')).json()
    actions={e['action'] for e in events}
    assert {'consent.recorded','xray.accessed','proposal.submitted','explanation.created','appointment.requested'}<=actions

def signin(client,email='clinic@dentpro.local',password='Clinic123!'):
    response=client.post('/auth/login',json={'email':email,'password':password})
    assert response.status_code==200,response.text
    return {'Authorization':'Bearer '+response.json()['token']}

def admin_signin(client):return signin(client,'admin@dentpro.local','Admin123!')

def test_distinct_portal_accounts_and_scope(client):
    clinic=signin(client);admin=admin_signin(client)
    assert client.post('/auth/login',json={'email':'clinic@dentpro.local','password':'wrong'}).status_code==401
    assert client.get('/admin/workspace',headers=clinic).status_code==403
    assert client.get('/clinic/workspace',headers=admin).status_code==403
    data=client.get('/clinic/workspace',headers=clinic).json()
    assert data['clinic']['id']=='clinic-1'
    assert all(p['clinic_id']=='clinic-1' for p in data['proposals'])
    assert all(a['clinic_id']=='clinic-1' for a in data['appointments'])
    assert all(a['clinic_id']=='clinic-1' for a in data['members'])
    assert client.get('/auth/me',headers=clinic).json()['role']=='clinic'
    assert client.post('/auth/logout',headers=clinic).status_code==200
    assert client.get('/auth/me',headers=clinic).status_code==401

def test_draft_publish_revision_and_withdrawal(client):
    clinic=signin(client);patient=auth(client,'patient')
    cid=client.post('/cases',headers=patient,json={'title':'Revision lifecycle case','consent':True}).json()['id']
    client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('synthetic.png',b'\x89PNG\r\n\x1a\nTEST')})
    client.post(f'/cases/{cid}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']})
    payload={'plan':plan(),'revision_of':None}
    assert client.put(f'/clinic/cases/{cid}/draft',headers=clinic,json=payload).status_code==200
    assert client.get(f'/clinic/cases/{cid}',headers=clinic).json()['draft']['plan']['items'][0]['price_minor']==650050
    h=clinic|{'Idempotency-Key':'operations-publish-1'}
    r=client.post(f'/clinic/cases/{cid}/publish',headers=h,json=payload)
    assert r.status_code==201,r.text
    p=r.json();assert p['status']=='submitted' and p['version']==1
    assert client.post(f'/clinic/cases/{cid}/publish',headers=h,json=payload).json()['id']==p['id']
    assert client.get(f'/clinic/cases/{cid}',headers=clinic).json()['draft'] is None
    assert client.post(f'/clinic/cases/{cid}/publish',headers=clinic|{'Idempotency-Key':'second-active-proposal'},json=payload).status_code==409
    updated={'plan':plan(sessions=3),'revision_of':p['id']}
    r=client.post(f'/clinic/cases/{cid}/publish',headers=clinic|{'Idempotency-Key':'operations-revision-2'},json=updated)
    assert r.status_code==201,r.text
    p2=r.json();assert p2['version']==2
    assert client.get('/proposals/'+p['id'],headers=patient).status_code==404
    visible=client.get(f'/cases/{cid}/proposals',headers=patient).json()
    assert [x['id'] for x in visible]==[p2['id']]
    assert client.post('/clinic/proposals/'+p2['id']+'/withdraw',headers=clinic).status_code==200
    assert client.post('/appointments',headers=patient,json={'proposal_id':p2['id']}).status_code==409
    assert client.get(f'/cases/{cid}/proposals',headers=patient).json()==[]

def test_clinic_approval_suspension_and_session_revocation(client):
    admin=admin_signin(client);clinic=signin(client)
    r=client.patch('/admin/clinics/clinic-1/review',headers=admin,json={'status':'suspended','review_notes':'Verification follow-up required'})
    assert r.status_code==200
    try:
        assert client.get('/clinic/workspace',headers=clinic).status_code in (401,403)
        assert client.post('/auth/login',json={'email':'clinic@dentpro.local','password':'Clinic123!'}).status_code==403
        assert client.post('/demo/session/clinic').status_code==404
        assert client.post('/demo/session/admin').status_code==404
    finally:
        assert client.patch('/admin/clinics/clinic-1/review',headers=admin,json={'status':'active','review_notes':'Reactivated after test'}).status_code==200
    assert client.get('/clinic/workspace',headers=clinic).status_code==401
    assert client.get('/clinic/workspace',headers=signin(client)).status_code==200

def test_account_management_and_tenant_protection(client):
    admin=admin_signin(client);clinic=signin(client)
    body={'name':'Test Coordinator','email':'test.coordinator@example.org','role':'clinic','clinic_id':'clinic-2','password':'Secure-test-123!'}
    assert client.post('/operations/accounts',headers=clinic,json=body).status_code==403
    r=client.post('/operations/accounts',headers=admin,json=body);assert r.status_code==201,r.text
    aid=r.json()['id'];other=signin(client,body['email'],body['password'])
    assert client.get('/clinic/cases/ops-case-1',headers=other).status_code==200
    assert client.patch('/operations/accounts/'+aid,headers=clinic,json={'active':False}).status_code==404
    assert client.patch('/operations/accounts/'+aid,headers=admin,json={'active':False}).status_code==200
    assert client.get('/clinic/workspace',headers=other).status_code==401
    current=client.get('/auth/me',headers=admin).json()['id']
    assert client.patch('/operations/accounts/'+current,headers=admin,json={'active':False}).status_code==409

def test_appointment_state_machine_and_clinic_isolation(client):
    from datetime import timedelta
    from dentpro.db import now
    clinic=signin(client);patient=auth(client,'patient');admin=admin_signin(client)
    r=client.post('/appointments',headers=patient,json={'proposal_id':'proposal-1'})
    assert r.status_code==201
    aid=r.json()['id']
    assert client.patch('/operations/appointments/'+aid,headers=clinic,json={'status':'completed'}).status_code==409
    assert client.patch('/operations/appointments/'+aid,headers=clinic,json={'status':'confirmed'}).status_code==422
    assert client.patch('/operations/appointments/'+aid,headers=clinic,json={'status':'contacted','notes':'Called patient for coordination'}).status_code==200
    slot=(now()+timedelta(days=5)).isoformat()
    assert client.patch('/operations/appointments/'+aid,headers=clinic,json={'status':'confirmed','scheduled_at':slot}).status_code==200
    assert client.patch('/operations/appointments/'+aid,headers=clinic,json={'status':'completed','scheduled_at':slot}).status_code==200
    assert client.patch('/operations/appointments/'+aid,headers=clinic,json={'status':'requested'}).status_code==409
    foreign=client.get('/admin/workspace',headers=admin).json()['appointments']
    aid2=next(a['id'] for a in foreign if a['clinic_id']=='clinic-2')
    assert client.patch('/operations/appointments/'+aid2,headers=clinic,json={'status':'contacted'}).status_code==404

def test_admin_glossary_jobs_settings_and_subscription(client):
    admin=admin_signin(client)
    data=client.get('/admin/workspace',headers=admin).json();old=data['settings'];g=next(x for x in data['glossary'] if x['code']=='ROOT_CANAL')
    assert client.put('/admin/glossary/ROOT_CANAL',headers=admin,json={'explanation':g['explanation'],'reviewed':True,'reviewer':''}).status_code==422
    assert client.put('/admin/glossary/ROOT_CANAL',headers=admin,json={'explanation':g['explanation'],'reviewed':True,'reviewer':'Synthetic test reviewer'}).status_code==200
    assert client.put('/admin/settings',headers=admin,json=old|{'explanations_enabled':False}).status_code==200
    try:
        r=client.post('/admin/proposals/proposal-1/explain',headers=admin);assert r.status_code==200
        key=r.json()['key'];assert r.json()['status']=='pending'
        assert run_once()==0
    finally:client.put('/admin/settings',headers=admin,json=old)
    run_once()
    with Session() as db:assert db.get(Explanation,key) is not None
    assert client.put('/admin/clinics/clinic-1/subscription',headers=admin,json={'subscription':'active','monthly_fee_minor':200000,'renewal_date':'2026-10-24'}).status_code==200
    assert client.get('/clinic/workspace',headers=signin(client)).json()['clinic']['monthly_fee_minor']==200000

def test_archive_and_consent_preserving_redispatch(client):
    admin=admin_signin(client);clinic=signin(client)
    assert client.post('/admin/cases/ops-case-1/redispatch',headers=admin,json={'clinic_ids':['clinic-3']}).status_code==422
    assert client.post('/admin/cases/ops-case-1/redispatch',headers=admin,json={'clinic_ids':['clinic-1']}).status_code==200
    assert client.patch('/admin/cases/ops-case-1',headers=admin,json={'action':'archive','reason':'Test archiving'}).status_code==200
    try:
        assert client.put('/clinic/cases/ops-case-1/draft',headers=clinic,json={'plan':plan()}).status_code==409
        assert client.post('/clinic/cases/ops-case-1/publish',headers=clinic|{'Idempotency-Key':'archived-proposal'},json={'plan':plan()}).status_code==409
    finally:client.patch('/admin/cases/ops-case-1',headers=admin,json={'action':'reopen','reason':'Test complete'})

def test_worker_failure_is_durable_and_retry_is_bounded(client,monkeypatch):
    import dentpro.worker as worker
    admin=admin_signin(client)
    from dentpro.operations_models import ExplanationJob, GlossaryEntry
    with Session() as db:
        g=db.get(GlossaryEntry,'CROWN');g.version+=1;db.commit()
    result=client.post('/admin/proposals/proposal-3/explain',headers=admin).json();key=result['key']
    original=worker.explain
    def fail(_):raise ValueError('synthetic failure')
    monkeypatch.setattr(worker,'explain',fail)
    for _ in range(4):worker.run_once()
    with Session() as db:
        j=db.get(ExplanationJob,key);assert j.status=='failed' and j.attempts==3
    monkeypatch.setattr(worker,'explain',original)
    assert client.post('/admin/proposals/proposal-3/explain',headers=admin).status_code==200
    worker.run_once()
    with Session() as db:assert db.get(ExplanationJob,key).status=='completed'

def test_admin_profile_edit_and_patient_moderation(client):
    admin=admin_signin(client);clinic=signin(client);patient=auth(client,'patient')
    body={'name':'Edited synthetic clinic','region':'Izmir','district':'Konak','address':'Synthetic address','email':'test.clinic@example.org','phone':'','website':'','description':'Synthetic evaluation clinic','hours':'Weekdays 9–18'}
    assert client.put('/admin/clinics/clinic-4/profile',headers=clinic,json=body).status_code==403
    assert client.put('/admin/clinics/clinic-4/profile',headers=admin,json=body).status_code==200
    row=next(c for c in client.get('/admin/workspace',headers=admin).json()['clinics'] if c['id']=='clinic-4')
    assert row['name']==body['name'] and row['district']=='Konak'
    assert client.patch('/admin/proposals/proposal-2/review',headers=admin,json={'moderation':'flagged','review_notes':'Synthetic source review concern'}).status_code==200
    try:
        assert client.get('/proposals/proposal-2',headers=patient).status_code==404
        assert client.post('/appointments',headers=patient,json={'proposal_id':'proposal-2'}).status_code==409
        assert 'proposal-2' not in [p['id'] for p in client.post('/cases/case-demo/compare',headers=patient).json()['proposals']]
    finally:client.patch('/admin/proposals/proposal-2/review',headers=admin,json={'moderation':'approved','review_notes':'Test cleared'})


def register_patient(client, suffix):
    r=client.post('/patient/register',json={'name':'Mobile Patient '+suffix,'email':f'mobile.{suffix}@example.org','phone':'+90 555 010 2020','password':'Patient123!'})
    assert r.status_code==201,r.text
    return {'Authorization':'Bearer '+r.json()['token']},r.json()['user']


def test_mobile_identity_case_idempotency_and_isolation(client):
    first,user=register_patient(client,'owner');second,_=register_patient(client,'other')
    assert client.get('/patient/me',headers=first).json()['phone']=='+90 555 010 2020'
    assert client.post('/patient/login',json={'email':'clinic@dentpro.local','password':'Clinic123!'}).status_code==401
    assert client.get('/clinic/workspace',headers=first).status_code==403
    cap=client.get('/patient/capabilities',headers=first).json()
    body={'title':'Mobile patient case','region':'Istanbul','consent':True,'consent_version':cap['consent_version']}
    h=first|{'Idempotency-Key':'mobile-case-create-1'}
    r=client.post('/cases',headers=h,json=body);assert r.status_code==201,r.text
    cid=r.json()['id']
    assert client.post('/cases',headers=h,json=body).json()['id']==cid
    assert client.post('/cases',headers=h,json=body|{'title':'Changed submission'}).status_code==409
    assert len(client.get('/cases',headers=first).json())==1
    assert client.get('/cases',headers=second).json()==[]
    for path in [f'/cases/{cid}/proposals',f'/cases/{cid}/xray']:
        assert client.get(path,headers=second).status_code==404
    assert client.post(f'/cases/{cid}/compare',headers=second).status_code==404
    assert client.post(f'/cases/{cid}/dispatch',headers=second,json={'clinic_ids':['clinic-1']}).status_code==404
    assert client.post(f'/cases/{cid}/xray',headers=second,files={'file':('x.png',b'\x89PNG\r\n\x1a\nTEST')}).status_code==404
    assert client.post('/cases',headers=first,json=body|{'consent_version':'old-terms'}).status_code==409
    assert client.post('/patient/register',json={'name':'Other','email':user['email'].upper(),'phone':'123456789','password':'Patient123!'}).status_code==409


def test_mobile_clinic_to_patient_booking_and_contact_scope(client):
    patient,user=register_patient(client,'journey');other,_=register_patient(client,'outsider');clinic=signin(client);admin=admin_signin(client)
    cid=client.post('/cases',headers=patient,json={'title':'Mobile journey','consent':True}).json()['id']
    assert client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('synthetic.png',b'\x89PNG\r\n\x1a\nTEST')}).status_code==201
    assert client.post(f'/cases/{cid}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']}).status_code==200
    detail=client.get(f'/clinic/cases/{cid}',headers=clinic).json()
    assert user['email'] not in str(detail) and user['phone'] not in str(detail)
    p=client.post(f'/clinic/cases/{cid}/publish',headers=clinic|{'Idempotency-Key':'mobile-journey-proposal'},json={'plan':plan()}).json()
    run_once()
    assert client.get('/proposals/'+p['id'],headers=patient).json()['explanation_status']=='ready'
    assert client.get('/proposals/'+p['id'],headers=other).status_code==404
    assert client.post('/appointments',headers=other,json={'proposal_id':p['id']}).status_code==404
    a=client.post('/appointments',headers=patient,json={'proposal_id':p['id'],'kind':'appointment'}).json()
    assert client.post('/appointments',headers=patient,json={'proposal_id':p['id'],'kind':'appointment'}).json()['id']==a['id']
    from datetime import datetime,timedelta,timezone
    slot=(datetime.now(timezone.utc)+timedelta(days=3)).isoformat()
    staff=client.patch('/operations/appointments/'+a['id'],headers=clinic,json={'status':'confirmed','scheduled_at':slot,'notes':'Private staff coordination'}).json()
    assert staff['patient_phone']==user['phone']
    mine=client.get('/patient/appointments',headers=patient).json()
    assert mine[0]['scheduled_at']==slot and mine[0]['status']=='confirmed'
    assert 'notes' not in mine[0] and 'Private staff coordination' not in str(mine)
    assert client.get('/patient/appointments',headers=other).json()==[]
    assert client.post('/patient/appointments/'+a['id']+'/cancel',headers=other).status_code==404
    assert client.post('/patient/appointments/'+a['id']+'/cancel',headers=patient).status_code==200
    assert client.get('/patient/appointments',headers=patient).json()[0]['status']=='cancelled'
    client.patch('/admin/proposals/'+p['id']+'/review',headers=admin,json={'moderation':'flagged','review_notes':'Mobile stale screen'})
    assert client.get('/proposals/'+p['id'],headers=patient).status_code==404
    assert client.post('/appointments',headers=patient,json={'proposal_id':p['id']}).status_code==409
    assert client.post(f'/cases/{cid}/compare',headers=patient).json()['proposals']==[]


def test_mobile_eligibility_and_password_revocation(client):
    patient,user=register_patient(client,'password');admin=admin_signin(client)
    assert client.put('/patient/me',headers=patient,json={'name':'Updated Patient','email':user['email'],'phone':'+90 555 999 1111'}).status_code==200
    client.patch('/admin/clinics/clinic-1/review',headers=admin,json={'status':'suspended','review_notes':'Mobile eligibility test'})
    try:
        assert 'clinic-1' not in [x['id'] for x in client.get('/patient/clinics',headers=patient).json()]
    finally:client.patch('/admin/clinics/clinic-1/review',headers=admin,json={'status':'active','review_notes':'Restored'})
    assert client.put('/patient/password',headers=patient,json={'current_password':'wrong','new_password':'Changed123!'}).status_code==400
    assert client.put('/patient/password',headers=patient,json={'current_password':'Patient123!','new_password':'Changed123!'}).status_code==200
    assert client.get('/patient/me',headers=patient).status_code==401
    assert client.post('/patient/login',json={'email':user['email'],'password':'Patient123!'}).status_code==401
    login=client.post('/patient/login',json={'email':user['email'],'password':'Changed123!'})
    assert login.status_code==200 and login.json()['user']['name']=='Updated Patient'
