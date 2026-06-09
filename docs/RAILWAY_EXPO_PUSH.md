# Expo push on Railway (`EXPO_ACCESS_TOKEN`)

This guide wires **background push notifications** for the MG Ops mobile app. The API uses Expo’s push service when **`EXPO_ACCESS_TOKEN`** is set; see [`backend/services/expoPushNotifications.js`](../backend/services/expoPushNotifications.js).

**In-app** notifications (Socket.IO while the app is open) and **Chat SSE** do **not** need this variable. Only **OS-level push** when the app is backgrounded does.

---

## Part A — Create an Expo Personal Access Token

1. Sign in at [expo.dev](https://expo.dev).
2. Open **Account settings** → **Access tokens**  
   Direct URL pattern: `https://expo.dev/accounts/<your-username>/settings/access-tokens`  
   Example: `https://expo.dev/accounts/nandha999/settings/access-tokens`
3. Under **Personal access tokens**, click **“+ Create token”**.
4. Enter a **name** (e.g. `railway-ops-api-push`) and create the token.
5. **Copy the token immediately** — Expo often shows the secret only once. Store it in a password manager until you paste it into Railway.
6. Leave **Enhanced Security for Push Notifications** off until you have a working token and want that extra mode; the server only needs a normal **Personal access token** for `expo-server-sdk`.

**Important:** The Expo account that owns this token should match the account/org used for your app’s **EAS project** (see `mobile/app.config.ts` → `extra.eas.projectId`). If the app is built under a different Expo user, create the token on **that** account instead.

**What this value is not**

| Do not use | Reason |
|------------|--------|
| `ExponentPushToken[...]` | That is the **device** token; the app registers it via `POST /api/auth/me/push-token`. |
| `JWT_SECRET` / random text | Expo’s API will reject sends. |
| `EXPO_PUBLIC_*` from the client | Those are frontend env keys, not the server Expo access token. |

---

## Part B — Set `EXPO_ACCESS_TOKEN` on Railway

### Option 1 — Railway dashboard (recommended if you prefer UI)

1. Open [Railway](https://railway.app) and select your project.
2. Open the **`ops-dashboard`** service (the one that serves `https://api.loopcstrategies.com` or your API URL).
3. Go to the **Variables** tab.
4. Click **New Variable** (or **Raw Editor**).
5. **Variable name:** `EXPO_ACCESS_TOKEN` (exact spelling, all caps with underscores).
6. **Value:** paste the **Personal access token** from Part A (the whole string).
7. **Save**. Railway will trigger a new deployment automatically.

Wait until the deployment is **Active / Success**, then test on a device (Part D).

### Option 2 — PowerShell + Railway CLI

Use this when the repo is already linked to Railway (`railway status` shows your service).

#### B2.1 — Prerequisites

- [Railway CLI](https://docs.railway.com/develop/cli) installed (`railway --version`).
- Logged in: `railway login`.
- From the **repo root** (`ops-dashboard`), `railway status` should show the **`ops-dashboard`** service (or set `RAILWAY_SERVICE_NAME` if yours differs).

#### B2.2 — Put the token only in your shell (not in git)

In **PowerShell** (repo root):

```powershell
cd path\to\ops-dashboard   # your clone of this repo

# Set for this session only (do not paste this line into the repo or commit it)
$env:EXPO_ACCESS_TOKEN = 'PASTE_YOUR_EXPO_PERSONAL_ACCESS_TOKEN_HERE'
```

#### B2.3 — Run the helper script

Still in the repo root:

```powershell
.\backend\scripts\railway-set-expo-access-token.ps1
```

What the script does:

- Reads `EXPO_ACCESS_TOKEN` from the environment (stdin-style via PowerShell pipe to `railway`).
- Runs: `railway variable set EXPO_ACCESS_TOKEN --stdin --service ops-dashboard`  
  (override service with `$env:RAILWAY_SERVICE_NAME = 'your-service-name'` if needed.)

You should see a success message; Railway redeploys.

#### B2.4 — Clear the token from your shell (optional hygiene)

```powershell
Remove-Item Env:EXPO_ACCESS_TOKEN -ErrorAction SilentlyContinue
```

---

## Part C — Bash / WSL (alternative to PowerShell)

From repo root, if you use Git Bash or WSL:

```bash
export EXPO_ACCESS_TOKEN='PASTE_YOUR_TOKEN_HERE'
printf '%s' "$EXPO_ACCESS_TOKEN" | railway variable set EXPO_ACCESS_TOKEN --stdin --service ops-dashboard
unset EXPO_ACCESS_TOKEN
```

---

## Part D — Verify it works

1. **Deployment:** In Railway → **Deployments**, latest deploy is green.
2. **Variable:** Variables list shows `EXPO_ACCESS_TOKEN` (value hidden) — do not copy it back into chat or tickets.
3. **Mobile:** Install a build from EAS, log in, **allow notifications** when prompted (or in OS settings).
4. **Trigger:** Approve a voucher / send a mention that fires `sendUserNotification` while the app is **in the background**.
5. **Expect:** An OS notification. If nothing appears, open the app once (to refresh the Socket) and check Railway **Logs** for `[expo-push]` warnings.

---

## Troubleshooting

| Symptom | Things to check |
|---------|------------------|
| Push never arrives | `EXPO_ACCESS_TOKEN` set on the **same** Railway service that runs `node server.js`; redeploy finished. |
| “Device Not Registered” / Expo errors in logs | User must open app after login so `POST /api/auth/me/push-token` runs; Expo project/account must match the token’s account. |
| Works in foreground only | Expected without push token registration + `EXPO_ACCESS_TOKEN`; Socket handles foreground. |
| Lost the Expo token | Revoke old token in Expo, create a new one, update Railway variable. |

---

## Security

- **Never** commit the token, **never** paste it into GitHub issues or screenshots.
- Prefer Railway **encrypted variables** or CLI stdin as above.
- Rotate the token if it leaks.

---

## Related files

| File | Role |
|------|------|
| [`backend/.env.example`](../backend/.env.example) | Documents `EXPO_ACCESS_TOKEN` for local dev. |
| [`backend/scripts/railway-set-expo-access-token.ps1`](../backend/scripts/railway-set-expo-access-token.ps1) | PowerShell helper for Railway CLI. |
| [`mobile/src/services/expoPushRegistration.ts`](../mobile/src/services/expoPushRegistration.ts) | Registers device push token with the API after login. |
