# Database migrations

Versioned, replayable schema/data changes for multi-tenant MongoDB.

## Run migrations

```bash
# Dry-run (default)
npm --prefix backend run migrate

# Apply pending migrations to all configured tenants
npm --prefix backend run migrate:apply
```

## Add a migration

1. Create `backend/migrations/NNN-short-description.js` exporting:

```js
module.exports = {
  id: 'NNN-short-description',
  async up({ db, tenant, mongoose }) { /* idempotent changes */ },
}
```

2. Registered migrations: `001-baseline`, `002-backfill-mapping-departments`, `003-backfill-jv-ledger-base-to-fc` (apply 003 only after review — updates JV FX rows).

```js
module.exports = {
  id: '003-short-description',
  async up({ db, tenant }) {
    // mutate db for one tenant
  },
  async down({ db, tenant }) {
    // optional rollback
  },
}
```

2. Migrations run in filename order once per tenant (`mg`, `cg`, `loopc`).
3. Applied IDs are stored in each tenant DB collection `_migrations`.

## Safety

- **Default is dry-run** — `npm run migrate` never writes data.
- Always implement `up` as idempotent when possible.
- Before `--apply`:
  1. **Backup** every tenant database ([MONGODB-BACKUPS-AND-DATA-SAFETY.md](../docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md))
  2. Set `MIGRATION_I_HAVE_BACKUP=true`
  3. Set `MIGRATION_CONFIRM_TOKEN` and pass `--confirm=<same-token>`
  4. Use **staging URIs** unless `ALLOW_PRODUCTION_MIGRATION=true` (only after verified backup)
- Destructive migrations require `MIGRATION_CONFIRM_TOKEN` matching `--confirm=` when using `--apply`.
- Run `npm run check:data-safety` for a read-only local checklist (no DB connection).
