# Security policy

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/dedwrite/LocalizationHub/security/advisories/new). If it is unavailable, contact the existing project support address: **support@localizationhub.app**. Do not disclose credentials, private project data or working exploit details in a public issue.

Include the affected version, impact, minimal synthetic reproduction and suggested mitigation if known. Redact tokens and user information. Do not test against production accounts or projects without explicit authorization. No response-time or bounty commitment is made.

## Supported fixes

Security fixes target the current `main` branch and latest stable release. Older releases are not maintained as separate security branches. Upgrade after reviewing release notes and backing up local projects.

## Boundaries

Local projects do not require Cloud accounts. Cloud projects require authenticated, authorized access; Owner, Editor and Viewer roles remain enforced by the backend. Admin access additionally requires email verification and MFA. Public source and public installers do not grant access to user data.

Public API/WebSocket URLs in `frontend/.env.production` are intentional client configuration, not credentials. Never put private values in `VITE_*` variables: they are embedded in client builds.

If a real secret is exposed, deleting the current file is not enough. Notify the maintainer privately, revoke or rotate it with authorization, and coordinate any history cleanup. Never force-push or invalidate production security keys as an unsolicited fix.

Windows installers are currently unsigned. Check the published SHA-256 checksum and use only official releases. A checksum checks file integrity; it is not a digital signature.
