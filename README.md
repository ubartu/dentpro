# DENTpro — Clinic & Administration

Two separate, account-protected web panels for DENTpro v1.5. The patient web interface has been removed. Patient case creation, consent, image upload, clinic dispatch, comparison, and appointment requests remain API workflows for the native patient client in `apps/mobile`.

## Start

Requirements: Node.js 22.13+ and Python 3.11+.

```sh
npm ci
python3 -m venv .venv
.venv/bin/pip install -r services/api/requirements.lock.txt
.venv/bin/python scripts/dev.py
```

Open http://127.0.0.1:3000/login. The root URL redirects to `/clinic`; unauthenticated visitors are sent to sign-in. API documentation: http://127.0.0.1:8000/docs. Ctrl+C stops API, worker and web.

### Local evaluation accounts

| Portal         | Email                | Initial password |
| -------------- | -------------------- | ---------------- |
| Clinic         | clinic@dentpro.local | Clinic123!       |
| Administration | admin@dentpro.local  | Admin123!        |

The login page can fill these local credentials. Choose the correct portal, then sign in. There is no in-workspace role switcher. Sign out before entering the other portal. Passwords are salted/hashed; sessions are opaque, hashed in the database, expire after 12 hours and are revoked on sign-out, account deactivation, password reset, or clinic suspension. Seeded passwords are not reset on server restart. Additional accounts can be created in the panels.

This local environment uses synthetic data. A separate, security-gated `APP_ENV=cloud` Docker stack is available for **cloud staging with synthetic data**; see [cloud deployment and remaining security requirements](docs/cloud-deployment.md). It does not establish clinical production readiness. Live payments, messaging, production identity onboarding and clinical validation are not connected. Do not use real patient data.

### Optional AI proposal-summary gateway

The worker normally creates deterministic glossary/template explanations. To exercise the provider gateway with synthetic plans, set `DENTPRO_AI_PROVIDER=openai`, `DENTPRO_AI_MODEL=gpt-5.4-nano`, and `OPENAI_API_KEY` in the **API/worker process environment**, then restart `scripts/dev.py`. The key is never entered in the web or mobile app. `GET /admin/ai/gateway` reports non-secret readiness, and the admin interpreter page shows each job's provider, model and output mode. Missing credentials leave the template provider active; provider errors or invalid responses use a labelled template fallback.

The external request contains only canonical structured clinic-plan fields and the existing template summary. X-rays, patient names, contact details, case IDs and clinic free-text notes are excluded. The provider rewrites only the plain summary; procedure explanations, missing-information items, questions and disclaimer stay deterministic. No live OpenAI request or clinical quality review has been completed. The gateway is intended for synthetic evaluation until clinical, privacy and deployment work is finished.

## Patient mobile app

Clinic selection supports verified social links and optional on-demand Google ratings/photos. See [Google Places setup and provider boundaries](docs/google-places-integration.md). The integration is off by default and needs a server-side restricted Places API key and verified clinic Place IDs.

The React Native / Expo app for iOS and Android is in `apps/mobile`. Run `npm run mobile` from the repository root after starting the API. See the [mobile README](apps/mobile/README.md) for device networking, screens, test commands and native build profiles. Patient accounts are created in the app and are separate from staff accounts.

## Clinic panel

| Page                | Actions                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview            | Actual inbox, draft, proposal and appointment counts; recent cases; seven-day proposal activity; confirmed appointments                                                   |
| Case inbox          | Search/filter cases, open details, view/download authorized imaging, change review state, save private clinic notes                                                       |
| Proposal editor     | Structured FDI tooth/procedure/material/price items, visits, availability, examination requirement, inclusions; save drafts and resume after reload; publish idempotently |
| Proposals & drafts  | Search/filter/export, inspect source and explanation, publish immutable revisions, withdraw current proposals, discard saved drafts                                       |
| Appointments        | Search/filter/export requests; record contact; confirm with a scheduled time; complete or cancel; save coordination notes                                                 |
| Activity & response | Actual case response breakdown, proposal activity, confirmed/completed visits                                                                                             |
| Team members        | Create clinic staff accounts, disable access, reset passwords                                                                                                             |
| Clinic profile      | Edit contact details, address, description and opening hours                                                                                                              |
| Subscription        | View current subscription state, administrative fee and renewal date                                                                                                      |

The clinic proposal editor includes a rotatable 3D tooth selector with adult (32 teeth) and child (20 teeth) views. Choose the active procedure, then click a tooth or its numbered button to fill the FDI field. Blue marks the active selection; teal marks teeth used elsewhere in the proposal. Whole-mouth selection uses `ALL`. Switching views preserves mixed-dentition plans, drafts and revisions. Numbered buttons and the FDI input remain available if WebGL is unavailable. The model is a procedural schematic, not a patient scan.

