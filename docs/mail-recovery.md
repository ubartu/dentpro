# Password recovery and transactional mail

Feature branch: `codex/feature-password-reset`, based on `codex/project-baseline` (the previously completed Maps Embed and treatment-plan work). `main` is unchanged. The password-recovery changes can be reviewed against that baseline independently.

## User flow

Web clinic/admin users choose **Forgot your password?** on `/login`; patients choose the same action in the app. Enter the account email to request a reset. Every eligible/unknown/inactive address gets the same generic confirmation. The email opens the shared web `/reset-password` screen; patients can finish there and return to the app, or paste the email's token in the app's **Have a reset token?** screen. Password confirmation is required in both interfaces.

Links expire 30 minutes after the request and are single use. A new allowed request replaces older links. Resetting revokes all login sessions and queues a password-change notification without including the password. It never automatically signs the user in or reactivates suspended accounts. Changing the password/email, deactivating the account/clinic or rotating the reset secret invalidates pending links.

## API and provider boundary

| Endpoint | Behavior |
| --- | --- |
| `POST /auth/password/forgot` | `{ "email": "account@example.org" }`; generic 202, including per-email suppression. 503 if delivery configuration is unavailable. |
| `POST /auth/password/reset` | `{ "token": "email-link-token", "new_password": "..." }`; 200 on success, 400 for used/expired/unavailable links, 422 for invalid input. |
| `GET /admin/mail/status` | Admin-only provider readiness and aggregate pending/sending/sent/failed/cancelled job counts; no secret values or recipient list. |

The server's `mail_gateway.py` provides a reusable `send_mail` adapter for trusted transactional templates. There is no public arbitrary-recipient/message endpoint. Resend uses the fixed HTTPS `/emails` endpoint and a job-specific idempotency key; API keys never enter web/mobile public environment variables. `sent` means the provider accepted the message, not proof of inbox delivery. Bounce/delivery webhooks are not implemented.

The existing API worker processes email independently of the explanation pause setting. Jobs have an atomic 60-second claim lease, up to five attempts and delayed retries; expired claims are reclaimed. Unsent obsolete links are cancelled. Resend retries reuse the same template/token and idempotency key. Provider errors are reduced to `delivery_failed`; raw responses and link credentials are not logged or stored in job errors.

## Local test without sending email

In a terminal at the repository root:

```sh
export DENTPRO_MAIL_PROVIDER=file
export DENTPRO_MAIL_FROM=no-reply@dentpro.example
export DENTPRO_RESET_URL=http://127.0.0.1:3000/reset-password
export DENTPRO_RESET_SECRET="$(openssl rand -hex 32)"
.venv/bin/python scripts/dev.py
```

API and worker must share the same reset secret. The development-only file adapter writes private `.data/mailbox/<job-id>.eml` files (0600); open them in a mail reader for the decoded link. They contain real reset capabilities for your local accounts: keep them private. This adapter is rejected in cloud mode. It does not send an external message. Do not regenerate the secret until you intend to invalidate existing links.

For the repeatable browser regression, also set `DATABASE_URL=sqlite:///.data/password-recovery-qa.db` and `DENTPRO_MAILBOX_DIR=tmp/recovery-mailbox` **before starting**. Then run `npm run test:e2e:recovery` in another terminal. It creates only synthetic accounts in that isolated database and reads their local email files. The ordinary staff regression remains `npm run test:e2e`.

## Real delivery with Resend

1. Verify your sending domain with Resend's required DNS records and create a sending API key. Set `DENTPRO_MAIL_FROM` to a verified email address (plain address, without a display-name wrapper).
2. Set `DENTPRO_MAIL_PROVIDER=resend`, `DENTPRO_RESET_URL=https://YOUR_WEB_DOMAIN/reset-password`, and supply `RESEND_API_KEY` and `DENTPRO_RESET_SECRET` or their `_FILE` counterparts. Never set both forms of the same secret. Generate a cryptographically random reset secret of at least 32 characters. Restart API and worker with identical configuration.
3. Verify readiness through `/admin/mail/status`, then test delivery to your own approved test address. Actual provider/domain/deliverability has not been verified by the implementation tests.

References: [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## Portable cloud overlay and migration

Create ignored `secrets/resend_api_key` and `secrets/password_reset_secret` files, restrict their permissions to 0600, and add `DENTPRO_MAIL_FROM` to `.env.cloud`. `compose.mail.yaml` mounts them into API/worker only. The web host receives no mail/reset secrets. The overlay gives Caddy the private address `172.28.40.10` in `172.28.40.0/24` and tells Uvicorn to trust forwarded client addresses only from that IP. If it conflicts with your host network, change both `DENTPRO_PRIVATE_SUBNET` and `DENTPRO_PROXY_IP` to a suitable private subnet/address.

Fresh cloud databases initialize at schema **3**. For an existing schema **2**, back up first, stop the old API/worker, build the new images and explicitly migrate before starting them:

```sh
docker compose --env-file .env.cloud -f compose.cloud.yaml -f compose.mail.yaml build
docker compose --env-file .env.cloud -f compose.cloud.yaml -f compose.mail.yaml run --rm --no-deps api python -m dentpro.migrate_cloud_mail
docker compose --env-file .env.cloud -f compose.cloud.yaml -f compose.mail.yaml up -d
```

An existing Compose network must also be recreated when adopting this overlay's IPAM configuration: use `docker compose --env-file .env.cloud -f compose.cloud.yaml down` during the maintenance window before the commands above. Omit `--volumes` so Caddy's named certificate volumes are retained. A fresh stack needs no teardown.

For schema 1, run `dentpro.migrate_cloud_discovery` first (1 → 2), then `dentpro.migrate_cloud_mail` (2 → 3). The migration adds `password_resets`, `recovery_throttles` and `mail_jobs` only. Existing accounts/proposals are preserved. Startup rejects a missing/incomplete migration even if mail is disabled. The schema/data migration was tested on isolated SQLite; managed PostgreSQL/container execution remains unverified.

## Security and operational limits

- High-entropy UUIDs plus a server-only HMAC secret create bearer tokens. Only their SHA-256 hashes are stored; the worker reconstructs the same token for retries. Keep database and secret backups separate. Token consumption and password/session changes commit in one transaction; PostgreSQL account locks and conditional updates protect concurrent use.
- Links use a URL **fragment**, which never reaches the web server. The reset page removes it from browser history after loading, handles React Strict Mode, uses the portal's `no-referrer` policy and includes no third-party tracking. Recovery API success/error responses are `no-store`. Password fields are not part of email bodies or audit records.
- Shared limits: three requests per email per 30 minutes (silently suppressed), 30 request attempts per client IP per 15 minutes, and 30 completion attempts per IP / 10 per token per 15 minutes. Email/token/IP keys are hashed. A common response-time floor reduces straightforward account enumeration. Timing under real network/database load and PostgreSQL concurrency still need deployment testing.
- IP comes from the ASGI client address, never directly from an arbitrary header. Configure the ingress/ASGI server to trust forwarded addresses **only from your actual proxy**; do not expose API directly with universally trusted forwarding. Add edge abuse controls and provider quotas for deployment scale.
- This is account recovery, not email ownership verification during registration, MFA recovery or privileged-user MFA. Metadata contains account IDs and recipient email snapshots; set retention, backup access and incident-response rules before production. Expired records cannot reset a password but are not automatically purged yet.
- Provider-disabled mode returns 503 rather than claiming a message was queued. Mail failures do not roll back a completed password change; the notification remains queued for retry. Failed jobs are visible in aggregate status; delivery/bounce monitoring and operational replay tooling remain release work.
