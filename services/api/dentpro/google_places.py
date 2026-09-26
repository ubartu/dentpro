"""On-demand Places API (New) adapter. Provider content is never persisted/cached."""
import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse, quote
import httpx
from pydantic import BaseModel, Field

FIELD_MASK = 'rating,userRatingCount,photos,websiteUri,googleMapsUri,attributions'
BASE_URL = 'https://places.googleapis.com/v1/'

class PhotoAuthor(BaseModel):
    name: str
    profile_url: str | None = None
    avatar_url: str | None = None

class ProviderAttribution(BaseModel):
    name: str
    uri: str | None = None

class PlacePhoto(BaseModel):
    uri: str
    google_maps_url: str | None = None
    authors: list[PhotoAuthor] = Field(default_factory=list)

class GooglePlaceProfile(BaseModel):
    status: Literal['ready', 'disabled', 'not_linked', 'unavailable']
    rating: float | None = Field(default=None, ge=1, le=5)
    review_count: int | None = Field(default=None, ge=0)
    google_maps_url: str | None = None
    website_url: str | None = None
    photo: PlacePhoto | None = None
    attributions: list[ProviderAttribution] = Field(default_factory=list)

def api_key() -> str | None:
    if os.getenv('DENTPRO_GOOGLE_PLACES_ENABLED', 'false').lower() != 'true':
        return None
    path = os.getenv('GOOGLE_PLACES_API_KEY_FILE')
    if path:
        return Path(path).read_text().strip() or None
    return os.getenv('GOOGLE_PLACES_API_KEY') or None

def integration_status() -> dict:
    try: configured = bool(api_key())
    except OSError: configured = False
    return {'configured': configured, 'provider': 'google_places_new', 'on_demand': True}

def safe_url(value) -> str | None:
    if not isinstance(value, str): return None
    parsed = urlparse(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        return None
    return value

def fetch_profile(place_id: str, key: str) -> GooglePlaceProfile:
    headers = {'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK}
    with httpx.Client(timeout=6.0, follow_redirects=False) as client:
        response = client.get(BASE_URL+'places/'+quote(place_id, safe=''), headers=headers,
                              params={'languageCode': 'tr'})
        response.raise_for_status()
        body = response.json()
        result = GooglePlaceProfile(
            status='ready', rating=body.get('rating'), review_count=body.get('userRatingCount'),
            google_maps_url=safe_url(body.get('googleMapsUri')), website_url=safe_url(body.get('websiteUri')),
            attributions=[ProviderAttribution(name=str(a.get('provider', '')), uri=safe_url(a.get('providerUri')))
                          for a in body.get('attributions', [])],
        )
        photos = body.get('photos') or []
        if photos:
            photo = photos[0]
            name = photo.get('name', '')
            if isinstance(name, str) and name.startswith(f'places/{place_id}/photos/'):
                try:
                    media = client.get(BASE_URL+quote(name, safe='/')+'/media',
                                       headers={'X-Goog-Api-Key': key},
                                       params={'maxWidthPx': 640, 'maxHeightPx': 360, 'skipHttpRedirect': 'true'})
                    media.raise_for_status()
                    uri = safe_url(media.json().get('photoUri'))
                    host = urlparse(uri).hostname if uri else ''
                    source_uri = safe_url(photo.get('googleMapsUri'))
                    if uri and source_uri and (host.endswith('.googleusercontent.com') or host.endswith('.ggpht.com')):
                        result.photo = PlacePhoto(
                            uri=uri, google_maps_url=source_uri,
                            authors=[PhotoAuthor(name=str(a.get('displayName', '')), profile_url=safe_url(a.get('uri')),
                                                 avatar_url=safe_url(a.get('photoUri')))
                                     for a in photo.get('authorAttributions', [])],
                        )
                except (httpx.HTTPError, ValueError, TypeError):
                    # A failed photo must not hide the rating or prevent clinic selection.
                    pass
        return result
