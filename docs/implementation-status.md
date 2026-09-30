# DENTpro panel implementation status

The web product now consists of dedicated clinic and platform administration panels. The prior patient webpage and role-switching interface were removed. Patient interactions are available in the React Native / Expo client at `apps/mobile` and the shared REST API.

## Implemented panel workflows

### Clinic

- Account sign-in, profile-aware navigation and server-enforced clinic scope.
- Dashboard with actual counts, recent cases, confirmed appointments and seven-day submission activity.
- Searchable/filterable inbox with case references, consent state, imaging access, review status and persistent internal notes.
- Authorized image download/preview, including PNG/JPEG and PDF rendering. Image access is audited.
- Complete structured proposal editor: FDI tooth numbers, canonical procedure taxonomy (including 1-canal, 2-canal and multiple-canal root treatments), material, TRY/USD/EUR minor-unit pricing, clinician-selected procedure urgency with stable priority sorting, per-procedure sessions, overall visits, timezone-aware availability, examination requirement and clinical notes. Drafts and revisions retain currency, priority and procedure order.
- Server-persisted draft save/resume/discard. Drafts are private to the clinic.
- Idempotent publication and immutable revisions. Previous submitted versions become superseded; withdrawn/superseded records remain inspectable.
- Source proposal and derived explanation shown separately, with glossary review status and missing information.
- Published proposal details in clinic/admin panels retain a 3D child/adult tooth view, highlighting plan teeth; inspection does not edit the published plan. Numbered inspection remains available without WebGL.
- Request state machine: requested → contacted → confirmed → completed, with cancellation paths. Confirmation requires a scheduled time; completed/cancelled requests cannot be reopened.
- Team account creation/deactivation/password reset, clinic profile and opening-hours editing, subscription record and operational analytics.
- Proposal and appointment CSV exports, with spreadsheet formula prefix neutralization.
- Clinic-owned social profile editing with validated HTTPS platform links.

### Administration

- Separate authenticated navigation and platform-wide dashboard.
- Clinic onboarding, profile, region and location-coordinate editing, approval, suspension and rejection with notes. Suspension blocks access, new dispatch and sign-in, and revokes active sessions.
- Account creation and access control, with own-account deactivation blocked.
- Case oversight, authorized imaging access, consent inspection, archive/reopen, and redispatch restricted to the patient's existing recipient set.
- Proposal source/explanation review; approvals and flags. Flagged proposals are excluded from patient-facing list/detail/compare/request flows.
- Cross-clinic appointment coordination.
- Subscription status, fee and renewal management. Contracted monthly fees are explicitly separated from collected revenue; no invoices or charges are fabricated.
- Durable explanation job visibility, attempts/errors, bounded retry, manual retry, version-aware requeue and cache reuse.
- Versioned glossary editing and recorded dentist-review attribution. Requeueing with changed glossary content creates a new immutable explanation; prior explanations are retained.
- Pause/resume interpreter processing and API-enforced upload/recipient limits.
- Searchable/filterable audit events and CSV export (latest 1,000 events).
- Verified Google Place ID mapping and social-profile management per clinic; server-side Places API (New) gateway is disabled until credentials are configured.

## Patient mobile application

