"""One-time, interactive cloud administrator bootstrap. Run in the API container."""

import getpass
from sqlalchemy import select
from .auth import password_hash
from .cloud_schema import SCHEMA_KEY, SCHEMA_VERSION
from .db import Session, audit
from .operations_models import Account, PlatformSetting
from .runtime import cloud_mode


def main() -> None:
    if not cloud_mode():
        raise RuntimeError('Administrator bootstrap is only for cloud mode')
    email = input('Administrator email: ').strip().lower()
    if not email or '@' not in email or len(email) > 150:
        raise ValueError('Enter a valid email address')
    password = getpass.getpass('New administrator password (minimum 14 characters): ')
    confirmation = getpass.getpass('Repeat password: ')
    if len(password) < 14 or password != confirmation:
        raise ValueError('Passwords must match and contain at least 14 characters')
    with Session() as db:
        marker = db.get(PlatformSetting, SCHEMA_KEY)
        if not marker or marker.value.get('version') != SCHEMA_VERSION:
            raise RuntimeError('Start the API first to initialize a fresh cloud database')
        if db.scalar(select(Account.id).where(Account.role == 'admin')):
            raise RuntimeError('An administrator already exists; use account management instead')
        if db.scalar(select(Account.id).where(Account.email == email)):
            raise RuntimeError('Email is already in use')
        account = Account(name='Platform administrator', email=email, role='admin', password_hash=password_hash(password))
        db.add(account)
        audit(db, 'system', 'admin.bootstrapped', account.id)
        db.commit()
    print('Administrator created. Sign in through the staff web portal.')


if __name__ == '__main__':
    main()
