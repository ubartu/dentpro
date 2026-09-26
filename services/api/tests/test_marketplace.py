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
from dentpro.db import Session, Explanation, Proposal, Case, Audit, XrayAsset
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

def test_cloud_asset_path_keeps_bounded_xray_in_database(client,monkeypatch):
    import dentpro.main as main
    patient=auth(client,'patient')
    cid=client.post('/cases',headers=patient,json={'title':'Synthetic cloud asset','consent':True}).json()['id']
    image=b'\x89PNG\r\n\x1a\nCLOUD-SYNTHETIC'
    monkeypatch.setattr(main,'cloud_mode',lambda:True)
    uploaded=client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('synthetic.png',image,'image/png')})
    assert uploaded.status_code==201
    with Session() as db: assert db.get(XrayAsset,cid).data==image
    downloaded=client.get(f'/cases/{cid}/xray',headers=patient)
    assert downloaded.status_code==200 and downloaded.content==image
    assert downloaded.headers['cache-control']=='no-store'

def test_clinic_discovery_mapping_social_validation_and_scoping(client,monkeypatch):
    admin=admin_signin(client);clinic=signin(client);patient=auth(client,'patient')
    endpoint='/admin/clinics/clinic-1/discovery'
    body={'google_place_id':'ChIJSyntheticPlace123','social_links':[{'platform':'instagram','url':'https://www.instagram.com/synthetic_clinic/'}]}
    assert client.put(endpoint,headers=patient,json=body).status_code==403
    assert client.put(endpoint,headers=clinic,json=body).status_code==403
    assert client.put(endpoint,headers=admin,json=body).status_code==200
    for url in ['http://instagram.com/profile','https://evil.example/profile','https://instagram.com@evil.example/profile']:
        bad=body|{'social_links':[{'platform':'instagram','url':url}]}
        assert client.put(endpoint,headers=admin,json=bad).status_code==422
    assert client.put('/clinic/discovery',headers=clinic,json=body).status_code==422
    links={'social_links':[{'platform':'youtube','url':'https://www.youtube.com/@synthetic_clinic'}]}
    assert client.put('/clinic/discovery',headers=clinic,json=links).status_code==200
    workspace=client.get('/clinic/workspace',headers=clinic).json()['clinic']
    assert workspace['google_place_id']==body['google_place_id'] and workspace['social_links']==links['social_links']
    directory=client.get('/patient/clinics',headers=patient).json()
    row=next(c for c in directory if c['id']=='clinic-1')
    assert row['google_linked'] and row['social_links']==links['social_links']
    assert 'google_place_id' not in row
    monkeypatch.setenv('DENTPRO_GOOGLE_PLACES_ENABLED','false')
    response=client.get('/patient/clinics/clinic-1/google-profile',headers=patient)
    assert response.json()['status']=='disabled' and response.headers['cache-control']=='no-store'
    assert client.get('/admin/integrations/google-places',headers=patient).status_code==403
    assert client.get('/admin/integrations/google-places',headers=admin).json()['configured'] is False

def test_google_gateway_field_mask_photo_attribution_and_no_key_in_result(monkeypatch):
    from dentpro import google_places
    seen=[]
    class Response:
        def __init__(self,body):self.body=body
        def raise_for_status(self):pass
        def json(self):return self.body
    class Client:
        def __init__(self,**kwargs):assert kwargs['follow_redirects'] is False
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def get(self,url,**kwargs):
            seen.append((url,kwargs))
            if url.endswith('/media'):
                return Response({'photoUri':'https://lh3.googleusercontent.com/synthetic-photo'})
            return Response({'rating':4.7,'userRatingCount':120,'googleMapsUri':'https://maps.google.com/synthetic-place',
                'websiteUri':'https://clinic.example.org','attributions':[{'provider':'Provider','providerUri':'https://provider.example.org'}],
                'photos':[{'name':'places/ChIJSyntheticPlace123/photos/synthetic-photo-name','googleMapsUri':'https://maps.google.com/synthetic-photo',
                           'authorAttributions':[{'displayName':'Synthetic Photographer','uri':'https://maps.google.com/synthetic-author','photoUri':'https://lh3.googleusercontent.com/synthetic-avatar'}]}]})
    monkeypatch.setattr(google_places.httpx,'Client',Client)
    profile=google_places.fetch_profile('ChIJSyntheticPlace123','secret-test-key')
    assert profile.rating==4.7 and profile.photo.authors[0].name=='Synthetic Photographer'
    assert len(seen)==2 and seen[0][1]['headers']['X-Goog-FieldMask']==google_places.FIELD_MASK
    assert seen[1][1]['params']['skipHttpRedirect']=='true'
    assert 'secret-test-key' not in profile.model_dump_json() and 'synthetic-photo-name' not in profile.model_dump_json()

