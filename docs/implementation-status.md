# DENTpro panel implementation status

The web product now consists of dedicated clinic and platform administration panels. The prior patient webpage and role-switching interface were removed. Patient interactions are available in the React Native / Expo client at `apps/mobile` and the shared REST API.

## Implemented panel workflows

### Clinic

- Account sign-in, profile-aware navigation and server-enforced clinic scope.
- Dashboard with actual counts, recent cases, confirmed appointments and seven-day submission activity.
- Searchable/filterable inbox with case references, consent state, imaging access, review status and persistent internal notes.
- Authorized image download/preview, including PNG/JPEG and PDF rendering. Image access is audited.
- Complete structured proposal editor: FDI tooth numbers, canonical procedure taxonomy, material, integer minor-unit pricing, per-procedure sessions, overall visits, timezone-aware availability, examination requirement and clinical notes.
- Server-persisted draft save/resume/discard. Drafts are private to the clinic.
- Idempotent publication and immutable revisions. Previous submitted versions become superseded; withdrawn/superseded records remain inspectable.
- Source proposal and derived explanation shown separately, with glossary review status and missing information.
- Request state machine: requested → contacted → confirmed → completed, with cancellation paths. Confirmation requires a scheduled time; completed/cancelled requests cannot be reopened.
- Team account creation/deactivation/password reset, clinic profile and opening-hours editing, subscription record and operational analytics.
- Proposal and appointment CSV exports, with spreadsheet formula prefix neutralization.

### Administration

- Separate authenticated navigation and platform-wide dashboard.
- Clinic onboarding, profile and region editing, approval, suspension and rejection with notes. Suspension blocks access, new dispatch and sign-in, and revokes active sessions.
- Account creation and access control, with own-account deactivation blocked.
- Case oversight, authorized imaging access, consent inspection, archive/reopen, and redispatch restricted to the patient's existing recipient set.
- Proposal source/explanation review; approvals and flags. Flagged proposals are excluded from patient-facing list/detail/compare/request flows.
- Cross-clinic appointment coordination.
- Subscription status, fee and renewal management. Contracted monthly fees are explicitly separated from collected revenue; no invoices or charges are fabricated.
- Durable explanation job visibility, attempts/errors, bounded retry, manual retry, version-aware requeue and cache reuse.
- Versioned glossary editing and recorded dentist-review attribution. Requeueing with changed glossary content creates a new immutable explanation; prior explanations are retained.
- Pause/resume interpreter processing and API-enforced upload/recipient limits.
- Searchable/filterable audit events and CSV export (latest 1,000 events).

## Patient mobile application

- React Native / Expo SDK 57 workspace with Expo Router, native icons, iOS/Android configuration and EAS build profiles.
- Patient registration/login, encrypted native credential storage, account/profile editing, password changes with session revocation, and sign out. The API still runs only in development; email verification/recovery and production account lifecycle remain unfinished.
- Case creation with versioned consent and idempotent submission, case history, PNG/JPEG/PDF selection/upload, image preview and system sharing.
- Eligible clinic selection by region, recipient limits, explicit sharing confirmation and the existing server dispatch flow.
- Clinic proposal details, separate template explanation with pending/failed/paused states, and objective side-by-side comparison.
- Callback/appointment requests, clinic-confirmed scheduling details, patient cancellation and clinic contact links. Staff see patient contact details only after a request exists.
- Foreground/focus/pull-to-refresh updates and explicit network/error handling. Push delivery is not implemented.
- Generated mobile TypeScript contracts from OpenAPI, component/API/session tests, and CI checks.
- Android Expo Go runtime verification and iOS/Android JavaScript exports; signed native builds and physical iOS verification remain separate release work. See verification notes for the actual tested flows.

## Access and persistence

Staff authenticate using persistent accounts with PBKDF2-SHA256 password hashes and random opaque sessions. Session tokens are stored hashed server-side, expire after 12 hours, and are revoked on logout/account changes. Clinic and admin demo-token endpoints were removed. A local patient demo-session endpoint remains solely for exercising the future mobile API.

Operations use additive tables so prior case/proposal records are preserved. Clinic scope and admin role requirements are enforced on the server, including writes. The web stores the bearer token in per-tab sessionStorage and revalidates its account on page load.

## Remaining external / production work

These panels are operational locally; the project is not yet a production healthcare deployment.

- Signed mobile builds/store distribution and physical iOS/Android verification; external identity onboarding, invitations, email verification, forgotten-password recovery, deletion/retention workflows, MFA/SSO, brute-force protection and production session hardening.
- Managed PostgreSQL verification, migrations/foreign keys, concurrency/load testing, backups and recovery.
- Signed cloud object storage, upload quarantine/content scanning, data retention/deletion and protected audit infrastructure.
- Live LLM provider adapter, source-grounding quality evaluation and clinical approval of glossary wording. Current explanations are deterministic templates; an admin review checkbox records attribution rather than proving an independent clinical review.
- Notification delivery and payment collection/invoices. Appointment and subscription management store operational records only.
- Redis/distributed queue leases, dead-letter handling, worker health telemetry and production monitoring. The current durable queue uses the database and one worker process.
- Turkish localization, broader accessibility validation, deployment and jurisdiction-specific professional/legal review.

Only synthetic data is seeded and used for verification. Production startup remains blocked until these dependencies and controls are addressed.
