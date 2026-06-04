# Deployment Guide

## Overview

This document describes the deployment process for the ops-dashboard application to production (Vercel for frontend, Railway for backend).

**Key Principles:**
- Always run deployment commands from the **repository root** (not from `backend/` or `frontend/`)
- All tests must pass before deploying
- Use authoritative `railway.json` at repository root (no `backend/railway.json`)
- Cleanup operations require explicit confirmation tokens

## Prerequisites

### Local Development
- Node.js >= 20.x
- npm >= 10.8.2
- MongoDB cluster access (connection strings in `.env`)
- Git configured for your workflow

### Deployment Credentials
- Vercel account with `ops-dashboard` project access
- Railway account with `ops-dashboard` service access
- MongoDB cluster credentials for all tenants (mg, cg, loopc)

### Environment Variables
Ensure `.env` in repository root contains:
```
MONGO_URI_MG=mongodb+srv://...
MONGO_URI_CG=mongodb+srv://...
MONGO_URI_LOOPC=mongodb+srv://...

# For other services (add as needed)
GITHUB_TOKEN=...
VERCEL_TOKEN=...
```

## Development Workflow

### Starting Development Environment

```bash
# From repository root
npm run dev

# Or separately:
npm run dev:backend  # Terminal 1: Express on http://localhost:5000
npm run dev:frontend # Terminal 2: Vite on http://localhost:5173
```

### Running Tests Locally

```bash
# Run all backend tests
npm run test:backend

# Run all frontend tests
npm run test:frontend

# Run specific test file
npm --prefix backend test -- tests/erp-accounting-transactions.test.js
npm --prefix frontend test -- src/context/AuthContext.integration.test.jsx
```

**All tests must pass (89 total: 64 backend + 25 frontend) before committing.**

## Staging Deployment

### 1. Verify Changes Locally

```bash
# Pull latest from main
git pull origin main

# Install dependencies
npm install
npm --prefix backend install
npm --prefix frontend install

# Run full test suite
npm run test:backend && npm run test:frontend
```

### 2. Review Changes

```bash
# Check git status
git status

# See what files changed
git diff --stat

# Review specific changes
git diff backend/routes/erp-accountingContext.js
```

### 3. Commit Changes

```bash
# Stage changes
git add .

# Commit with clear message
git commit -m "Fix: FX revaluation service fallback for rate-only lines

- Enhanced resolveVoucherFxMetrics to derive FC amounts for rate-only voucher lines
- Added safety guards to destructive cleanup scripts (dry-run, confirmation tokens)
- Unified Railway deploy path (removed duplicate backend/railway.json)
- Updated deployment documentation"

# Push to feature branch or main
git push origin main
```

## Production Deployment

### Full Deployment Flow

```bash
# From repository root
npm run deploy:railway
```

This command:
1. ✅ Runs backend test suite (64 tests)
2. ✅ Runs frontend test suite (25 tests)
3. ✅ Displays success message if all tests pass

### Manual Deployment to Vercel (Frontend)

```bash
# Option 1: Push to main branch (auto-deploys to loopcstrategies.com)
git push origin main

# Option 2: Manual deployment
npm --prefix frontend run build
npx vercel --prod --token=$VERCEL_TOKEN
```

Monitor at: https://vercel.com/projects/ops-dashboard

**CLI “Not authorized”:** run `npx vercel login` once on your machine, or set `VERCEL_TOKEN` (account **Settings → Tokens**) and pass `--token`. Pushing to `main` still deploys via the GitHub integration without the CLI.

### Manual Deployment to Railway (Backend)

```bash
# Railway watches the main branch and auto-deploys when:
# 1. Code is pushed to main
# 2. railway.json (at root) is valid
# 3. Build command succeeds: cd backend && npm install --omit=dev
# 4. Start command succeeds: cd backend && node server.js

# To deploy immediately (from dashboard):
# https://railway.com/project/dbae5a5c-eb63-4990-9951-292b70ca7b35
```

**Important:** Railway uses the `railway.json` at the repository root, not `backend/railway.json`.

## Multi-Tenant Deployment

All three tenants deploy together:
- **MG**: mg.loopcstrategies.com
- **CG**: cg.loopcstrategies.com
- **Loopc**: loopc.loopcstrategies.com

Each tenant has separate MongoDB:
- ops_mg (MG data)
- ops_cg (CG data)
- ops_loopc (Loopc data)

### Verifying Tenant Setup

```bash
# Test tenant routing
npm run smoke:tenants

# Expected output:
# ✓ MG: GET /api/health → 200
# ✓ CG: GET /api/health → 200
# ✓ Loopc: GET /api/health → 200
```

## Data Maintenance

### Safe Cleanup Operations

Always use the safe cleanup wrapper for destructive operations:

```bash
# From repository root
npm run cleanup:safe

# Prompts for:
# 1. Tenant selection (mg/cg/loopc)
# 2. Operation selection (exchangeEntries, orphanTestParties, etc.)
# 3. Preview of records to delete
# 4. Confirmation token (generated, must match to proceed)
```

**Example Workflow:**

