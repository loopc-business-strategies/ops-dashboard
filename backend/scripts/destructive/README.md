# Destructive scripts

Scripts in this folder can **modify or delete production data** when run with `--apply` against live MongoDB or the live API.

## Before running any script

1. Read the script header comment.
2. Use **`--tenant=mg|cg|loopc|all`** explicitly.
3. Use **`--apply`** only after a dry-run or audit on a copy.
4. Provide **`--reason="..."`** (10+ characters) when applying in production-like environments.
5. Never run from an unreviewed CI job.

All scripts must import `./_destructive-guard` in the **first five lines** (enforced by `npm run check:destructive-guards`).

## Guard behavior

[`_destructive-guard.js`](./_destructive-guard.js) blocks execution unless:

- Valid `--tenant` is passed
- `--apply` is present (most scripts)
- `--reason` is provided for apply mode in production-like envs

## Safer alternatives

- **`npm run cleanup:safe`** — guarded cleanup CLI at repo root
- **Admin UI** — prefer in-app tools over raw scripts when available
- **Backups** — complete [Mongo restore checklist](../docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md) before destructive maintenance

## CI

`npm run check:destructive-guards` runs on every lint/test pipeline.
