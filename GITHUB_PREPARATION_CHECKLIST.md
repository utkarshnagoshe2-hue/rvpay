# GitHub Preparation Checklist

## Repository Hygiene

- [ ] Confirm `.gitignore` is at the repository root and excludes `.env`, `.env.*`, `node_modules/`, logs, local databases, and build/test output.
- [ ] Confirm `.env.example` and `.env.production.example` contain placeholders only and remain trackable.
- [ ] Search tracked files and Git history for passwords, MongoDB URIs, JWT secrets, encryption keys, API keys, reset tokens, and customer data.
- [ ] If a secret was ever committed, revoke/rotate it; deleting the file in a later commit does not remove it from history.
- [ ] Do not commit `.env`, database dumps, account data, or generated encryption keys.

## Build and Project Metadata

- [ ] Generate `package-lock.json` with `npm install` and commit it.
- [ ] Verify `npm ci` and `npm start` work from a clean checkout.
- [ ] Document the supported Node.js LTS version and required environment variables.
- [ ] Confirm no local-only API URLs remain in frontend files; update the API base URL to the actual deployed Render service URL.
- [ ] Confirm the repository has no unexpected binaries, editor workspaces, or local build outputs.

## Source and Access

- [ ] Add an appropriate repository license if required by the project owner.
- [ ] Protect the default branch and require review for changes to authentication, encryption, and deployment configuration.
- [ ] Enable GitHub secret scanning and dependency/security alerts where available.
- [ ] Limit repository access to maintainers who need it.
- [ ] Verify CI or local pre-push checks cover syntax, tests, and dependency installation before deployment.
