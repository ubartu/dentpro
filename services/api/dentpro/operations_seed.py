from datetime import timedelta
from .db import Session, Clinic, Case, Proposal, Appointment, Consent, now
from .contracts import PROCEDURES
from .operations_models import Account, ClinicProfile, ClinicLocation, ProposalState, GlossaryEntry, PlatformSetting, CaseReview
from .auth import password_hash

LEGACY_PROCEDURES = {
    'ROOT_CANAL': ('Root canal', 'The clinic proposes treatment inside the tooth’s root canals.'),
    'ROOT_CANAL_SINGLE': ('Root canal — 1 canal', 'The clinic proposes root canal treatment involving one canal in the listed tooth.'),
    'ROOT_CANAL_DOUBLE': ('Root canal — 2 canals', 'The clinic proposes root canal treatment involving two canals in the listed tooth.'),
    'ROOT_CANAL_MULTI': ('Root canal — multiple canals', 'The clinic proposes root canal treatment involving multiple canals in the listed tooth.'),
    'EXTRACTION': ('Tooth extraction', 'The clinic proposes removing the listed tooth.'),
    'IMPLANT': ('Dental implant', 'The clinic proposes placing a dental implant. Ask the clinic which components are included.'),
    'CROWN': ('Dental crown', 'The clinic proposes a covering placed over the listed tooth.'),
    'FILLING': ('Dental filling', 'The clinic proposes restoring part of the listed tooth with a filling.'),
    'CLEANING': ('Dental cleaning', 'The clinic proposes a professional dental cleaning.'),
}

def seed_base_settings(db):
    for code,(name,text) in PROCEDURES.items():
        entry = db.get(GlossaryEntry, code)
        if not entry:
            db.add(GlossaryEntry(code=code,name=name,explanation=text))
        elif entry.name == LEGACY_PROCEDURES[code][0] and entry.explanation == LEGACY_PROCEDURES[code][1]:
            # Only migrate untouched defaults. Translation needs a fresh dentist review.
            entry.name = name
            entry.explanation = text
            entry.reviewed = False
            entry.reviewer = ''
            entry.version += 1
    if not db.get(PlatformSetting,'operations'):
        db.add(PlatformSetting(key='operations',value={'explanations_enabled':True,'max_recipients':10,'upload_limit_mb':10}))

def seed_operations():
    with Session() as db:
        seed_base_settings(db)
        for c in db.query(Clinic).all():
            if not db.get(ClinicProfile,c.id): db.add(ClinicProfile(clinic_id=c.id,status='active',email=f'contact@{c.id}.example',subscription='trial'))
        accounts=[('clinic-account','clinic@dentpro.local','Dr. Deniz Kaya','clinic','clinic-1','Clinic123!'),('admin-account','admin@dentpro.local','Platform yöneticisi','admin',None,'Admin123!')]
        for id,email,name,role,cid,password in accounts:
            if not db.get(Account,id): db.add(Account(id=id,email=email,name=name,role=role,clinic_id=cid,password_hash=password_hash(password)))
        if not db.get(PlatformSetting,'operations_seed_v1'):
            # Additional synthetic case inbox examples. No medical findings or contact data.
            for i,(title,status,days) in enumerate([('Restoratif tedavi danışması','new',0),('İmplant danışma talebi','reviewing',1),('Tedavi planı için ikinci görüş','new',2),('Kaplama yenileme danışması','declined',4)],1):
                cid=f'ops-case-{i}'
                if not db.get(Case,cid):
                    db.add(Case(id=cid,user_id=f'synthetic-patient-{i}',title=title,region='Istanbul',status='shared',recipients=['clinic-1','clinic-2'],asset=None,created_at=now()-timedelta(days=days)))
                    db.add(Consent(user_id=f'synthetic-patient-{i}',case_id=cid))
                    db.add(CaseReview(case_id=cid,clinic_id='clinic-1',status=status,notes='İş akışı testi için örnek vaka. Klinik görsel eklenmedi.'))
            if not db.get(Clinic,'clinic-4'):
                db.add(Clinic(id='clinic-4',name='Ege Dental Centre',region='Izmir',district='Alsancak',address='Alsancak, Izmir'))
                db.add(ClinicProfile(clinic_id='clinic-4',status='pending',email='hello@ege.example',review_notes='Klinik doğrulaması bekleniyor.'))
            if db.get(Proposal,'proposal-2') and not db.query(Appointment).filter_by(proposal_id='proposal-2',user_id='patient-demo').first():
                db.add(Appointment(proposal_id='proposal-2',user_id='patient-demo',clinic_id='clinic-2',kind='callback'))
            db.add(PlatformSetting(key='operations_seed_v1',value={'done':True}))
        # District-centre coordinates for synthetic demonstration clinics only.
        for clinic_id, latitude, longitude in (
            ('clinic-1', 40.9910, 29.0277),
            ('clinic-2', 41.0447, 29.0073),
            ('clinic-3', 41.0602, 28.9877),
            ('clinic-4', 38.4325, 27.1384),
        ):
            if db.get(Clinic, clinic_id) and not db.get(ClinicLocation, clinic_id):
                db.add(ClinicLocation(clinic_id=clinic_id, latitude=latitude, longitude=longitude))
        for p in db.query(Proposal).all():
            if not db.get(ProposalState,p.id): db.add(ProposalState(proposal_id=p.id))
        db.commit()
