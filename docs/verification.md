# Verification — 24 September 2026

## Separate clinic and admin panels

- **15 API regression tests passed.** Covers the patient API foundation and distinct panel workflows: tenant/role isolation, login/logout, session revocation, suspension, account management, draft persistence, idempotent publication, immutable revisions, withdrawal, appointment transitions, source moderation, admin clinic editing, consent-preserving redispatch, case archiving, glossary versioning, queue pause/resume and bounded failure retries.
- **TypeScript checks passed.**
- **Next.js optimized production build passed.** Routes: `/`, `/login`, `/clinic/[[...path]]`, `/admin/[[...path]]`. The root redirects to the clinic portal; no patient web interface exists.
- **Repeatable browser regression passed** (`npm run test:e2e`). The suite:
  - Signs into each portal using its own account.
  - Creates a synthetic case and uploads a valid one-pixel PNG through the patient API.
  - Saves and reloads clinic notes and proposal drafts.
  - Publishes a proposal and a revision, verifying only the current revision is patient-visible.
  - Contacts a callback requester and confirms an appointment time.
  - Creates and disables a clinic team account.
  - Creates and approves a clinic as administrator.
  - Records proposal moderation and a subscription fee/renewal.
  - Checks glossary/job/settings screens and saves settings.
  - Filters and downloads audit CSV.
  - Visits every panel navigation page and verifies persisted changes through the API.
  - Records no browser page errors.
- Desktop (1440 px) and mobile (390 px) layouts inspected; mobile navigation and horizontal overflow checks pass. Screenshots are in ignored `tmp/panel-qa/`.

Browser verification uses the project’s Playwright dependency. It supports an existing Chromium executable via `CHROMIUM_EXECUTABLE_PATH`; a local `.data/e2e-browser.json` containing `executablePath` can also provide that path. Browser tests create clearly named synthetic QA records rather than touching user-provided data.

The API suite emits one upstream Starlette deprecation warning for the httpx TestClient adapter. No test failures. CI checks are configured, but no remote CI execution or deployment has occurred.

## Unverified / external boundaries

PostgreSQL/Docker execution, managed cloud deployment, notification delivery, payment processing, external LLM integration, clinical validation, production security/identity workflows, native mobile, and real patient data handling are not claimed as completed. Subscription and appointment updates persist local operational records; they do not send messages, charge cards, or create external bookings.

See `implementation-status.md` and the README route/workflow tables for the implemented scope.
