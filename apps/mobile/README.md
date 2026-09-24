# DENTpro patient app

React Native / Expo SDK 57 application for iOS and Android. The existing Next.js clinic/admin panels remain separate. All patient screens use the shared FastAPI service and persisted records; there is no patient web route.

## Run locally

Requirements: Node 22.13+ (Expo SDK requirement), Python environment from the root README, and Expo Go for SDK 57 or a matching development build. Run `npm ci` from the repository root.

1. From the repository root: `.venv/bin/python scripts/dev.py`.
2. From the repository root: `npm run mobile`.
3. Use Android/iOS in the Expo CLI, or scan the QR code on a phone. Since `expo-dev-client` is installed, press `s` to switch to Expo Go for a bundled-module preview, or run `npm run mobile -- --go`.
4. Create a patient account in the app. Patient accounts are distinct from staff accounts; seeded clinic/admin credentials cannot sign into the patient app.

Default API addresses are `http://10.0.2.2:8000` for the Android emulator and `http://127.0.0.1:8000` for the iOS simulator. On a physical device:

- Copy `.env.example` to `.env.local` in this directory and set `EXPO_PUBLIC_API_URL` to your computer's LAN address.
- Start the backend from the repository root with `DENTPRO_API_HOST=0.0.0.0 .venv/bin/python scripts/dev.py`.
- Keep the phone and computer on the same trusted network. Restart Expo after changing environment variables.
- Use synthetic data. The backend still rejects production startup. Never expose this evaluation server to the public internet.

## Implemented screens

- Sign in / register with distinct patient identity and secure native token storage.
- My cases, case creation and versioned sharing consent.
- PNG/JPEG/PDF document selection, upload progress, authenticated image preview and system file sharing.
- Clinic selection by case region, accepting-clinic filtering and configurable recipient limits.
- Proposal source items, preliminary prices, material/session/visit details and availability.
- Separate template explanation, missing information and questions, with pending/failed/paused behavior.
- Horizontal objective comparison, preserving different treatment scopes and preliminary-price notices.
- Callback/appointment requests with confirmation before contact sharing.
- Request status, clinic-confirmed times and patient cancellation.
- Profile editing, password changes with all-session revocation, and sign out.

Screens refresh on focus, return from background, pull-to-refresh and every 15 seconds while focused/active. Network failures are shown explicitly; this is not an offline record store or a push notification system. Server rejection prevents stale/withdrawn/flagged proposals from being booked. Source patient data is never sent to an LLM by the app.

Case creation sends an idempotency key. An uncertain network failure keeps the same payload and key for an in-screen retry. After leaving the screen or restarting, inspect My cases before starting another case. Appointment creation is deduplicated on the server per patient/proposal. File uploads are allowed only before sharing.

## Shared contracts and checks

From the repository root:

```sh
PYTHONPATH=services/api .venv/bin/python scripts/export_contracts.py
npm run contracts:mobile
npm run mobile:typecheck
npm run mobile:lint
npm run mobile:test
npm run mobile:export
PYTHONPATH=services/api .venv/bin/pytest services/api/tests -q
npm run typecheck
```

`packages/contracts/mobile.ts` is generated from the exported OpenAPI schema. Keep it in sync when API contracts change. The contracts tooling has its own TypeScript dependency because its generator currently requires TypeScript 5; the mobile compiler uses Expo's TypeScript 6 template version. Shared React and native peer versions are pinned at the repository root to prevent npm from selecting incompatible auto-peers. Metro also resolves native React imports through the mobile workspace. Web and mobile currently use React 19.2.3.

## Native builds and release

`app.config.ts` configures the scheme, native icons, permissions and bundle identifiers. `eas.json` provides development, preview and production profiles. The identifiers `com.dentpro.patient` are proposed identifiers; confirm ownership before store registration.

After connecting your Expo project/account, from this directory:

```sh
npx eas-cli@latest build --platform android --profile development
npx eas-cli@latest build --platform ios --profile development
```

For store builds, configure an HTTPS `EXPO_PUBLIC_API_URL` in the EAS production environment and complete the backend release requirements first. The app refuses non-HTTPS API configuration in release JavaScript; Android cleartext traffic is enabled only outside the production build profile. Local development and preview packages must use a reachable API endpoint.

Apple signing/TestFlight/App Store and Google Play distribution require the respective developer accounts and credentials. EAS builds and store submission are not performed automatically by this project.

## Remaining production integrations

- Email verification, forgotten-password recovery, account deletion/retention workflow, abuse controls and production identity/session hardening. Registration/login/profile/password change work locally; no email service is connected.
- Signed cloud storage, upload content scanning, retention/deletion and the existing database/deployment hardening work.
- Push delivery and device token registration, external SMS/email, production monitoring and store privacy declarations.
- Live LLM provider and clinical validation. Explanations currently come from deterministic glossary templates.
- Signed native build testing on physical iOS/Android devices and store review.

See `docs/mobile-implementation-baseline.md` for the product requirements and `docs/verification.md` for actual executed checks. Do not treat an exported JavaScript bundle or mocked component test as evidence of device or store acceptance.