## Admin panel

| Page               | Actions                                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview           | Clinic approvals, shared cases, proposal review queue, job counts, recorded costs, audit activity                                                           |
| Clinics            | Create clinic records, edit profiles/regions, approve, suspend or reject with review notes                                                                  |
| Platform cases     | Search/filter, inspect imaging and consent, inspect all responses, archive/reopen with reasons, redispatch to existing consented recipients                 |
| Proposal oversight | Inspect versioned clinic plans and explanations; approve or flag; flagged/currently withdrawn/superseded proposals are withheld from patient-facing results |
| Appointments       | Cross-clinic request coordination and status management                                                                                                     |
| Accounts & access  | Create clinic/admin accounts, reset passwords, disable accounts; own-account deactivation is blocked                                                        |
| Subscriptions      | Maintain subscription states, fees, renewal dates; display contracted fees, not collected revenue                                                           |
| Explanation jobs   | Inspect queue, attempts and errors; retry failed jobs; request a new explanation against the current glossary; reuse identical cached outputs               |
| Procedure glossary | Edit versioned explanations and record dentist-review attribution                                                                                           |
| Audit trail        | Search/filter the latest 1,000 events and export CSV                                                                                                        |
| Settings           | Pause/resume explanation processing; enforce upload size and per-case recipient limits                                                                      |

## Try a clinic workflow

1. Sign in to Clinic portal and open **Case inbox**.
2. Open a new synthetic case, set **In review**, and save a note.
3. Create a proposal, enter procedures/prices and **Save draft**. Reload to verify persistence.
4. Continue the draft and **Publish proposal**. The worker produces the explanation separately.
5. Open **Proposals & drafts**, inspect the plan, and **Revise** to create version 2 while preserving version 1.
6. Manage seeded callback requests in **Appointments**; select Confirmed and supply a future appointment time.
7. Sign out and enter Admin portal to review the resulting records and audit events.

Synthetic inbox cases intentionally contain no clinical X-rays. Image review works for files supplied through the mobile API. The browser suite below creates a valid one-pixel synthetic PNG for this purpose.

## Verification

```sh
PYTHONPATH=services/api .venv/bin/pytest services/api/tests -q
npm run typecheck
npm run build
PYTHONPATH=services/api .venv/bin/python scripts/export_contracts.py
```

Browser regression suite (with local servers already running):

```sh
npx playwright install chromium
npm run test:e2e
```

You can set `CHROMIUM_EXECUTABLE_PATH` to an existing compatible Chromium executable. `WEB_URL` and `API_URL` override the default local addresses. The suite creates synthetic cases, proposals, accounts and clinic records. Screenshots are saved in ignored `tmp/panel-qa/`.

## Persistence and structure

SQLite defaults to `.data/dentpro.db`. An inherited `DATABASE_URL` overrides this (the current verified environment uses `local.db`). Uploaded files are in `.data/assets`. Account and operations tables are added without dropping earlier case/proposal data.

- `apps/web/app/clinic`, `admin`, `login`: separate routes.
- `apps/web/app/components`: workspace shells, clinic/admin screens, shared editors and controls.
- `services/api/dentpro/operations.py`: authenticated clinic/admin API.
- `services/api/dentpro/operations_models.py`: additive account, draft, lifecycle, queue and configuration tables.
- `services/api/dentpro/main.py`: original mobile marketplace API and app bootstrap.
- `services/api/dentpro/worker.py`: durable interpreter with bounded retries and template fallback.
- `services/api/dentpro/ai_gateway.py`: optional server-side OpenAI Responses adapter and payload boundary.
- `services/api/tests`: API workflow and authorization regressions.
- `tests/e2e/panels.cjs`: browser workflows for both portals.
- `packages/contracts`: exported OpenAPI and proposal JSON Schema.

Optional local PostgreSQL:

```sh
docker compose up -d postgres
DATABASE_URL=postgresql+psycopg://dentpro:dentpro@127.0.0.1:5432/dentpro .venv/bin/python scripts/dev.py
```

PostgreSQL/Docker execution is not yet verified. The launcher inherits exported environment variables; it does not automatically load `.env.example`.

See [implementation status](docs/implementation-status.md) and [verification notes](docs/verification.md) for precise boundaries and test evidence.

For patient app work, use the [mobile implementation baseline](docs/mobile-implementation-baseline.md), which maps the PDF scope to existing panel workflows, current patient endpoints, backend gaps and iOS/Android acceptance checks.
