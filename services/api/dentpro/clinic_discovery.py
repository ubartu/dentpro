"""Verified clinic links, Place ID mapping and bounded live Google lookups."""
import hashlib
from datetime import timedelta, timezone
from typing import Literal
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field, field_validator
from sqlalchemy import text
from .auth import require
from .contracts import StrictModel
from .db import get_db, Clinic, audit, now
from .operations_models import ClinicDiscoveryProfile, ClinicProfile, PlacesLookupWindow
from .google_places import GooglePlaceProfile, api_key, fetch_profile, integration_status

router = APIRouter(tags=['clinic-discovery'])
SOCIAL_HOSTS = {
    'instagram': {'instagram.com', 'www.instagram.com'},
    'facebook': {'facebook.com', 'www.facebook.com'},
    'youtube': {'youtube.com', 'www.youtube.com'},
    'linkedin': {'linkedin.com', 'www.linkedin.com'},
    'x': {'x.com', 'www.x.com'},
    'tiktok': {'tiktok.com', 'www.tiktok.com'},
}

class SocialLink(StrictModel):
    platform: Literal['instagram','facebook','youtube','linkedin','x','tiktok']
    url: str = Field(max_length=500)
    @field_validator('url')
    @classmethod
    def https_link(cls, value, info):
        parsed = urlparse(value)
        platform = info.data.get('platform')
        if (parsed.scheme != 'https' or parsed.hostname not in SOCIAL_HOSTS.get(platform, set())
                or parsed.username or parsed.password or parsed.port not in (None,443)
                or not parsed.path.strip('/') or parsed.query or parsed.fragment):
            raise ValueError('Use the HTTPS profile URL for the selected social platform')
        return value

class SocialLinksInput(StrictModel):
    social_links: list[SocialLink] = Field(default_factory=list, max_length=6)
    @field_validator('social_links')
    @classmethod
    def unique_platforms(cls, links):
        if len({link.platform for link in links}) != len(links):
            raise ValueError('Her sosyal platform için en fazla bir profil ekleyin')
        return links

class DiscoveryInput(SocialLinksInput):
    google_place_id: str | None = Field(default=None, pattern=r'^[A-Za-z0-9_-]{10,255}$')

def discovery_view(db, clinic_id):
    row = db.get(ClinicDiscoveryProfile, clinic_id)
    return {'google_place_id': row.google_place_id if row else None,
            'social_links': row.social_links if row else []}

def save_discovery(db, clinic_id, data):
    row = db.get(ClinicDiscoveryProfile, clinic_id)
    if not row:
        row = ClinicDiscoveryProfile(clinic_id=clinic_id); db.add(row)
    row.social_links = [link.model_dump() for link in data.social_links]
    if isinstance(data, DiscoveryInput): row.google_place_id = data.google_place_id

@router.put('/admin/clinics/{clinic_id}/discovery')
def update_discovery(clinic_id: str, data: DiscoveryInput, user=Depends(require('admin')), db=Depends(get_db)):
    if not db.get(Clinic, clinic_id): raise HTTPException(404,'Klinik bulunamadı')
    save_discovery(db, clinic_id, data)
    audit(db,user['id'],'clinic.discovery_updated',clinic_id); db.commit()
    return discovery_view(db, clinic_id)

@router.put('/clinic/discovery')
def update_socials(data: SocialLinksInput, user=Depends(require('clinic')), db=Depends(get_db)):
    save_discovery(db,user['clinic_id'],data)
    audit(db,user['id'],'clinic.social_links_updated',user['clinic_id']); db.commit()
    return discovery_view(db,user['clinic_id'])

@router.get('/admin/integrations/google-places')
def gateway_status(user=Depends(require('admin'))): return integration_status()

def consume_lookup(db, account_id):
    if db.bind.dialect.name == 'postgresql':
        lock = int.from_bytes(hashlib.sha256(('places:'+account_id).encode()).digest()[:8],'big',signed=True)
        db.execute(text('SELECT pg_advisory_xact_lock(:lock)'),{'lock':lock})
    row = db.get(PlacesLookupWindow,account_id)
    if not row:
        row = PlacesLookupWindow(account_id=account_id,requests=0,started_at=now()); db.add(row)
    if now()-row.started_at.replace(tzinfo=timezone.utc) >= timedelta(minutes=15):
        row.requests=0; row.started_at=now()
    if row.requests >= 30:
        db.rollback()
        raise HTTPException(429,'Google profil sorgulama sınırına ulaşıldı. Daha sonra yeniden deneyin.',headers={'Retry-After':'900'})
    row.requests+=1; db.commit()

def live_profile(db, clinic_id, user):
    row = db.get(ClinicDiscoveryProfile,clinic_id)
    if not row or not row.google_place_id: return GooglePlaceProfile(status='not_linked')
    try: key = api_key()
    except OSError: key = None
    if not key: return GooglePlaceProfile(status='disabled')
    consume_lookup(db,user['id'])
    try: return fetch_profile(row.google_place_id,key)
    except Exception:
        # Never include key-bearing provider errors or persist Google response content.
        return GooglePlaceProfile(status='unavailable')

@router.get('/patient/clinics/{clinic_id}/google-profile',response_model=GooglePlaceProfile)
def patient_google_profile(clinic_id: str, response: Response, user=Depends(require('patient')), db=Depends(get_db)):
    profile=db.get(ClinicProfile,clinic_id)
    if not profile or profile.status!='active':raise HTTPException(404,'Klinik kullanılamıyor')
    response.headers['Cache-Control']='no-store'
    return live_profile(db,clinic_id,user)

@router.get('/admin/clinics/{clinic_id}/google-profile',response_model=GooglePlaceProfile)
def admin_google_profile(clinic_id: str, response: Response, user=Depends(require('admin')), db=Depends(get_db)):
    if not db.get(Clinic,clinic_id):raise HTTPException(404,'Klinik bulunamadı')
    response.headers['Cache-Control']='no-store'
    return live_profile(db,clinic_id,user)
