import json
from email import policy
from email.parser import BytesParser
from datetime import timedelta
from uuid import uuid4
from concurrent.futures import ThreadPoolExecutor
import pytest
from sqlalchemy import select, delete
from test_marketplace import client, admin_signin
from dentpro.db import Session, now
from dentpro.auth import token_hash
from dentpro.operations_models import Account
from dentpro.mail_models import PasswordReset, RecoveryThrottle, MailJob
from dentpro.mail_gateway import mail_config, reset_token, send_mail
from dentpro.mail_worker import run_mail_once

@pytest.fixture(autouse=True)
def recovery_config(client, monkeypatch, tmp_path):
    monkeypatch.setenv('DENTPRO_MAIL_PROVIDER','file')
    monkeypatch.setenv('DENTPRO_MAIL_FROM','no-reply@dentpro.example')
    monkeypatch.setenv('DENTPRO_RESET_URL','http://127.0.0.1:3000/reset-password')
    monkeypatch.setenv('DENTPRO_RESET_SECRET','synthetic-reset-secret-at-least-32-chars')
    monkeypatch.delenv('DENTPRO_RESET_SECRET_FILE',raising=False)
    monkeypatch.setenv('DENTPRO_MAILBOX_DIR',str(tmp_path))
    with Session() as db:
        for model in (MailJob,PasswordReset,RecoveryThrottle): db.execute(delete(model))
        db.commit()

def account(client, role='patient'):
    email=f'recovery-{uuid4().hex}@example.org'; password='InitialQA123!'
    if role=='patient':
        r=client.post('/patient/register',json={'name':'Synthetic recovery QA','email':email,'phone':'5551234567','password':password})
        assert r.status_code==201,r.text
        return email,r.json()['token']
    r=client.post('/operations/accounts',headers=admin_signin(client),json={'name':'Recovery QA staff','email':email,'password':password,'role':role,'clinic_id':'clinic-1' if role=='clinic' else None})
    assert r.status_code==201,r.text
    login=client.post('/auth/login',json={'email':email,'password':password})
    return email,login.json()['token']

def link_token(client,email):
    response=client.post('/auth/password/forgot',json={'email':email.upper()})
    assert response.status_code==202,response.text
    with Session() as db:
        reset=db.scalar(select(PasswordReset).where(PasswordReset.email==email,PasswordReset.consumed==False))
        return reset_token(reset.id,mail_config().secret),reset.id

@pytest.mark.parametrize('role',['patient','clinic','admin'])
def test_recovery_single_use_session_revocation_and_notification(client,role,tmp_path):
    email,session=account(client,role)
    token,rid=link_token(client,email)
    assert run_mail_once()==1
    messages=list(tmp_path.glob('*.eml'))
    assert len(messages)==1 and '#token='+token in BytesParser(policy=policy.default).parsebytes(messages[0].read_bytes()).get_content()
    with Session() as db:
        record=db.get(PasswordReset,rid)
        assert record.token_hash==token_hash(token)
        assert token not in json.dumps(record.__dict__,default=str)
    endpoint='/patient/me' if role=='patient' else '/auth/me'
    assert client.get(endpoint,headers={'Authorization':'Bearer '+session}).status_code==200
    body={'token':token,'new_password':'NewRecoveryQA123!'}
    response=client.post('/auth/password/reset',json=body)
    assert response.status_code==200 and response.headers['cache-control']=='no-store'
    assert client.post('/auth/password/reset',json=body).status_code==400
    assert client.get(endpoint,headers={'Authorization':'Bearer '+session}).status_code==401
    login='/patient/login' if role=='patient' else '/auth/login'
    assert client.post(login,json={'email':email,'password':'InitialQA123!'}).status_code==401
    assert client.post(login,json={'email':email,'password':body['new_password']}).status_code==200
    assert run_mail_once()==1
    parsed=[BytesParser(policy=policy.default).parsebytes(p.read_bytes()) for p in tmp_path.glob('*.eml')]
    notification=next(m.get_content() for m in parsed if 'your password was changed' in str(m['Subject']))
    assert body['new_password'] not in notification and token not in notification

def test_unknown_disabled_and_rate_limited_accounts_have_same_response(client):
    email,_=account(client)
    known=client.post('/auth/password/forgot',json={'email':email})
    unknown=client.post('/auth/password/forgot',json={'email':'absent@example.org'})
    assert known.status_code==unknown.status_code==202 and known.json()==unknown.json()
    for _ in range(4): assert client.post('/auth/password/forgot',json={'email':email}).json()==known.json()
    with Session() as db:
        assert db.query(PasswordReset).count()==3
        assert all(email not in r.key for r in db.query(RecoveryThrottle).all())
        a=db.scalar(select(Account).where(Account.email==email));a.active=False;db.commit()
    assert run_mail_once()==0
    disabled=client.post('/auth/password/forgot',json={'email':email})
    assert disabled.json()==unknown.json()

