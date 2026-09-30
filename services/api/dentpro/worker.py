"""Single-process durable interpreter worker, with visible jobs and bounded retries."""
import time
import logging
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from .db import Session, Proposal, Explanation, audit, now
from .interpreter import explain
from .ai_gateway import GatewayConfig, explain_with_openai
from .operations_models import ExplanationJob, AIExplanationRequest, PlatformSetting
from .mail_worker import run_mail_once

def run_once():
    count=0
    with Session() as db:
        setting=db.get(PlatformSetting,'operations')
        if setting and not setting.value.get('explanations_enabled',True):return 0
        proposals=db.scalars(select(Proposal).outerjoin(Explanation,Proposal.explanation_key==Explanation.key).where(Explanation.key.is_(None)).limit(100)).all()
        for p in proposals:
            if db.get(Explanation,p.explanation_key):continue
            job=db.get(ExplanationJob,p.explanation_key)
            if job and job.status=='failed':continue
            if not job:
                job=ExplanationJob(key=p.explanation_key,proposal_id=p.id,glossary={});db.add(job);db.commit()
            job.attempts+=1;job.updated_at=now();db.commit()
            try:
                output=explain(p.plan)
                if job.glossary:
                    output['procedures']=[{'source_item_id':str(i+1),'simple_explanation':job.glossary[item['procedure_code']]['text']} for i,item in enumerate(p.plan['items'])]
                    if all(job.glossary[item['procedure_code']]['reviewed'] for item in p.plan['items']):output['glossary_status']='dentist_review_recorded'
                request=db.get(AIExplanationRequest,p.explanation_key)
                gateway=GatewayConfig(provider=request.provider,model=request.model,prompt_version=request.prompt_version) if request else GatewayConfig()
                model='template-v1';input_tokens=0;output_tokens=0
                if gateway.provider=='openai':
                    try:
                        summary,input_tokens,output_tokens=explain_with_openai(p.plan,output['plain_summary'],gateway)
                        output['plain_summary']=summary
                        output['mode']='ai'
                        model=gateway.model
                    except Exception:
                        # A provider outage or invalid output cannot block the clinic proposal.
                        # Do not persist raw provider errors; they may include request data.
                        output['mode']='template_fallback'
                db.add(Explanation(key=p.explanation_key,output=output,model=model,prompt_version=gateway.prompt_version,input_tokens=input_tokens,output_tokens=output_tokens))
                job.status='completed';job.error='';audit(db,'worker','explanation.created',p.id)
                db.commit();count+=1
            except IntegrityError:db.rollback()
            except Exception as exc:
                # Do not include patient/source data in the job error.
                db.rollback();job=db.get(ExplanationJob,p.explanation_key)
                if job:
                    job.status='failed' if job.attempts>=3 else 'pending';job.error=type(exc).__name__+': interpreter could not complete this job';job.updated_at=now();db.commit()
    return count

if __name__=='__main__':
    while True:
        try:
            run_mail_once()
            run_once()
        except Exception:logging.exception('Worker cycle failed; will retry')
        time.sleep(2)
