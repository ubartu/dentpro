# Cloud staging deployment (synthetic data only)

This repository now has a portable Docker deployment for **synthetic evaluation**. It is not approved for real patient records or clinical production. The stack runs a Next.js staff portal, FastAPI, one explanation worker and a Caddy HTTPS edge. Use an empty, managed PostgreSQL database. The API and worker have no public host ports; Caddy is the only ingress. Patient mobile release builds must target the public HTTPS API domain.

## Security review and implemented controls

| Area | Cloud staging behavior | Remaining requirement before real patient use |
| --- | --- | --- |
| Demo identities | No `/demo/session/*` route, no demo bearer token, no seeded passwords/cases; cloud startup rejects a reused local/demo database | Verified staff and clinic onboarding, MFA for privileged users, account recovery |
| Database | Requires PostgreSQL with certificate and hostname verification (`sslmode=verify-full`); empty schema initialized once and version checked on restart | Reviewed migrations, encrypted managed backups, restore drills, least-privilege DB role |
| X-ray storage | Uploads are bounded to the configured 10 MB maximum and stored in the private database, not ephemeral container storage; downloads remain role/case scoped and `no-store` | Malware/file-content scanning, retention/deletion policy, storage capacity planning and a privacy review |
| Authentication | New passwords use Argon2id; old local PBKDF2 hashes remain verifiable and are upgraded on sign-in. Sessions are opaque, hashed in PostgreSQL, expire after 12 hours and are revocable. Cloud sign-in limits failed attempts per identifier to 10 per 15 minutes across API replicas | IP-based login/registration limits at ingress, MFA, email/phone verification and abuse monitoring |
| Network | Automatic HTTPS at Caddy; explicit HTTPS CORS origin; API docs disabled in cloud mode; request body limit and security headers | DNS and certificate monitoring, firewall rules, edge WAF/IP rate limits, a reviewed Content Security Policy and vulnerability scans |
| Secrets | Database URL and CA bundle are mounted as Docker secrets, excluded from image context and Git. Web build receives only the public API URL. AI provider stays in template mode | Managed secret store, credential rotation, optional AI privacy review |
| Operations | API health includes a DB query; cloud containers run with restricted capabilities and non-root API/web users | Centralized monitoring, alerting, backup/restore, incident response, penetration test and applicable privacy-law review |

These remaining controls are material. Do not infer medical or regulatory compliance from a successful container build.

## Prepare a staging host

1. Provision a **new empty** managed PostgreSQL database with TLS, encrypted storage/backups and network access only from the host or its private network. Create a dedicated application role with privileges only on its own database. Obtain the provider's CA certificate.
2. Point two public DNS names at the host, for example `staff.example.com` and `api.example.com`. Open inbound TCP 80/443 and UDP 443 to Caddy only. Do not publish PostgreSQL, API port 8000 or web port 3000.
3. Copy `.env.cloud.example` to `.env.cloud` and set both domain names. Create `secrets/database_url` with the PostgreSQL URL and `secrets/db-ca.pem` with the provider CA. A URL shape is `postgresql+psycopg://USER:ENCODED_PASSWORD@HOST:5432/DB?sslmode=verify-full&sslrootcert=/run/secrets/db_ca`; URL-encode reserved password characters. Set permissions to `0600` on these files. They are ignored by Git and Docker build context.
4. Validate and start from the repository root:

```sh
docker compose --env-file .env.cloud -f compose.cloud.yaml config --quiet
docker compose --env-file .env.cloud -f compose.cloud.yaml up -d --build
docker compose --env-file .env.cloud -f compose.cloud.yaml exec api python -m dentpro.bootstrap_admin
```

The bootstrap command asks for an administrator email and password interactively; it refuses to add a second administrator. Sign into `https://staff.example.com/login`. Check `https://api.example.com/health` and that `https://api.example.com/demo/session/patient` and `/docs` are unavailable. The first API start creates only the versioned base schema, procedure glossary and platform settings. It never creates the local demo accounts or cases.

Build the patient app with `EXPO_PUBLIC_API_URL=https://api.example.com`. The URL is public; API keys and database credentials must never use an `EXPO_PUBLIC_` or `NEXT_PUBLIC_` variable. A release build already rejects a non-HTTPS mobile API URL.

## Deployment boundaries

- `APP_ENV=development` retains the local SQLite/demo workflow. `APP_ENV=cloud` requires the managed database, explicit HTTPS CORS origin and fresh cloud schema. Any other value fails startup. Existing local SQLite or PostgreSQL demo data cannot be promoted in place.
- Cloud mode currently initializes **schema version 3 only on an empty database**. The [Google Places guide](google-places-integration.md) includes the additive v1-to-v2 migration; the [mail recovery guide](mail-recovery.md) documents v2-to-v3 and the optional Resend secret overlay. Existing databases require both applicable migrations before upgrading. The API refuses an unknown/incomplete schema. Back up and test restore before upgrades.
- Uploaded bytes are stored in PostgreSQL `bytea` for portable staging. This is intentionally simple and bounded, but database growth needs monitoring. A dedicated private object store, access logging and scanning are appropriate before production scale.
- The AI provider is disabled in the Compose stack. All generated text remains the deterministic glossary/template output. No external X-ray/LLM processing is enabled.
- No cloud service, domain, database or certificate was provisioned by these files. The Compose configuration and local tests can be verified without deploying; an end-to-end container/cloud test requires a Docker daemon and a managed database.
