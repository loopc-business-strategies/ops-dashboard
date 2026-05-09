# Release Versioning Policy

## Scope
- Frontend package: `frontend/package.json`
- Backend package: `backend/package.json`
- Workspace package: root `package.json` (orchestration scripts only)

## Goals
- Make releases traceable without relying only on git SHAs.
- Keep SemVer discipline consistent across frontend and backend.
- Align deployment verification with build badge (FE/BE version + SHA).

## Versioning Rules (SemVer)
- Patch (`x.y.Z`): bug fixes, refactors, non-breaking config/test/script changes.
- Minor (`x.Y.z`): backward-compatible feature additions.
- Major (`X.y.z`): breaking API or behavior changes requiring migration.

## Package Version Bump Policy
- For production releases, bump both frontend and backend versions in the same release PR.
- If a change is frontend-only or backend-only, bump only the affected package.
- Root package version is optional and does not represent runtime application version.

## Release Steps
1. Decide release type (`patch`, `minor`, `major`) per affected package.
2. Update:
   - `frontend/package.json` version
   - `backend/package.json` version
3. Run checks:
   - `npm --prefix frontend run build`
   - `npm --prefix frontend test -- --run`
   - `npm --prefix backend test -- --runInBand`
   - `npm run smoke:tenants`
4. Merge to `main` and allow Vercel/Railway auto-deploy.
5. Verify live build badge shows expected FE/BE version + SHA.

## Recommended Cadence
- Patch release: as needed (hotfix/weekly).
- Minor release: grouped feature sets (bi-weekly/monthly).
- Major release: planned migration windows.

## Example
- Current: `frontend 1.0.0`, `backend 1.0.0`
- Bug-fix release: `frontend 1.0.1`, `backend 1.0.1`
- New non-breaking voucher feature (frontend-only): `frontend 1.1.0`, backend unchanged.
- Breaking accounting API contract: `backend 2.0.0` and matching frontend update if required.