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

## Promote an Administrator

1. Register the intended account through the normal application flow. Confirm the email address belongs to the person who will administer the application.
2. Connect to the same production database configured by `MONGODB_URI` using an approved MongoDB access method. Do not paste database credentials into a shared terminal or commit them.
3. Select the application database and run the following in `mongosh`, replacing the example email:

	 ```javascript
	 const email = 'admin@example.com'.trim().toLowerCase();
	 const user = db.users.findOne(
		 { email },
		 { email: 1, role: 1, isBlocked: 1 }
	 );

	 if (!user) throw new Error('No user found for that email.');
	 if (user.role && user.role !== 'user') throw new Error(`Unexpected current role: ${user.role}`);
	 if (user.isBlocked) throw new Error('Unblock the account before promoting it.');

	 const result = db.users.updateOne(
		 { _id: user._id, role: { $in: ['user', null] } },
		 { $set: { role: 'admin' } }
	 );
	 if (result.modifiedCount !== 1) throw new Error('Promotion did not update exactly one user.');

	 db.users.findOne(
		 { _id: user._id },
		 { email: 1, role: 1, isBlocked: 1 }
	 );
	 ```

4. Verify the result shows the intended email, `role: 'admin'`, and `isBlocked: false`. Record the operator and change in the deployment/change log because direct database updates do not pass through application audit logging.
5. Sign in at `admin-login.html` with that account and verify the protected admin pages open. Public registration must continue to create only `user` roles.

To revoke access, connect to the same database and run `db.users.updateOne({ _id: ObjectId('<user-id>'), role: 'admin' }, { $set: { role: 'user' } })`; verify `modifiedCount` is `1`. The backend loads the current role from MongoDB on each authenticated request, so the demotion takes effect on the next request.

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
