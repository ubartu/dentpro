from datetime import datetime, timedelta, timezone
from .db import Session, Clinic, Case, Proposal, Consent
from .interpreter import cache_key,digest

def seed():
    with Session() as db:
        if db.get(Clinic,'clinic-1'):return
        for id,name,district in [('clinic-1','Mavi Dental Studio','Kadıköy'),('clinic-2','Ada Oral & Dental','Beşiktaş'),('clinic-3','Dentora Clinic','Şişli')]:
            db.add(Clinic(id=id,name=name,region='Istanbul',district=district,address=f'{district}, Istanbul'))
        db.add(Case(id='case-demo',user_id='patient-demo',title='My dental care plan',region='Istanbul',status='shared',recipients=['clinic-1','clinic-2','clinic-3'],asset={'name':'Example panoramic X-ray','type':'image/png','synthetic':True}))
        db.add(Consent(user_id='patient-demo',case_id='case-demo'))
        for i,(root,crown,sessions,material) in enumerate([(650000,900000,3,'Zirconia'),(720000,850000,3,'Zirconia'),(600000,750000,4,None)],1):
            plan={'items':[{'tooth':'16','procedure_code':'ROOT_CANAL','material':None,'price_minor':root,'sessions':2},{'tooth':'16','procedure_code':'CROWN','material':material,'price_minor':crown,'sessions':1}], 'sessions':sessions,'requires_exam':True,'first_available_slot':(datetime.now(timezone.utc)+timedelta(days=i+2)).isoformat(),'notes':'This is an example proposal using synthetic data. Final treatment and pricing require an in-person examination.','currency':'TRY'}
            db.add(Proposal(id=f'proposal-{i}',case_id='case-demo',clinic_id=f'clinic-{i}',idempotency_key=f'seed-{i}',request_hash=digest(plan),plan=plan,total_minor=root+crown,explanation_key=cache_key(plan)))
        db.commit()
    from .worker import run_once
    run_once()
