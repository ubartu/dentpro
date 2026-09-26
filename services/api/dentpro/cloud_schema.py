"""One-time schema for a fresh cloud database; never mutate an existing schema implicitly."""

from sqlalchemy import inspect, select
from .db import Base, engine, Session, Case
from .operations_models import Account, PlatformSetting
from .operations_seed import seed_base_settings

SCHEMA_KEY = 'cloud_schema_version'
SCHEMA_VERSION = 1


def initialize_cloud_schema() -> None:
    tables = set(inspect(engine).get_table_names())
    if not tables:
        Base.metadata.create_all(engine)
        with Session() as db:
            seed_base_settings(db)
            db.add(PlatformSetting(key=SCHEMA_KEY, value={'version': SCHEMA_VERSION}))
            db.commit()
        return
    required = set(Base.metadata.tables)
    if not required.issubset(tables):
        raise RuntimeError('Cloud database schema is incomplete; apply a reviewed migration')
    with Session() as db:
        marker = db.get(PlatformSetting, SCHEMA_KEY)
        if not marker or marker.value.get('version') != SCHEMA_VERSION:
            raise RuntimeError('Cloud database schema version is missing or unsupported')
        if db.scalar(select(Account.id).where(Account.id.in_(['admin-account', 'clinic-account']))) or db.get(Case, 'case-demo'):
            raise RuntimeError('Demo accounts or cases are present in the cloud database')
