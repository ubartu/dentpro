"""Source-only deterministic interpreter. No patient identifiers, notes or images leave this process.
Glossary is a draft and must receive dentist approval before use with patients.
"""
import hashlib
import json
from .contracts import PROCEDURES

DISCLAIMER = 'This explanation simplifies the clinic’s proposal. It is not an independent diagnosis or treatment recommendation.'

def canonical_source(plan):
    # Free-text notes/material names are excluded from the interpreter boundary.
    return {
        'items': [{k: item[k] for k in ('tooth','procedure_code','price_minor','sessions')} | {'material_specified': bool(item.get('material'))} for item in plan['items']],
        'sessions': plan['sessions'], 'requires_exam': plan['requires_exam'],
        'currency': plan['currency'], 'first_available_slot': plan.get('first_available_slot'),
    }

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()

def cache_key(plan):
    return digest({'plan': canonical_source(plan), 'locale': 'en', 'prompt_version': '1', 'policy_version': '1', 'model_family': 'template-v1'})

def explain(plan):
    source = canonical_source(plan)
    missing = []
    for i, item in enumerate(source['items']):
        if item['procedure_code'] in ('IMPLANT','CROWN','FILLING') and not item['material_specified']:
            missing.append(f'Material is not specified for item {i+1}.')
    if not source['first_available_slot']: missing.append('The first available appointment has not been provided.')
    return {
        'plain_summary': f"The clinic lists {len(source['items'])} procedure(s) across {source['sessions']} planned visit(s). " + ('An in-person examination is required.' if source['requires_exam'] else 'The clinic has not marked an examination as required.'),
        'procedures': [{'source_item_id': str(i+1), 'simple_explanation': PROCEDURES[x['procedure_code']][1]} for i,x in enumerate(source['items'])],
        'missing_information': missing,
        'questions_to_ask_clinic': ['What is included in the preliminary price?', 'Could the plan or price change after an examination?'],
        'disclaimer': DISCLAIMER,
        'mode': 'template', 'glossary_status': 'draft_requires_dentist_review',
    }