- React Native / Expo SDK 57 workspace with Expo Router, native icons, iOS/Android configuration and EAS build profiles.
- Patient registration/login, encrypted native credential storage, account/profile editing, password changes with session revocation, and sign out. Password recovery supports expiring single-use email links, session revocation, queued transactional delivery and web/mobile forms; real delivery requires configuration. See [mail setup](mail-recovery.md). A separate cloud staging API mode is available for synthetic evaluation; email verification, MFA and production account lifecycle remain unfinished.
- Case creation with versioned consent and idempotent submission, case history, PNG/JPEG/PDF selection/upload, image preview and system sharing.
- Confirmed deletion of the patient's own unshared drafts from Your cases; attached X-rays and consent records are removed, audit events retained, and stale creation retries cannot recreate deleted drafts.
- Optional foreground location access for approximate nearby clinics, a complete active-clinic list independent of case region, recipient limits, explicit sharing confirmation and the existing server dispatch flow. Denied or unavailable location does not block selection.
- Clinic selection cards show supplied social profiles and open a dedicated clinic details screen. A verified Place ID loads Google Maps Embed on that screen; an external Google profile link provides available ratings/reviews/photos. Missing mapping/configuration and map failures have fallbacks. The selector does not call paid Places. See [Maps Embed setup](maps-embed-integration.md); the optional [Places gateway](google-places-integration.md) remains separate.
- Clinic proposal details show original currency, canal-count treatment labels and clinician-set urgency. Separate source-labelled AI/template explanation with pending/failed/paused states and objective side-by-side comparison; mixed currencies have an explicit no-conversion notice.
- Callback/appointment requests, clinic-confirmed scheduling details, patient cancellation and clinic contact links. Staff see patient contact details only after a request exists.
- Foreground/focus/pull-to-refresh updates and explicit network/error handling. Push delivery is not implemented.
- Generated mobile TypeScript contracts from OpenAPI, component/API/session tests, and CI checks.
- Android Expo Go runtime verification and iOS/Android JavaScript exports; signed native builds and physical iOS verification remain separate release work. See verification notes for the actual tested flows.

## Access and persistence

Staff authenticate using persistent accounts with Argon2id password hashes and random opaque sessions. Existing local PBKDF2-SHA256 hashes remain verifiable and are upgraded on sign-in. Session tokens are stored hashed server-side, expire after 12 hours, and are revoked on logout/account changes. Clinic and admin demo-token endpoints were removed. The local patient demo-session endpoint is absent in cloud staging.

Operations use additive tables so prior case/proposal records are preserved. Clinic scope and admin role requirements are enforced on the server, including writes. The web stores the bearer token in per-tab sessionStorage and revalidates its account on page load.

## Remaining external / production work

These panels are operational locally; the project is not yet a production healthcare deployment.

- Signed mobile builds/store distribution and physical iOS/Android verification; external identity onboarding, invitations, email verification, forgotten-password recovery, deletion/retention workflows, MFA/SSO, IP-based edge rate limits, registration abuse protection and production session hardening. Cloud sign-in has a shared per-identifier failed-attempt limit.
- Managed PostgreSQL end-to-end verification, reviewed migrations/foreign keys, concurrency/load testing, encrypted backups and recovery. Cloud staging requires a fresh managed PostgreSQL database with verified TLS and versioned schema; no cloud service has been provisioned.
- Cloud staging stores bounded private X-ray bytes in PostgreSQL instead of container disk. Dedicated object storage at scale, upload quarantine/content scanning, data retention/deletion and protected audit infrastructure remain unfinished.
- A server-side OpenAI Responses gateway is available for rewriting the plain summary of a clinic-authored structured proposal. It is disabled by default, sends no X-ray/PII/free-text notes, and falls back to deterministic glossary templates on provider errors or invalid output. Live-provider execution, source-grounding quality evaluation and clinical approval of generated wording remain unfinished; an admin review checkbox records glossary attribution rather than independent clinical review.
- Notification delivery and payment collection/invoices. Appointment and subscription management store operational records only.
- Google Places credentials, billing/quotas, verified clinic Place IDs, real-provider attribution checks and published Google-compatible Terms/Privacy Policy before public activation. Only mocked provider requests have been tested.
- Redis/distributed queue leases, dead-letter handling, worker health telemetry and production monitoring. The current durable queue uses the database and one worker process.
- Turkish localization, broader accessibility validation, clinical production deployment and jurisdiction-specific professional/legal review.

Only synthetic data is seeded and used for verification. Local development and cloud staging are distinct; clinical production use remains blocked until these dependencies and controls are addressed. See [cloud deployment](cloud-deployment.md).
