# Dependabot major dependency review

Quarterly checklist (Jan / Apr / Jul / Oct). Dependabot groups **minor + patch only** — majors require manual review.

## Packages to review

| Package | Location | Current (approx) | Notes |
|---------|----------|------------------|-------|
| express | `backend/package.json` | ^5.2.x | Major already on v5 |
| mongoose | `backend/package.json` | ^9.6.x | Watch migration guides |
| expo | `mobile/package.json` | ~56 | SDK upgrades need EAS rebuild |
| react-native | `mobile/package.json` | 0.85.x | Tied to Expo SDK |
| @sentry/node | `backend/package.json` | ^10.x | Match DSN project |
| jest | `backend/package.json` | ^29.x | v30 available — test before bump |

**Recently triaged (dev-only):** root `shell-quote` via `concurrently` and frontend `undici` via Vitest were fixed with `npm audit fix` (2026-06). Backend `js-yaml` via Jest remains dev-only moderate — address with Jest 30 upgrade, not `audit fix --force`.

## Steps

1. Review open Dependabot PRs on GitHub.
2. Run `npm run check:ci-parity` locally.
3. Run `npm run verify:critical-health`.
4. For mobile: `npm run check:mobile` + preview build on one device.
5. Merge one major at a time; deploy staging first.

## CI

- `dependency-audit` job fails on high/critical production vulnerabilities.
- Advisory audit continues on error — triage monthly.
