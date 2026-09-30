"""Server-side, source-only gateway for optional proposal explanations.

The mobile app never calls a model provider. Only the canonical clinic-authored
plan and the existing template summary cross this boundary; no X-ray, case ID,
patient identifier, contact detail, or clinic free-text note is included.
"""

import json
import os
import re
from dataclasses import dataclass
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field

from .interpreter import canonical_source

PROMPT_VERSION = '2'
OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'


@dataclass(frozen=True)
class GatewayConfig:
    provider: str = 'template'
    model: str = 'template-v1'
    prompt_version: str = PROMPT_VERSION


class GatewayStatus(BaseModel):
    provider: Literal['template', 'openai']
    model: str
    configured: bool
    requested_provider: Literal['template', 'openai']
    prompt_version: str


def gateway_config() -> GatewayConfig:
    """Opt in server-side; absence of a key keeps the deterministic provider."""
    if os.getenv('DENTPRO_AI_PROVIDER', 'template').lower() == 'openai' and os.getenv('OPENAI_API_KEY'):
        return GatewayConfig(provider='openai', model=os.getenv('DENTPRO_AI_MODEL', 'gpt-5.4-nano'))
    return GatewayConfig()


def gateway_status() -> dict:
    config = gateway_config()
    requested = os.getenv('DENTPRO_AI_PROVIDER', 'template').lower()
    return {
        'provider': config.provider,
        'model': config.model,
        'configured': config.provider == 'openai',
        'requested_provider': requested if requested in ('template', 'openai') else 'template',
        'prompt_version': config.prompt_version,
    }


class CandidateSummary(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    plain_summary: str = Field(min_length=20, max_length=500)


def validate_summary(text: str) -> str:
    """Reject obvious diagnosis, direction and unsupported promotional claims."""
    if not re.match(r'^klinik(?:[ ,:])', text, re.I):
        raise ValueError('Özet, kaynağını kliniğe atfetmelidir')
    if re.search(r'\b(sende|siz(?:de|in)|ihtiyacınız|öneriyoruz|en iyi klinik|en ucuz|garanti|tanı|teşhis|kesin iyileşme|başarı oranı)\b', text, re.I):
        raise ValueError('Özet, yalnızca kaynak bilgilerini aktarma sınırını aşıyor')
    return text


def explain_with_openai(plan: dict, template_summary: str, config: GatewayConfig) -> tuple[str, int, int]:
    """Return one bounded candidate summary, validated again by the caller."""
    if config.provider != 'openai':
        raise ValueError('OpenAI gateway is not enabled')
    key = os.getenv('OPENAI_API_KEY')
    if not key:
        raise ValueError('OpenAI gateway key is unavailable')
    source = canonical_source(plan)
    schema = {
        'type': 'object',
        'properties': {'plain_summary': {'type': 'string'}},
        'required': ['plain_summary'],
        'additionalProperties': False,
    }
    payload = {
        'model': config.model,
        'store': False,
        'max_output_tokens': 350,
        'input': [
            {'role': 'system', 'content': (
                'Klinik tarafından hazırlanan diş tedavi planını sade Türkçe ile yeniden yazın. '
                'Yalnızca kliniğin belirttiklerini aktarın. Tanı koymayın, tedavi önermeyin, '
                'röntgen yorumlamayın, klinikleri sıralamayın, sonuç öngörmeyin veya yeni bilgi eklemeyin. '
                '"Klinik ... öneriyor" gibi tarafsız bir dil kullanın. '
                'Yalnızca istenen JSON verisini döndürün.'
            )},
            {'role': 'user', 'content': json.dumps({
                'structured_clinic_plan': source,
                'template_summary': template_summary,
            }, ensure_ascii=False, separators=(',', ':'))},
        ],
        'text': {'format': {
            'type': 'json_schema',
            'name': 'dentpro_proposal_summary_v2',
            'strict': True,
            'schema': schema,
        }},
    }
    response = httpx.post(
        OPENAI_RESPONSES_URL,
        headers={'Authorization': f'Bearer {key}'},
        json=payload,
        timeout=8.0,
    )
    response.raise_for_status()
    result = response.json()
    if result.get('status') != 'completed':
        raise ValueError('Provider response was incomplete')
    texts = [
        part['text']
        for item in result.get('output', []) if item.get('type') == 'message'
        for part in item.get('content', []) if part.get('type') == 'output_text'
    ]
    if len(texts) != 1:
        raise ValueError('Provider returned no single text output')
    candidate = CandidateSummary.model_validate_json(texts[0])
    usage = result.get('usage') or {}
    return validate_summary(candidate.plain_summary), int(usage.get('input_tokens') or 0), int(usage.get('output_tokens') or 0)
