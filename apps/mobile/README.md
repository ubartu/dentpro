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
- Use synthetic data. Do not expose the development server to the public internet; the separate [cloud staging guide](../../../docs/cloud-deployment.md) describes its HTTPS deployment boundary.

### Try it on an iPhone

Expo SDK 57 requires iOS 16.4 or newer. Install Expo Go on the iPhone, then sign in to the same Expo account in Expo Go and on the Mac (`npx expo login` from `apps/mobile`). Expo requires matching accounts when opening an Expo Go project on a physical iPhone.

Connect the Mac and iPhone to the same Wi-Fi network. On the Mac, find its local IP address with `ipconfig getifaddr en0` (or check the active network interface), then run these in separate terminals:

```sh
# Repository root: start the local API, worker, and staff web app.
DENTPRO_API_HOST=0.0.0.0 .venv/bin/python scripts/dev.py

# apps/mobile: replace the example IP with the Mac's current local IP.
EXPO_PUBLIC_API_URL=http://192.168.1.7:8000 npx expo start --go --lan
```

Scan the QR code from Expo Go on the iPhone. Check `http://<Mac-IP>:8000/health` in iPhone Safari if the app cannot reach the API. The example IP changes between networks. Stop both terminals with Ctrl+C when finished. This is an Expo Go development preview; installing a signed standalone iOS app requires an EAS iOS build and Apple signing.

### Try it in the Android emulator

Start the API with `.venv/bin/python scripts/dev.py` from the repository root. In another terminal, add the installed Android SDK tools to your current shell, list available virtual devices, and start one:

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
emulator -list-avds
emulator -avd Pixel_3a_API_34_extension_level_7_arm64-v8a
```

The AVD name above is the one installed on this Mac; use a name from `emulator -list-avds` on another machine. Keep the emulator terminal open. Once `adb devices` shows a device, run this from `apps/mobile` in a third terminal (with the same `ANDROID_HOME` and `PATH` exports):

```sh
export ANDROID_HOME="$HOME/Library/Android/sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"
NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --go --android --localhost
```

The Android emulator reaches the local API at `10.0.2.2:8000` by default. The IPv4 Node option avoids a macOS `--localhost` case where Metro listens on IPv6 while `adb reverse` expects IPv4. Restart Metro after dependency installation so its resolver uses the current workspace layout.

## Implemented screens

- Sign in / register with distinct patient identity and secure native token storage.
- My cases, case creation and versioned sharing consent.
- PNG/JPEG/PDF document selection, upload progress, authenticated image preview and system file sharing.
- Optional foreground location access, approximate nearby-clinic ranking within 30 km, a complete list of active participating clinics, and configurable recipient limits. A region is not requested when creating a case. Location permission denial does not block clinic selection.
- Proposal source items, preliminary prices, material/session/visit details and availability.
- Separate plain-language explanation, missing information and questions, with pending/failed/paused behavior and clear AI/template/fallback source labels.
- Horizontal objective comparison, preserving different treatment scopes and preliminary-price notices.
- Callback/appointment requests with confirmation before contact sharing.
- Request status, clinic-confirmed times and patient cancellation.
- Profile editing, password changes with all-session revocation, and sign out.

Screens refresh on focus, return from background, pull-to-refresh and every 15 seconds while focused/active. Network failures are shown explicitly; this is not an offline record store or a push notification system. Server rejection prevents stale/withdrawn/flagged proposals from being booked. The mobile app never calls an LLM directly. If the server-side gateway is configured, it sends only canonical structured clinic-plan fields and a template summary; no X-ray, patient identifier, contact detail or clinic free-text note is included.

Case creation sends an idempotency key. An uncertain network failure keeps the same payload and key for an in-screen retry. After leaving the screen or restarting, inspect My cases before starting another case. Appointment creation is deduplicated on the server per patient/proposal. File uploads are allowed only before sharing.

The nearby section uses straight-line distance from clinic coordinates. Patient coordinates stay on the device; the server receives only the selected clinic IDs. Admins can enter a clinic's latitude and longitude together in its profile. Clinics without coordinates remain in the complete list but cannot appear in the nearby section. The four seeded demo clinics have approximate district-centre coordinates, not precise clinic locations.

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

## Patient UI design

The patient interface uses blue tones, bundled Inter fonts and the supplied Figma login and meditation-app layout references. Home, Requests and Profile remain the three primary tabs; longer X-ray and explanation details expand on demand. Loading during startup, session restoration and sign-in/registration rotates the supplied tooth logo with reduced-motion support. Its source image is stored at `assets/dentpro-logo-original.jpeg`, the app-ready square asset at `assets/dentpro-brand-square.png`, and a version with more safe margin for Android adaptive icons at `assets/dentpro-brand-adaptive.png`. See [design sources](assets/figma/README.md) for the other reference nodes and asset provenance.

## Remaining production integrations

- Email verification, forgotten-password recovery, account deletion/retention workflow, abuse controls and production identity/session hardening. Registration/login/profile/password change work locally; no email service is connected.
- Dedicated cloud object storage at scale, upload content scanning, retention/deletion and managed database backup/restore verification. Cloud staging currently stores bounded private images in PostgreSQL.
- Push delivery and device token registration, external SMS/email, production monitoring and store privacy declarations.
- The optional OpenAI proposal-summary gateway is implemented but disabled by default. No live-provider call, clinical quality evaluation or dentist approval of its output has been completed. The template interpreter remains the default and fallback.
- Signed native build testing on physical iOS/Android devices and store review.

See `docs/mobile-implementation-baseline.md` for the product requirements and `docs/verification.md` for actual executed checks. Do not treat an exported JavaScript bundle or mocked component test as evidence of device or store acceptance.
