# Clinic discovery: Google Places API (New)

The optional server gateway supports on-demand Google ratings/photos and separately labelled clinic-supplied social profiles. The patient selector now opens [clinic details with Maps Embed](maps-embed-integration.md) instead of invoking this paid gateway. The gateway and its reusable display component remain available for a future explicit integration. It does not automatically match businesses by name, rank clinical quality, or invent data for demo clinics. No live provider call has been made during implementation.

## Configure

1. Create a Google Cloud project, enable **Places API (New)** and billing. Restrict the key to that API and your server's egress IPs; set provider quotas and billing alerts. Ratings/website fields and photo requests can incur charges. Never put the key in `EXPO_PUBLIC_` or `NEXT_PUBLIC_` variables.
2. In the local API process environment set `DENTPRO_GOOGLE_PLACES_ENABLED=true` and either `GOOGLE_PLACES_API_KEY` or `GOOGLE_PLACES_API_KEY_FILE`. Restart the API. The app makes no direct key-bearing Google request.
3. In Admin → Clinics → clinic details → **Google Maps & social profiles**, save the verified Google Place ID. Confirm the listing belongs to the same physical clinic. Only the Place ID and clinic-owned social links are stored. Clinic staff can edit their own social profiles in Clinic → Profile; they cannot replace the Google mapping.
4. The gateway can be called through the authenticated patient discovery endpoint, but the current clinic selector does not invoke it. Social links and the external Google profile link work independently of paid Places configuration. See the Maps Embed guide for the current app flow.

Google Places documents `rating`, `userRatingCount`, `photos`, `websiteUri` and `googleMapsUri`; it does **not document a social-network profile field**. The integration does not scrape websites or assume a Google website is an Instagram account. Social profiles therefore come from validated HTTPS URLs supplied by clinic staff/admin.

## API boundary

- `PUT /admin/clinics/{id}/discovery`: admin-only mapping and social links.
- `PUT /clinic/discovery`: tenant-scoped social links only.
- `GET /patient/clinics/{id}/google-profile`: patient-authenticated, active participating clinics only; no arbitrary Place ID accepted from the app.
- `GET /admin/clinics/{id}/google-profile`: authenticated preview for a saved mapping.
- `GET /admin/integrations/google-places`: non-secret readiness.
- The adapter calls only fixed Google HTTPS endpoints, uses a narrow field mask, a six-second timeout per call and at most one photo. Photo failure preserves the rating. Each account is limited to 30 lookups per 15 minutes; PostgreSQL advisory locks serialize usage updates across API replicas. Provider/global quotas and ingress controls are still needed.

## Provider attribution and privacy

Google content, photo resource names and photo URIs are not persisted in the database or server cache. Responses use `Cache-Control: no-store`; the mobile view retains data only while displaying the screen and sets photo/author-avatar `cachePolicy="none"`. The official unmodified Google Maps attribution logo is bundled at `apps/mobile/assets/google-maps-logo.png` (DarkGray 4x asset from Google's attribution ZIP). The UI includes available photo-author name/avatar/profile links, the source Maps link, provider attributions and a note separating user ratings from clinical assessment. Patient location and case/X-ray data are not sent to Google by this gateway. Loading an image or opening an external link contacts that provider from the device.

Before activating the integration in a publicly used app, publish accessible Terms of Use and a Privacy Policy incorporating Google's required terms, check the terms applicable to the billing region, and verify attribution rendering with real responses. No raw Google review text, review summaries or additional photo gallery is implemented.

## Cloud staging

Fresh cloud databases use schema version **2**. For an already deployed version 1 database, back it up, stop API/worker, then run the one-time additive migration with the new image before restarting:

```sh
docker compose --env-file .env.cloud -f compose.cloud.yaml stop api worker
docker compose --env-file .env.cloud -f compose.cloud.yaml build api worker
docker compose --env-file .env.cloud -f compose.cloud.yaml run --rm --no-deps api python -m dentpro.migrate_cloud_discovery
```

Create the ignored `secrets/google_places_api_key` file with restrictive permissions. Activate the optional overlay:

```sh
docker compose --env-file .env.cloud -f compose.cloud.yaml -f compose.google-places.yaml up -d --build
```

Only API receives this secret; the explanation worker and web image do not. Managed PostgreSQL migration, live Google credentials/quotas, actual photo delivery and physical-device integration remain unverified.

References: [Place Details](https://developers.google.com/maps/documentation/places/web-service/place-details), [Place Photos](https://developers.google.com/maps/documentation/places/web-service/place-photos), [Policies and attribution assets](https://developers.google.com/maps/documentation/places/web-service/policies), [Place schema](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places).
