# LIFEOS Release Checklist

Use this checklist for every staging and production release.

## API and worker

- [ ] Production secrets and database configuration are present.
- [ ] Database migrations are applied successfully.
- [ ] `/health` and `/ready` both return healthy responses.
- [ ] Authentication and rate limits are verified.
- [ ] Account export contains user data but no OAuth ciphertext.
- [ ] Account deletion requires explicit confirmation and removes user-owned storage.
- [ ] Concurrent sync requests do not create duplicate active jobs.
- [ ] Worker retries transient provider failures and shuts down gracefully.
- [ ] Stuck sync recovery has been verified.

## Google integrations

- [ ] OAuth callback uses the configured HTTPS redirect URI.
- [ ] OAuth state cannot be reused or replayed.
- [ ] Calendar, Drive and Gmail imports work with a real staging account.
- [ ] Contacts pagination works.
- [ ] Photos metadata import works with a real staging account.
- [ ] Token refresh works after access-token expiry.
- [ ] Disconnect/reconnect and deduplication work.

## Web/PWA

- [ ] `VITE_API_URL` points to the staging/production API.
- [ ] Login, logout and session restoration work.
- [ ] Dashboard, timeline, inbox, finance and automations load without console errors.
- [ ] Search and assistant requests remain user-scoped.
- [ ] Document upload, download and delete work.
- [ ] PWA manifest/icons load correctly over HTTPS.

## Mobile

- [ ] `EXPO_PUBLIC_API_URL` points to a device-reachable HTTPS API.
- [ ] Android and iOS release builds are signed.
- [ ] Secure token storage survives app restart.
- [ ] Login/logout and session expiry work on physical devices.
- [ ] Timeline, inbox, overview and integrations load on Android and iOS.
- [ ] Offline behavior is tested before claiming offline-first support.
- [ ] Push notification behavior is tested before store launch.

## Data and operations

- [ ] Production object storage is durable and private.
- [ ] PostgreSQL backups are enabled and a restore drill succeeds.
- [ ] Redis is configured for production availability requirements.
- [ ] Monitoring covers API errors, authentication failures, database health, worker failures and queue depth.
- [ ] Logs do not expose tokens, passwords or unnecessary personal data.
- [ ] Data retention/deletion policies are documented.
- [ ] Rollback procedure is tested.

## Final gate

Do not mark LIFEOS production-ready solely because the repository builds. The final gate requires successful staging validation with real provider credentials and, for mobile, real Android/iOS devices.
