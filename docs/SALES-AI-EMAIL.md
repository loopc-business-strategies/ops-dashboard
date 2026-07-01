# Sales Manager AI — Gmail inbox integration

Sales Manager AI can check email when users ask in chat, e.g. *"Check my email for customer replies"*.

## Connection models

| Model | Who connects | Who can read | LoopC today |
|-------|----------------|--------------|-------------|
| **Company inbox (tenant)** | `super_admin` once, as the company mailbox | All Sales AI users on that tenant | **Yes** — `business@loopcstrategies.com` |
| **Personal inbox (user)** | Each user connects their own Gmail | Only that user | Used when tenant has no `sharedInboxEmail` |

### LoopC company inbox

1. Super admin opens Sales Manager AI on LoopC
2. Clicks **Connect company Gmail**
3. Signs in to Google as **`business@loopcstrategies.com`**
4. Any LoopC user can use **Check email** — agent reads the shared company inbox

### MG / CG later

1. Set `sharedInboxEmail` in [`shared/tenant-catalog.json`](../shared/tenant-catalog.json) for each tenant
2. Enable Sales Manager AI: `featureFlags.salesManagerAi` + `SALES_AI_ALLOWED_TENANTS=loopc,mg,cg`
3. Each tenant’s super admin connects that tenant’s company Gmail once

## Google Cloud setup

1. Confirm `business@loopcstrategies.com` is **Google Workspace** or **Gmail**
2. Enable **Gmail API**
3. OAuth consent screen (Internal for Workspace, or External with test users)
4. OAuth client — authorized redirect URIs:
   - User (legacy): `https://api.loopcstrategies.com/api/email/oauth/gmail/callback`
   - **Company inbox:** `https://api.loopcstrategies.com/api/email/oauth/gmail/tenant/callback`
   - Local tenant: `http://localhost:5000/api/email/oauth/gmail/tenant/callback`
5. Railway env vars (see below)

## Railway environment variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `GOOGLE_OAUTH_TENANT_REDIRECT_URI` | Company inbox callback (optional if `API_PUBLIC_URL` set) |
| `EMAIL_TOKEN_ENCRYPTION_KEY` | 64-char hex for AES-256-GCM token storage |
| `EMAIL_OAUTH_STATE_SECRET` | Optional HMAC secret for OAuth state |
| `EMAIL_FETCH_RATE_LIMIT` | Max inbox fetches per user/tenant per hour (default: 10) |
| `API_PUBLIC_URL` | e.g. `https://api.loopcstrategies.com` |

Generate encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or push all vars to Railway (generates keys if missing):

```bash
# After adding backend/.google-oauth-client.json or GOOGLE_* in backend/.env
npm run setup:gmail-railway
```

Connect company inbox (after Railway deploy):

```bash
npm run connect:company-gmail
```

Opens LoopC dashboard — sign in as **super_admin**, click **Connect company Gmail**, use **business@loopcstrategies.com**.

## API endpoints

| Method | Path | Access |
|--------|------|--------|
| GET | `/api/email/tenant-connection` | Sales AI users — status + expected company email |
| GET | `/api/email/oauth/gmail/tenant/start` | `super_admin` — start company OAuth |
| DELETE | `/api/email/tenant-connection` | `super_admin` — disconnect company inbox |

## Scope and limits

- Read-only Gmail scope: `gmail.readonly`
- LoopC-only Sales AI today (`SALES_AI_ALLOWED_TENANTS`)
- Max 15 messages per check; snippets only
- Outlook: Phase 2 via `outlookProvider.js`

## Other options (not implemented)

- **Domain-wide delegation** — service account reads `business@` without interactive login
- **Microsoft 365** — Graph API for Outlook tenants
- **Dashboard tasks from email** — create follow-up tasks from inbox findings
