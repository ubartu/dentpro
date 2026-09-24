# Explanation worker

Run from repository root after the API initializes tables:

```sh
PYTHONPATH=services/api .venv/bin/python -m dentpro.worker
```

`scripts/dev.py` starts it automatically. Admin → Explanation jobs displays the durable records; Admin → Settings pauses/resumes processing.

Publication commits the source plan immediately and creates a pending job. The source-only plan and a glossary snapshot determine the cache key. The worker stores an immutable explanation, updates the job and audits completion. GET requests never generate explanations. Three failed attempts stop a job until an administrator retries it. Errors expose their type rather than patient or source content. Identical keys reuse the existing output. A glossary change creates a new key on requeue; old outputs remain stored.

The provider is a deterministic template interpreter. The job’s glossary snapshot is used to avoid explanation text drifting between enqueue and execution. Legacy missing explanations are also processed. No patient identifiers, free-text notes, or X-rays are sent to an external model.

This implementation expects one local worker. Distributed leases, Redis, notifications, health alerts and spend budgets remain deployment work.
