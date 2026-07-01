# Sales Manager AI — Gmail inbox integration

Sales Manager AI can check a user's Gmail inbox (read-only) when they ask in chat, e.g. *"Check my email for customer replies"*.

## Google Cloud setup

1. Create or use a Google Cloud project.
2. Enable **Gmail API**.
3. Configure **OAuth consent screen** (Internal for Workspace, or External with test users).
4. Create **OAuth 2.0 Client ID** (Web application).
5. Add authorized redirect URI:
   - Production: `https://api.loopcstrategies.com/api/email/oauth/gmail/callback`
   - Local: `http://localhost:5000/api/email/oauth/gmail/callback`

## Railway environment variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | Must match Google console (optional if `API_PUBLIC_URL` is set) |
| `EMAIL_TOKEN_ENCRYPTION_KEY` | 64-char hex or passphrase for AES-256-GCM token storage |
| `EMAIL_OAUTH_STATE_SECRET` | Optional HMAC secret for OAuth state (defaults to encryption key) |
| `EMAIL_FETCH_RATE_LIMIT` | Max inbox fetches per user per hour (default: 10) |
| `API_PUBLIC_URL` | Public API base, e.g. `https://api.loopcstrategies.com` |

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Scope

- Read-only: `https://www.googleapis.com/auth/gmail.readonly`
- LoopC tenant only (same gate as Sales Manager AI)
- Per-user connection (not shared team inbox)

## User flow

1. Open Sales Manager AI widget on LoopC.
2. Click **Connect Gmail** (or ask to check email when not connected).
3. Complete Google sign-in; redirect returns to dashboard.
4. Use **Check email** quick action or type a natural-language request.

## Phase 2

Outlook / Microsoft 365 via Microsoft Graph uses the same `emailInboxService` interface (`outlookProvider.js` stub today).
