# Production Control Center — Performance (2026-09)

## Safety

- Read/index/cache optimizations only — no destructive data changes.
- Workflows, permissions, transactions, and calculation semantics preserved.
- `ProductionDailySummary` materialized views **not** enabled (correctness risk).

## Phase 0 — Baseline (pre-change)

| Signal | Value |
|--------|------:|
| API health commit | `4a2b5812` |
| `GET /live-floor` (unauth) | HTTP 401 ~0.45s (auth required for full timing) |
| `Panels.jsx` size | ~72 KB / ~1633 lines |
| `liveFloorService.js` | ~23 KB / ~633 lines |
| `reportService.js` | ~17 KB / ~439 lines |

### Code-path bottlenecks (confirmed)

1. PCC shell always fetches `/live-floor` + `/flow` + `/me` for every `?section=`.
2. All production panels statically imported with the PCC page chunk.
3. `/live-floor` awaits TTL alert eval, then ~20 queries, then sequential aggs + full per-stage department dashboards.
4. List routes pair `find` + `countDocuments`.
5. `departmentPerformance` N+1 `ProcessRun.find` per stage.
6. Socket soft-refresh hits full `/live-floor` off Live Floor sections.

### Hot query shapes (index candidates)

- `ProductionBatch`: `{ status, updatedAt }` sorts/filters (board, delayed, completed today)
- `MetalMovement`: `{ createdAt: -1 }` recent activity
- `ProductionAlert`: `{ code, status, batchId }` dedup
- `ProcessRun`: `{ status, startTime }`, `{ department, createdAt }`
- `ProductionMachine`: `{ isActive, status }`

## After optimization

### Implemented

1. **Section-aware shell** — `/live-floor` only for `live` / `overview` / `floor-manager`; other sections load `me` (+ flow when needed) only.
2. **Lazy section modules** — panels split under `frontend/src/components/production-control/panels/`; Stock/Ops/FloorManager/Department lazy-loaded.
3. **Live-floor progressive APIs** — `/live-floor/summary|board|alerts|custody|activity|widgets`; full `/live-floor` still composes identical keys.
4. **Alert eval non-blocking** — TTL fire-and-forget; uses `listDepartmentStatusesLite` (agg) instead of full per-stage dashboards.
5. **Lean board projection** — board/activeBatches select display fields only; widgets load in parallel.
6. **Lists** — default page 40, `limit+1` → `hasMore`; exact `total` via `includeCount=1`.
7. **Batch detail** — optional `include` / child `limit` (default 50 window).
8. **Reports** — `departmentPerformance` single query; `dailyProduction` aggregation; golden math tests.
9. **Indexes (additive)** — migration `008-production-live-floor-perf-indexes` + model indexes (`status+updatedAt`, `MetalMovement.createdAt`, alert dedup, ProcessRun/Machine).
10. **Socket** — 300ms debounce; only refreshes when floor summary sections (or batch modal) need it.
11. **API GET dedupe** — in-flight identical GETs share one promise (tenant-scoped by cookie/session naturally).

### Measurements

| Check | Result |
|-------|--------|
| `production-control.test.js` | 12/12 pass |
| `production-control-hardening.test.js` | pass |
| `production-report-math.test.js` | pass |
| Frontend full `vite build` | Blocked by pre-existing missing `@tanstack/react-virtual` (unrelated to PCC) |
| Data mutations from this work | None (reads/indexes/cache only) |

### Intentionally deferred

- Materialized `ProductionDailySummary`
- Changing weightTotals/statusCounts historical window semantics
- Infra CDN/Brotli beyond existing Vercel hashing
- Blind React.memo everywhere