def test_google_lookup_failure_limit_and_clinic_availability(client,monkeypatch):
    import dentpro.clinic_discovery as discovery
    patient=auth(client,'patient')
    assert client.put('/admin/clinics/clinic-1/discovery',headers=admin_signin(client),json={'google_place_id':'ChIJSyntheticPlace123','social_links':[]}).status_code==200
    monkeypatch.setenv('DENTPRO_GOOGLE_PLACES_ENABLED','true')
    monkeypatch.setenv('GOOGLE_PLACES_API_KEY','secret-test-key')
    monkeypatch.delenv('GOOGLE_PLACES_API_KEY_FILE',raising=False)
    def fail(*args):raise RuntimeError('secret-test-key provider failure')
    monkeypatch.setattr(discovery,'fetch_profile',fail)
    endpoint='/patient/clinics/clinic-1/google-profile'
    response=client.get(endpoint,headers=patient)
    assert response.json()['status']=='unavailable' and 'secret-test-key' not in response.text
    assert client.get('/patient/clinics/clinic-4/google-profile',headers=patient).status_code==404
    from dentpro.operations_models import PlacesLookupWindow
    with Session() as db:
        row=db.get(PlacesLookupWindow,'patient-demo');row.requests=30;db.commit()
    assert client.get(endpoint,headers=patient).status_code==429

def test_cloud_login_throttle_is_durable_and_hides_email(client,monkeypatch):
    from dentpro.operations_models import LoginThrottle
    admin=admin_signin(client)
    email='throttle.synthetic@example.org'
    account=client.post('/operations/accounts',headers=admin,json={
        'name':'Synthetic throttle account','email':email,'role':'clinic',
        'clinic_id':'clinic-1','password':'SyntheticStrong123!'
    })
    assert account.status_code==201
    monkeypatch.setattr('dentpro.operations.cloud_mode',lambda:True)
    for _ in range(10):
        assert client.post('/auth/login',json={'email':email,'password':'wrong'}).status_code==401
    blocked=client.post('/auth/login',json={'email':email,'password':'SyntheticStrong123!'})
    assert blocked.status_code==429 and blocked.headers['retry-after']=='900'
    with Session() as db:
        row=db.get(LoginThrottle,__import__('hashlib').sha256(email.encode()).hexdigest())
        assert row and row.attempts==10 and email not in row.key
        db.delete(row);db.commit()
    assert client.post('/auth/login',json={'email':email,'password':'SyntheticStrong123!'}).status_code==200

def test_interpreter_boundary_and_hash():
    p=plan(notes='Secret patient name and phone')
    assert 'Secret' not in str(canonical_source(p))
    assert 'notes' not in canonical_source(p)
    assert cache_key(p)==cache_key(plan(notes='Different patient'))
    assert cache_key(p)!=cache_key(plan(sessions=3))

