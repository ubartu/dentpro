"""Explicit additive migration from cloud v2 to v3. Back up before running."""
from .db import engine, Session
from .operations_models import PlatformSetting
from .mail_models import PasswordReset, RecoveryThrottle, MailJob
from .cloud_schema import SCHEMA_KEY
from .runtime import cloud_mode

def migrate():
    with Session() as db:
        marker=db.get(PlatformSetting,SCHEMA_KEY)
        if not marker or marker.value.get('version')!=2:
            raise RuntimeError('Expected cloud schema version 2; no changes applied')
        for model in (PasswordReset,RecoveryThrottle,MailJob): model.__table__.create(engine,checkfirst=True)
        marker.value={'version':3};db.commit()

if __name__=='__main__':
    if not cloud_mode(): raise RuntimeError('This migration is for cloud mode only')
    migrate()
    print('Cloud schema updated to version 3.')
