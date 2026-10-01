from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

PROCEDURES = {
    'ROOT_CANAL': ('Kanal tedavisi', 'Klinik, belirtilen dişin kök kanallarına yönelik tedavi öneriyor.'),
    'ROOT_CANAL_SINGLE': ('Kanal tedavisi — 1 kanallı', 'Klinik, belirtilen dişin tek kanalına yönelik kanal tedavisi öneriyor.'),
    'ROOT_CANAL_DOUBLE': ('Kanal tedavisi — 2 kanallı', 'Klinik, belirtilen dişin iki kanalına yönelik kanal tedavisi öneriyor.'),
    'ROOT_CANAL_MULTI': ('Kanal tedavisi — çok kanallı', 'Klinik, belirtilen dişin birden çok kanalına yönelik kanal tedavisi öneriyor.'),
    'EXTRACTION': ('Diş çekimi', 'Klinik, belirtilen dişin çekilmesini öneriyor.'),
    'IMPLANT': ('Diş implantı', 'Klinik, diş implantı yerleştirilmesini öneriyor. Hangi parçaların fiyata dahil olduğunu kliniğe sorun.'),
    'CROWN': ('Diş kaplaması', 'Klinik, belirtilen dişin üzerine kaplama yapılmasını öneriyor.'),
    'FILLING': ('Diş dolgusu', 'Klinik, belirtilen dişin bir bölümünün dolgu ile onarılmasını öneriyor.'),
    'CLEANING': ('Diş temizliği', 'Klinik, profesyonel diş temizliği öneriyor.'),
}

class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
class CaseInput(StrictModel):
    title: str = Field(min_length=3, max_length=80)
    region: Literal['Istanbul', 'Ankara', 'Izmir', 'All regions'] = 'All regions'
    consent: Literal[True]
    consent_version: str | None = Field(default=None, max_length=80)
class DispatchInput(StrictModel):
    clinic_ids: list[str] = Field(min_length=1, max_length=10)
class ItemInput(StrictModel):
    tooth: str = Field(pattern=r'^([1-4][1-8]|[5-8][1-5]|ALL)$')
    procedure_code: Literal['ROOT_CANAL','ROOT_CANAL_SINGLE','ROOT_CANAL_DOUBLE','ROOT_CANAL_MULTI','EXTRACTION','IMPLANT','CROWN','FILLING','CLEANING']
    urgency: Literal['urgent','soon','routine'] = 'routine'
    material: str | None = Field(default=None, max_length=80)
    price_minor: int = Field(ge=0, le=100000000, strict=True)
    sessions: int = Field(ge=1, le=30, strict=True)
class ProposalInput(StrictModel):
    items: list[ItemInput] = Field(min_length=1, max_length=32)
    sessions: int = Field(ge=1, le=60, strict=True)
    requires_exam: bool = True
    first_available_slot: datetime | None = None
    notes: str = Field(default='', max_length=1000)
    currency: Literal['TRY','USD','EUR'] = 'TRY'
    @field_validator('first_available_slot')
    @classmethod
    def aware_slot(cls, v):
        if v and v.tzinfo is None: raise ValueError('Randevu saatinde saat dilimini belirtin')
        return v
class AppointmentInput(StrictModel):
    proposal_id: str
    kind: Literal['callback', 'appointment'] = 'callback'

# Response models keep the exported mobile/API contract explicit.
class ClinicOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    region: str
    district: str
    address: str

class AssetOutput(BaseModel):
    name: str
    type: str

class CaseOutput(BaseModel):
    id: str
    title: str
    region: str
    status: str
    recipients: list[str]
    created_at: datetime
    asset: AssetOutput | None

class ProcedureExplanation(BaseModel):
    source_item_id: str
    simple_explanation: str

class ExplanationOutput(BaseModel):
    plain_summary: str
    procedures: list[ProcedureExplanation]
    missing_information: list[str]
    questions_to_ask_clinic: list[str]
    disclaimer: str
    mode: Literal['template','ai','template_fallback']
    glossary_status: Literal['draft_requires_dentist_review','dentist_review_recorded']

class ProposalOutput(BaseModel):
    id: str
    case_id: str
    clinic_id: str
    clinic_name: str
    district: str
    plan: ProposalInput
    total_minor: int
    version: int
    created_at: datetime
    explanation: ExplanationOutput | None
    explanation_status: Literal['ready', 'pending', 'failed', 'paused']

class ComparisonOutput(BaseModel):
    case_id: str
    currency: Literal['TRY','USD','EUR'] | None
    proposals: list[ProposalOutput]
    notice: str

class AppointmentOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    proposal_id: str
    user_id: str
    clinic_id: str
    kind: Literal['callback', 'appointment']
    status: Literal['requested','contacted','confirmed','completed','cancelled']
    created_at: datetime

class AuditOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    actor: str
    action: str
    entity: str
    created_at: datetime