def test_new_request_expiry_password_and_email_changes_invalidate_links(client):
    email,_=account(client)
    old,_=link_token(client,email);new,rid=link_token(client,email)
    assert client.post('/auth/password/reset',json={'token':old,'new_password':'NewRecoveryQA123!'}).status_code==400
    with Session() as db:
        db.get(PasswordReset,rid).expires_at=now()-timedelta(seconds=1);db.commit()
    assert client.post('/auth/password/reset',json={'token':new,'new_password':'NewRecoveryQA123!'}).status_code==400
    new,rid=link_token(client,email)
    with Session() as db:
        a=db.scalar(select(Account).where(Account.email==email));a.email='changed-'+email;db.commit()
    assert client.post('/auth/password/reset',json={'token':new,'new_password':'NewRecoveryQA123!'}).status_code==400
    assert run_mail_once()==0

def test_concurrent_reset_consumes_once(client):
    email,_=account(client);token,_=link_token(client,email)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:client.post('/auth/password/reset',json={'token':token,'new_password':'RaceRecoveryQA123!'}).status_code,range(2)))
    assert sorted(results)==[200,400]

@pytest.mark.parametrize('change',['password','deactivation','secret_rotation'])
def test_account_and_secret_changes_revoke_pending_tokens(client,monkeypatch,change):
    from dentpro.auth import password_hash
    email,_=account(client);token,_=link_token(client,email)
    if change=='secret_rotation': monkeypatch.setenv('DENTPRO_RESET_SECRET','rotated-synthetic-secret-at-least-32-chars')
    else:
        with Session() as db:
            a=db.scalar(select(Account).where(Account.email==email))
            if change=='password': a.password_hash=password_hash('DifferentNewQA123!')
            else: a.active=False
            db.commit()
    assert client.post('/auth/password/reset',json={'token':token,'new_password':'RecoveryQA123!'}).status_code==400
    assert run_mail_once()==0

def test_concurrent_workers_claim_one_message(client,tmp_path):
    email,_=account(client);link_token(client,email)
    with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(lambda _:run_mail_once(),range(2)))
    assert sum(results)==1 and len(list(tmp_path.glob('*.eml')))==1

def test_worker_retry_bounded_and_error_redacted(client,monkeypatch):
    from dentpro import mail_worker
    email,_=account(client);token,_=link_token(client,email)
    def failure(*args): raise RuntimeError('private-provider-error-'+token)
    monkeypatch.setattr(mail_worker,'send_mail',failure)
    for attempt in range(1,6):
        assert run_mail_once()==0
        with Session() as db:
            job=db.scalar(select(MailJob)); assert job.attempts==attempt and job.error=='delivery_failed'
            assert token not in job.error
            job.next_attempt_at=now()-timedelta(seconds=1);db.commit()
    with Session() as db: assert db.scalar(select(MailJob)).status=='failed'
    assert run_mail_once()==0

def test_worker_reclaims_expired_lease_and_reuses_provider_key(client,monkeypatch):
    from dentpro import mail_gateway
    email,_=account(client);token,_=link_token(client,email)
    with Session() as db:
        job=db.scalar(select(MailJob));job.status='sending';job.lease_until=now()-timedelta(seconds=1);job.claim='crashed-worker';db.commit()
    calls=[]
    class Fake:
        def raise_for_status(self): pass
        def json(self): return {'id':'synthetic-provider-id'}
    monkeypatch.setattr(mail_gateway.httpx,'post',lambda url,**kwargs:(calls.append((url,kwargs)) or Fake()))
    monkeypatch.setenv('DENTPRO_MAIL_PROVIDER','resend');monkeypatch.setenv('RESEND_API_KEY','synthetic-key')
    monkeypatch.delenv('RESEND_API_KEY_FILE',raising=False)
    assert run_mail_once()==1
    with Session() as db:
        job=db.scalar(select(MailJob));assert job.status=='sent' and job.claim is None
        send_mail(mail_config(),job.id,email,calls[0][1]['json']['subject'],calls[0][1]['json']['text'])
    assert calls[0]==calls[1]
    assert calls[0][0]=='https://api.resend.com/emails'
    assert calls[0][1]['json']['to']==[email]
    assert '#token='+token in calls[0][1]['json']['text']

def test_recovery_configuration_and_limits_fail_closed(client,monkeypatch):
    monkeypatch.setenv('DENTPRO_MAIL_PROVIDER','disabled')
    assert client.post('/auth/password/forgot',json={'email':'absent@example.org'}).status_code==503
    monkeypatch.setenv('DENTPRO_MAIL_PROVIDER','file')
    with Session() as db:
        db.add(RecoveryThrottle(key=token_hash('forgot-ip:testclient'),attempts=30));db.commit()
    r=client.post('/auth/password/forgot',json={'email':'absent@example.org'})
    assert r.status_code==429 and r.headers['retry-after']=='900'
    assert client.get('/admin/mail/status').status_code in (401,403)
    assert client.get('/admin/mail/status',headers=admin_signin(client)).json()['configured'] is True
    from dentpro import mail_gateway
    monkeypatch.setattr(mail_gateway,'cloud_mode',lambda:True)
    with pytest.raises(ValueError): mail_config()
    monkeypatch.setenv('DENTPRO_MAIL_PROVIDER','resend');monkeypatch.setenv('RESEND_API_KEY','synthetic-key')
    with pytest.raises(ValueError): mail_config()
    monkeypatch.setenv('DENTPRO_RESET_URL','https://portal.example/reset-password')
    assert mail_config().provider=='resend'
    monkeypatch.setenv('DENTPRO_RESET_URL','https://portal.example/reset-password?redirect=evil')
    with pytest.raises(ValueError): mail_config()
