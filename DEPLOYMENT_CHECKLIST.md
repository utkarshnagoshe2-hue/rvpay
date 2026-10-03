# Deployment Checklist

## Before Deploying

- [ ] Select a supported Node.js LTS version; run `npm install` once locally to generate `package-lock.json`, then commit it.
- [ ] Use `npm ci` for clean, reproducible deployment installs.
- [ ] Configure environment variables in the host's secret manager; do not commit `.env` files or real secrets.
- [ ] Set `NODE_ENV=production` and `RETURN_PASSWORD_RESET_TOKEN=false`.
- [ ] Set `FRONTEND_ORIGIN` to the exact HTTPS Vercel origin, with no path or trailing slash; production startup rejects placeholders.
- [ ] Set `MONGODB_URI` to a production MongoDB database with TLS, a least-privilege database user, and network access limited to the application host.
- [ ] Generate a unique `JWT_SECRET` with at least 32 characters.
- [ ] Generate a unique 32-byte `ACCOUNT_ENCRYPTION_KEY` (64 hexadecimal characters); keep a secure backup and do not rotate it without a data re-encryption plan.
- [ ] Confirm the host's `PORT` is passed through and the process binds to it.
- [ ] Back up the database before the first deploy. Startup migrates plaintext account numbers to encrypted values; verify this migration in staging first.
- [ ] Promote the intended administrator in MongoDB after registering that account; do not expose admin role assignment through public registration.

## Production Readiness Blockers

- [x] Restrict CORS to the exact configured production frontend origin; development allows localhost origins only.
- [ ] Use a shared rate-limit store before running multiple instances; the current rate limiter uses its default in-memory store. Render proxy trust is configured for one hop.
- [ ] Add a real email/SMS delivery provider for password resets. The current reset API creates tokens but does not deliver them.
- [ ] Prevent users from setting their own transactions to `Success` or `Failed`; accept final statuses only from a trusted payment provider/webhook or authorized operations role.
- [x] Passwords are not persisted in browser storage; JWT credentials remain in `sessionStorage`.
- [x] Account APIs return only the final four account-number digits; encryption remains applied at rest.
- [ ] Add security headers (for example, Helmet), HTTPS enforcement, and production error monitoring.
- [ ] Confirm audit-log retention, access controls, backup, and alerting policies.

## Deploy and Verify

- [ ] Deploy to a staging environment first and verify MongoDB connectivity and collection/index initialization.
- [ ] Verify `GET /api/health` returns `{"status":"ok"}`.
- [ ] Register a test user and verify duplicate email/mobile registration is rejected.
- [ ] Log in with email and mobile; verify wrong credentials and blocked users are rejected.
- [ ] Verify protected endpoints return `401` without a JWT and admin endpoints return `403` for non-admin users.
- [ ] Create, list, update, and delete an account; verify the stored account number is encrypted in MongoDB and API output is handled as expected.
- [ ] Create a transaction and verify it persists across an application restart; test allowed status changes and invalid statuses.
- [ ] Edit a profile and verify the update persists in MongoDB.
- [ ] Verify login, account creation, transaction creation, and profile/admin changes appear in audit logs without passwords, tokens, or full account numbers.
- [ ] Verify rate limits return `429` and expose standard rate-limit headers.
- [ ] Check deployment logs for migration, index, database, or encryption-key errors.
- [ ] Confirm the process restarts automatically and the health check is configured in the hosting platform.
- [ ] Confirm `api.js` points to the exact Render URL assigned to the backend service before deploying the frontend.
