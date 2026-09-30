"""Source-only deterministic interpreter. No patient identifiers, notes or images leave this process.
Glossary is a draft and must receive dentist approval before use with patients.
"""
import hashlib
import json
from .contracts import PROCEDURES

DISCLAIMER = 'Bu açıklama kliniğin teklifini sadeleştirir. Bağımsız bir tanı veya tedavi önerisi değildir.'

def canonical_source(plan):
    # Free-text notes/material names are excluded from the interpreter boundary.
    return {
        'items': [{k: item[k] for k in ('tooth','procedure_code','price_minor','sessions')} | {'material_specified': bool(item.get('material')), 'urgency': item.get('urgency','routine')} for item in plan['items']],
        'sessions': plan['sessions'], 'requires_exam': plan['requires_exam'],
        'currency': plan['currency'], 'first_available_slot': plan.get('first_available_slot'),
    }

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()

def cache_key(plan):
    return digest({'plan': canonical_source(plan), 'locale': 'tr', 'prompt_version': '2', 'policy_version': '1', 'model_family': 'template-v1'})

def explain(plan):
    source = canonical_source(plan)
    missing = []
    for i, item in enumerate(source['items']):
        if item['procedure_code'] in ('IMPLANT','CROWN','FILLING') and not item['material_specified']:
            missing.append(f'{i+1}. işlem için malzeme belirtilmedi.')
    if not source['first_available_slot']: missing.append('İlk uygun randevu tarihi belirtilmedi.')
    return {
        'plain_summary': f"Klinik, {source['sessions']} planlanan seansta {len(source['items'])} işlem sunuyor. " + ('Yüz yüze muayene gerekli.' if source['requires_exam'] else 'Klinik, muayeneyi gerekli olarak işaretlemedi.'),
        'procedures': [{'source_item_id': str(i+1), 'simple_explanation': PROCEDURES[x['procedure_code']][1]} for i,x in enumerate(source['items'])],
        'missing_information': missing,
        'questions_to_ask_clinic': ['Ön fiyatlandırmaya neler dahil?', 'Muayeneden sonra plan veya fiyat değişebilir mi?'],
        'disclaimer': DISCLAIMER,
        'mode': 'template', 'glossary_status': 'draft_requires_dentist_review',
    }


def localize_legacy_output(output, plan):
    """Present old generated English records in Turkish without changing stored evidence."""
    from .operations_seed import LEGACY_PROCEDURES
    converted = dict(output)
    if converted.get('plain_summary', '').lower().startswith('the clinic '):
        converted['plain_summary'] = explain(plan)['plain_summary']
        converted['mode'] = 'template' if converted.get('mode') == 'ai' else converted.get('mode', 'template')
    old_explanations = {old[1]: PROCEDURES[code][1] for code, old in LEGACY_PROCEDURES.items()}
    converted['procedures'] = [
        {**item, 'simple_explanation': old_explanations.get(item['simple_explanation'], item['simple_explanation'])}
        for item in output.get('procedures', [])
    ]
    converted['missing_information'] = [
        ('İlk uygun randevu tarihi belirtilmedi.' if value == 'The first available appointment has not been provided.'
         else f"{value.split(' ')[6].rstrip('.')}. işlem için malzeme belirtilmedi." if value.startswith('Material is not specified for item ') and value.endswith('.')
         else value)
        for value in output.get('missing_information', [])
    ]
    converted['questions_to_ask_clinic'] = [
        {'What is included in the preliminary price?': 'Ön fiyatlandırmaya neler dahil?',
         'Could the plan or price change after an examination?': 'Muayeneden sonra plan veya fiyat değişebilir mi?'}.get(value, value)
        for value in output.get('questions_to_ask_clinic', [])
    ]
    if converted.get('disclaimer') == 'This explanation simplifies the clinic’s proposal. It is not an independent diagnosis or treatment recommendation.':
        converted['disclaimer'] = DISCLAIMER
    return converted
