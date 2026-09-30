# Clinic details and Google Maps Embed

In the patient app, open a case's clinic selector and tap **View clinic details**. The new screen shows the clinic's address, description, phone, hours and clinic-supplied social links. A linked clinic automatically loads an interactive Google map when this screen opens. **View full Google profile** opens Google Maps outside the app for available ratings, reviews and photos. An unlinked clinic instead offers a name/address search.

The clinic list does not call the paid Places lookup endpoint. The map does contact Google when opened; it is not an offline snapshot or a database cache of ratings/photos. Google controls the embedded map contents; a review/gallery panel inside the embed is not guaranteed. [Maps Embed overview](https://developers.google.com/maps/documentation/embed/get-started) and [embedding guide](https://developers.google.com/maps/documentation/embed/embedding-map).

## Activation

1. Enable **Maps Embed API** in a Google Cloud project and create a separate browser key. Restrict it to **Maps Embed API** and website referrers for the deployed web origin, such as `https://portal.example.com/*`. Do not reuse the server-only Places key. The Embed key is necessarily visible in the iframe URL.
2. Locally, set `GOOGLE_MAPS_EMBED_KEY=...` in `apps/web/.env.local` and restart the web server. Alternatively provide `GOOGLE_MAPS_EMBED_KEY_FILE` to its process. Use a separate development key restricted to the local origins you actually use; the Android emulator uses `http://10.0.2.2:3000/*`.
3. Set `EXPO_PUBLIC_MAPS_WEB_URL=https://portal.example.com` in the mobile environment and rebuild/restart its bundle. For a physical device during development, use your computer's LAN URL instead of localhost. Android emulator development defaults to `http://10.0.2.2:3000`; release builds require an explicit HTTPS URL.
4. In **Admin → Clinics → clinic details → Google Maps & social profiles**, save the verified Place ID belonging to that physical clinic. Social profiles are separately supplied by the clinic/admin.

Without a key, a reachable web host or a verified Place ID, clinic details and the external Google Maps link still work. Map HTTP/network errors show a fallback and retry action. An invalid provider key can produce an error inside Google's iframe: check the key restrictions with a real listing before release.

## Portable cloud stack

Put the restricted browser key in the ignored `secrets/google_maps_embed_key` file, then include this overlay alongside the existing cloud stack:

```sh
docker compose --env-file .env.cloud -f compose.cloud.yaml -f compose.maps-embed.yaml up -d --build
```

Use the same environment file used for your existing cloud domain configuration. The overlay mounts the Embed key only into the web service. The paid Places overlay is not required for this feature.

## Data and loading boundaries

- `GET /patient/clinics/{id}` requires a patient session and returns only active clinic directory fields, including the admin-mapped Place ID and validated social links. It returns 404 for unavailable clinics.
- The public `/clinic-map?place_id=...` web route renders a fixed Google iframe. It validates the Place ID, sends no patient location, case details, images or session token, and uses `Cache-Control: no-store`.
- The native WebView receives only the map-page URL, with no API authorization headers. Unexpected top-level navigation is blocked; the explicit profile button opens a fixed Google Maps URL externally.
- The wrapper's referrer policy sends its origin to Google's iframe for website-key restrictions. Its content security policy limits child frames to Google; camera, microphone and geolocation are disabled for the wrapper.
- No Google rating, review or photo cache was added. Existing optional Places gateway endpoints remain separate and disabled by default.

Automated tests use synthetic keys and mocked WebViews. Live Google loading/restrictions and physical-device rendering require a configured key and release testing.
