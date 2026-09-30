"""Leased transactional mail outbox. Resend retries reuse identical payload/key."""
from datetime import timedelta
from uuid import uuid4
from sqlalchemy import select, update, or_, and_
from .db import Session, now
from .auth import token_hash
from .mail_models import PasswordReset, MailJob
from .mail_gateway import mail_config, reset_token, send_mail
from .operations_models import Account
from .password_recovery import eligible, utc

def due():
    return or_(and_(MailJob.status=='pending', MailJob.next_attempt_at<=now()),
               and_(MailJob.status=='sending', MailJob.lease_until<=now()))

def run_mail_once():
    try: config=mail_config()
    except (ValueError,OSError): return 0
    if config.provider=='disabled': return 0
    delivered=0
    with Session() as db:
        ids=db.scalars(select(MailJob.id).where(due()).order_by(MailJob.created_at).limit(20)).all()
    for jid in ids:
        owner=str(uuid4())
        with Session() as db:
            claimed=db.execute(update(MailJob).where(MailJob.id==jid,due()).values(status='sending',claim=owner,lease_until=now()+timedelta(seconds=60),attempts=MailJob.attempts+1)).rowcount
            db.commit()
            if not claimed: continue
            job=db.get(MailJob,jid); account=db.get(Account,job.account_id)
            status='cancelled'; error=''; provider_id=None
            if job.attempts>5:
                status='failed'; error='retry_exhausted'
            elif eligible(db,account) and account.email==job.email:
                body=None
                if job.kind=='password_reset':
                    reset=db.get(PasswordReset,job.reset_id)
                    if (reset and not reset.consumed and utc(reset.expires_at)>now()
                        and reset.email==account.email and reset.password_fingerprint==token_hash(account.password_hash)
                        and reset.token_hash==token_hash(reset_token(reset.id,config.secret))):
                        link=config.reset_url+'#token='+reset_token(reset.id,config.secret)
                        subject='DENTRIVO — reset your password'
                        body=f'Reset your DENTRIVO password using this link:\n\n{link}\n\nThis link expires at {utc(reset.expires_at).isoformat()} and can be used once.\nIf you did not request this, ignore this email.\nYou can also copy the token after #token= into the DENTRIVO app’s reset screen.'
                elif job.kind=='password_changed':
                    subject='DENTRIVO — your password was changed'
                    body='Your DENTRIVO password was changed. All existing sessions were signed out.\nIf you did not make this change, request a new password reset or contact support.'
                if body:
                    try:
                        provider_id=send_mail(config,jid,job.email,subject,body)
                        status='sent'; delivered+=1
                    except Exception:
                        status='failed' if job.attempts>=5 else 'pending'; error='delivery_failed'
            db.execute(update(MailJob).where(MailJob.id==jid,MailJob.claim==owner).values(status=status,error=error,provider_id=provider_id,claim=None,lease_until=None,next_attempt_at=now()+timedelta(seconds=min(90,5*2**job.attempts))))
            db.commit()
    return delivered