```bash
$ npm run cleanup:safe
? Select tenant (mg/cg/loopc): mg
? Select operation: exchangeEntries

[STEP 1] Previewing records...
Found 5 documents matching criteria

[STEP 2] Requesting confirmation token...
⚠️  WARNING: This will DELETE 5 records!
✓ Your confirmation token is: A1B2C3D4

Type the token to confirm deletion: A1B2C3D4
[STEP 3] Executing deletion...
✓ Successfully deleted 5 documents
✓ Audit log recorded with deleted IDs for potential rollback
```

**Audit Trail:**
- All cleanup operations logged to `backend/logs/cleanup-audit/`
- Format: `cleanup-{tenant}-{date}.jsonl`
- Contains: timestamp, operation, count, deleted IDs, status

### Emergency Cleanup (Do Not Use Lightly)

For direct MongoDB operations (requires extreme care):

```bash
# NOT RECOMMENDED - Use safe cleanup above instead
# Example structure (never run directly):
# npm --prefix backend run cleanup:direct -- --tenant=mg
```

## Troubleshooting

### Tests Failing Locally

```bash
# Clear node_modules and reinstall
rm -rf backend/node_modules frontend/node_modules
npm install
npm --prefix backend install
npm --prefix frontend install

# Run specific failing test
npm --prefix backend test -- tests/erp-accounting-transactions.test.js
```

### Railway Build Failing

**Problem:** Build fails with "command not found"

**Solution:** Verify `railway.json` at root has correct paths:
```json
{
  "deploy": {
    "buildCommand": "cd backend && npm install --omit=dev",
    "startCommand": "cd backend && node server.js"
  }
}
```

**Do NOT run from wrong directory:**
```bash
cd backend && railway up  # ❌ WRONG
npm run deploy:railway   # ✅ CORRECT (from root)
```

### Vercel Build Failing

**Problem:** Build fails during deployment

**Solution:** Check logs on Vercel dashboard:
```bash
# Or rebuild locally
npm --prefix frontend run build

# Check for errors
npm --prefix frontend run build 2>&1 | head -50
```

### Tenant Data Mismatch

**Problem:** One tenant shows stale data after deployment

**Solution:** Check MongoDB connections:
```bash
# Verify env vars are set
echo $MONGO_URI_MG
echo $MONGO_URI_CG
echo $MONGO_URI_LOOPC

# Test connection
npm --prefix backend test -- tests/tenant-db-isolation.test.js
```

## Monitoring Post-Deployment

### Health Checks

```bash
# Check all tenants
curl https://mg.loopcstrategies.com/api/health
curl https://cg.loopcstrategies.com/api/health
curl https://loopc.loopcstrategies.com/api/health

# Check backend directly
curl https://backend.railway.app/api/health
```

### Error Logs

- **Vercel:** https://vercel.com/projects/ops-dashboard/deployments
- **Railway:** https://railway.com/project/dbae5a5c-eb63-4990-9951-292b70ca7b35/logs

### Performance Monitoring

- **Frontend:** Vercel Analytics dashboard
- **Backend:** Railway metrics (CPU, memory, response times)

## Rollback Procedure

### If Frontend Breaks

```bash
# Vercel automatically keeps previous builds
# Use Vercel dashboard to rollback to previous deployment
# Or force redeploy from known good commit:

git checkout <stable-commit-hash>
git push origin main
# Vercel auto-deploys within 2 minutes
```

### If Backend Breaks

```bash
# Railway auto-redeploys on git push
git revert <bad-commit-hash>
git push origin main
# Railway rebuilds and restarts service

# Or manually on Railway dashboard
# Stop service → Deploy from previous build
```

### If Data Is Corrupted

**Do NOT delete without audit:**
```bash
# Check audit log for deleted IDs
tail -100 backend/logs/cleanup-audit/cleanup-mg-*.jsonl

# Potential rollback (requires backup restoration)
# Contact database administrator
```

## Security Considerations

### Sensitive Environment Variables
- Never commit `.env` to git
- Use `.env.example` as template
- Rotate credentials quarterly

### Deployment Tokens
- Store Vercel/Railway tokens only in CI/CD secrets
- Never paste tokens in chat or logs
- Regenerate tokens if exposed

### Data Cleanup
- Always use `--dry-run` first: `npm run cleanup:safe -- --tenant=mg --dry-run`
- Confirmation tokens prevent accidental deletion
- All operations are audit-logged

## Deployment Checklist

Before each production deployment:

- [ ] All tests passing locally (`npm run test:backend && npm run test:frontend`)
- [ ] Code reviewed and approved
- [ ] `.env` credentials up-to-date
- [ ] No uncommitted changes (`git status` clean)
- [ ] Feature branch merged to main
- [ ] Deployment command verified: `npm run deploy:railway`
- [ ] Post-deployment health checks pass
- [ ] Tenant routing verified: `npm run smoke:tenants`

## Support

For deployment issues:
1. Check this document first
2. Review recent git commits: `git log --oneline -10`
3. Check test logs: `npm run test:backend 2>&1 | tail -100`
4. Review deployment logs on Vercel/Railway dashboards
5. Check MongoDB cluster status in Atlas dashboard

---

**Last Updated:** May 12, 2026
**Maintainers:** Backend & DevOps team
