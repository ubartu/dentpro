"""Add discovery-owned tables to a backed-up cloud schema v1; no Google data migration."""
from .db import engine, Session
from .operations_models import PlatformSetting, ClinicDiscoveryProfile, PlacesLookupWindow
from .cloud_schema import SCHEMA_KEY
from .runtime import cloud_mode

def main():
    if not cloud_mode(): raise RuntimeError('This migration is for cloud mode only')
    with Session() as db:
        marker=db.get(PlatformSetting,SCHEMA_KEY)
        if not marker or marker.value.get('version')!=1:
            raise RuntimeError('Expected cloud schema version 1; no changes applied')
        for table in (ClinicDiscoveryProfile.__table__,PlacesLookupWindow.__table__):
            table.create(engine,checkfirst=True)
        marker.value={'version':2};db.commit()
    print('Cloud schema updated to version 2.')

if __name__=='__main__':main()