def test_openai_gateway_sends_only_structured_source(monkeypatch):
    from dentpro.ai_gateway import GatewayConfig, explain_with_openai
    seen={}
    class Response:
        def raise_for_status(self): pass
        def json(self):
            return {'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'{"plain_summary":"The clinic lists one procedure over two visits."}'}]}],'usage':{'input_tokens':42,'output_tokens':12}}
    def fake_post(url, **kwargs):
        seen['url']=url;seen.update(kwargs)
        return Response()
    monkeypatch.setenv('OPENAI_API_KEY','synthetic-test-key')
    monkeypatch.setattr('dentpro.ai_gateway.httpx.post',fake_post)
    summary,input_tokens,output_tokens=explain_with_openai(
        plan(notes='Secret patient name and phone'),
        'The clinic lists one procedure over two visits.',
        GatewayConfig(provider='openai',model='gpt-5.4-nano'),
    )
    assert summary.startswith('The clinic') and (input_tokens,output_tokens)==(42,12)
    assert seen['url']=='https://api.openai.com/v1/responses'
    assert seen['json']['store'] is False
    assert seen['json']['text']['format']['strict'] is True
    payload=str(seen['json'])
    assert 'Secret' not in payload and 'patient name' not in payload and 'xray' not in payload.lower()

def test_ai_gateway_snapshots_provider_and_falls_back(client,monkeypatch):
    from dentpro import worker
    from dentpro.operations_models import AIExplanationRequest
    admin=auth(client,'admin');patient=auth(client,'patient');clinic=auth(client,'clinic')
    monkeypatch.setenv('DENTPRO_AI_PROVIDER','openai')
    monkeypatch.setenv('OPENAI_API_KEY','synthetic-test-key')
    status=client.get('/admin/ai/gateway',headers=admin)
    assert status.status_code==200 and status.json()['configured'] is True
    assert client.get('/admin/ai/gateway',headers=patient).status_code==403
    cid=client.post('/cases',headers=patient,json={'title':'AI gateway synthetic case','consent':True}).json()['id']
    client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('synthetic.png',b'\x89PNG\r\n\x1a\nTEST','image/png')})
    client.post(f'/cases/{cid}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']})
    response=client.post(f'/clinic/cases/{cid}/proposals',headers=clinic|{'Idempotency-Key':'ai-gateway-synthetic'},json=plan())
    assert response.status_code==201,response.text
    proposal_id=response.json()['id'];key=response.json()['explanation_status']
    assert key=='pending'
    with Session() as db:
        p=db.get(Proposal,proposal_id)
        request=db.get(AIExplanationRequest,p.explanation_key)
        assert request.provider=='openai' and request.model=='gpt-5.4-nano'
    monkeypatch.setattr(worker,'explain_with_openai',lambda *_:('The clinic proposes one root canal procedure over two visits.',40,15))
    run_once()
    result=client.get(f'/proposals/{proposal_id}',headers=patient).json()
    assert result['explanation']['mode']=='ai'
    assert result['explanation']['plain_summary'].startswith('The clinic proposes')
    with Session() as db:
        record=db.get(Explanation,db.get(Proposal,proposal_id).explanation_key)
        assert record.model=='gpt-5.4-nano' and (record.input_tokens,record.output_tokens)==(40,15)
    monkeypatch.setattr(worker,'explain_with_openai',lambda *_:(_ for _ in ()).throw(TimeoutError('synthetic outage')))
    cid2=client.post('/cases',headers=patient,json={'title':'AI fallback synthetic case','consent':True}).json()['id']
    client.post(f'/cases/{cid2}/xray',headers=patient,files={'file':('synthetic.png',b'\x89PNG\r\n\x1a\nTEST','image/png')})
    client.post(f'/cases/{cid2}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']})
    response=client.post(f'/clinic/cases/{cid2}/proposals',headers=clinic|{'Idempotency-Key':'ai-fallback-synthetic'},json=plan(sessions=3))
    assert response.status_code==201,response.text
    run_once()
    fallback=client.get(f'/proposals/{response.json()["id"]}',headers=patient).json()
    assert fallback['explanation']['mode']=='template_fallback'

def test_upload_validation_and_cross_region_sharing(client):
    patient=auth(client,'patient')
    cid=client.post('/cases',headers=patient,json={'title':'Upload validation','region':'Ankara','consent':True}).json()['id']
    assert client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('evil.png',b'<html>bad</html>','image/png')}).status_code==415
    assert client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('large.png',b'\x89PNG\r\n\x1a\n'+b'0'*(10*1024*1024),'image/png')}).status_code==413
    client.post(f'/cases/{cid}/xray',headers=patient,files={'file':('a.png',b'\x89PNG\r\n\x1a\nTEST','image/png')})
    assert client.post(f'/cases/{cid}/dispatch',headers=patient,json={'clinic_ids':['clinic-1']}).status_code==200

def test_patient_directory_includes_active_clinic_locations(client):
    admin=admin_signin(client);patient=auth(client,'patient')
    body={'name':'Ankara synthetic clinic','region':'Ankara','district':'Çankaya','address':'Synthetic address','email':'ankara.clinic@example.org','latitude':39.9208,'longitude':32.8541}
    assert client.post('/admin/clinics',headers=admin,json=body|{'longitude':None}).status_code==422
    created=client.post('/admin/clinics',headers=admin,json=body)
    assert created.status_code==201,created.text
    clinic_id=created.json()['id']
    assert clinic_id not in [c['id'] for c in client.get('/patient/clinics',headers=patient).json()]
    assert client.patch(f'/admin/clinics/{clinic_id}/review',headers=admin,json={'status':'active'}).status_code==200
    listed=next(c for c in client.get('/patient/clinics',headers=patient).json() if c['id']==clinic_id)
    assert (listed['latitude'],listed['longitude'])==(39.9208,32.8541)
    assert client.post('/cases',headers=patient,json={'title':'No region choice','consent':True}).json()['region']=='All regions'
    updated=client.put(f'/admin/clinics/{clinic_id}/profile',headers=admin,json=body|{'latitude':None,'longitude':None})
    assert updated.status_code==200 and updated.json()['latitude'] is None
    listed=next(c for c in client.get('/patient/clinics',headers=patient).json() if c['id']==clinic_id)
    assert listed['latitude'] is None and listed['longitude'] is None

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
