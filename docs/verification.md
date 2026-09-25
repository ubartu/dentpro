# Verification — 24 September 2026

## Separate clinic and admin panels

- **18 API regression tests passed.** Covers the patient API foundation and distinct panel workflows: tenant/role isolation, login/logout, session revocation, suspension, account management, draft persistence, idempotent publication, immutable revisions, withdrawal, appointment transitions, source moderation, admin clinic editing, consent-preserving redispatch, case archiving, glossary versioning, queue pause/resume and bounded failure retries. Patient coverage includes registration, profile/password changes, all-session revocation, case idempotency, consent versions, active clinic filtering, contact visibility and request cancellation.
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

## Patient mobile application

- **12 Jest tests passed** across API transport, session lifecycle and patient screens. Covers expired/offline sessions, reconnect, duplicate submission protection, sharing consent, source visibility when explanation fails, unavailable proposal booking, completed request cancellation and objective comparison fields.
- **Mobile TypeScript and Expo lint passed.**
- **Android and iOS Hermes JavaScript exports passed.** These are bundle checks, not signed native builds.
- **Expo Doctor passed all 21 checks.** The workspace lockfile also passed `npm ci --dry-run --ignore-scripts`.
- **Android native smoke verification** ran in Expo Go on a Pixel 3a Android 14 emulator. A synthetic patient registered, created a case, selected and uploaded a PNG using the native document picker, consented to sharing with two clinics, viewed published proposals and separate explanations, compared prices/visits, and sent a callback request. Staff API confirmation appeared in the app with its date/time. Native screenshots are in ignored `tmp/mobile-qa/`.
- Authenticated image preview was visually verified after switching to Expo Image with caching disabled. The uploaded test file matched the original SHA-256 checksum. Restarting Expo Go preserved the patient session. Metro was restarted after dependency changes; this host required IPv4-first localhost resolution for the Android reverse connection.
- The clinic/admin browser regression and optimized web build passed after aligning the shared React dependency.

Only synthetic records were used. Local API, worker, mobile and staff panels share persisted records. Push delivery is not connected; requests refresh while the app is active. Explanations use glossary templates.

## Mobile design verification — 25 September 2026

- Rebuilt the patient UI from the supplied login and meditation-app references in a blue palette. Local asset provenance and intentional workflow adaptations are recorded in `apps/mobile/assets/figma/README.md`.
- **14 Jest tests, TypeScript and Expo lint passed** after the redesign. New regression checks cover the pending sign-in state, retained credentials/error recovery, duplicate-submit prevention while pending, and stopping the logo animation when reduced motion is enabled.
- **Android and iOS Hermes exports passed** with local fonts/illustrations. An example HTTPS endpoint was supplied solely for export validation; no production API or deployment was provisioned. Only the four used Inter weights are imported.
- **Expo Doctor passed all 21 checks.**
- Inspected Android Expo Go screens: home, case details, proposal/source and expandable explanation, comparison, profile, sign-in, registration and new-case form. Signed back into the existing synthetic patient. Verified the native loading badge at multiple rotation angles by briefly pausing the local test API and then resuming it; no artificial delay exists in app code. Screenshots are in ignored `tmp/mobile-redesign/`.
- Checked the home and new-case form at Android font scale 1.4: home cards stack vertically, labels wrap and forms remain scrollable. Restored the emulator's original font setting afterward. Tab height includes the device's bottom safe area.
- Blue launcher/splash PNGs are rendered from the new vector badge. Custom installed-build splash behavior, iOS native rendering and physical devices remain unverified; Expo Go and JavaScript exports do not establish these.

## Clinic inbox verification — 25 September 2026

- The Awaiting review card links to `?status=new`; its count and inbox rows match. Status selection is URL-backed and survives reload and browser Back.
- Unanswered cases (new, reviewing or draft, without an active proposal; excluding declined/archived) sort before other cases and carry a visible Needs response label. Admin case styling is unchanged.
- The expanded browser regression passed: dashboard count/filter match, query navigation and reload, new-to-reviewing transition, draft retention in Unanswered, and removal after publication. Existing clinic/admin workflows also passed, with no browser errors.
- TypeScript and the optimized Next.js production build passed. Desktop and 390 px inbox screenshots were inspected; no horizontal page overflow. Screenshots: `tmp/panel-qa/clinic-awaiting-review.png` and `tmp/panel-qa/clinic-inbox-mobile.png`.

## Proposal tooth selection — 25 September 2026

- Added a lazy-loaded Three.js tooth selector: separate primary/permanent views, 20/32 selectable teeth, upper/lower arches, FDI labels, patient-side orientation, rotate/zoom/reset controls and whole-mouth selection. The supplied image guided the arch layout; it is not embedded or treated as instructions.
- Tooth numbers and names follow the [Australian Dental Association FDI notation tables](https://ada.org.au/media/iotfammk/ada_handbook_australian-schedule-and-dental-glossary-13th-edition.pdf). This is a procedural selection schematic, not patient-specific anatomy or an eruption/diagnostic model.
- The browser regression passed with software WebGL: direct 3D picking, drag without reassignment, child/adult switches, keyboard selection, `ALL`, selected-row removal, mixed-dentition draft reload and published revision persistence. Synthetic child 55 and adult 36 remained attached to their original procedure rows. A separate browser context disabled WebGL and verified that numbered selection still updates the FDI field.
- TypeScript and the optimized Next.js build passed. Desktop adult/child previews and the mobile layout were inspected. Preview images are in ignored `tmp/tooth-qa/`. The renderer loads only when the editor opens, redraws on interaction, and disposes its controls, observer, meshes, textures and WebGL context when closed or switched.

## Unverified / external boundaries

PostgreSQL/Docker execution, managed cloud deployment, notification delivery, payment processing, external LLM integration, clinical validation, production security/identity workflows, physical-device testing, signed native builds/store submission, and real patient data handling are not claimed as completed. iOS has only been bundle-checked: Xcode is not installed on this host, so no iOS simulator run was performed. Subscription and appointment updates persist local operational records; they do not send messages, charge cards, or create external bookings.

See `implementation-status.md` and the README route/workflow tables for the implemented scope.
