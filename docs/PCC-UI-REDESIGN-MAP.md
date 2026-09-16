# PCC UI Redesign Map (Master)

Frontend-only IA map. **No Mongo/API schema changes** for UI work. All existing `?section=` ids remain valid; aliases are additive.

## Entry

| Item | Detail |
|------|--------|
| Route | `/production` → `frontend/src/pages/ProductionControlCenter.jsx` |
| Default | `?section=live` |
| Close | `returnTo` / `sessionStorage.pcc_returnTo` / `/dashboard` |
| API base | `/api/erp/production-control` |
| Realtime | Socket.IO `/production` → `production:update` |
| Theme | Light `--pcc-*` tokens only |
| Demo | `VITE_ENABLE_PRODUCTION_DEMO` + Demo View (writes blocked) |

## Deep-link aliases (`resolveSectionId`)

| Alias | Canonical id |
|-------|----------------|
| `stock` | `stock-overview` |
| `stock-available` | `stock-selection` |
| `custody` | `metal-custody` |
| `delays` | `delay-monitor` |
| `metal-control` / `metal` | `metal-custody` |

## Sidebar → section → panel → API

| Group | Label | Section id | Panel | Primary APIs | Permission (UX) |
|-------|-------|------------|-------|--------------|-----------------|
| COMMAND | Live Floor | `live` | LiveFloorPanel | `/live-floor/*` | view |
| COMMAND | Overview | `overview` | OverviewPanel | `/live-floor/summary` | view |
| COMMAND | My Tasks | `my-tasks` | MyTasksPanel | `/my-tasks` | view |
| COMMAND | Alerts | `alerts` | AlertsPanel | `/alerts` | view / raiseAlert / resolveAlert |
| COMMAND | Delays | `delay-monitor` | DelayMonitorPanel | `/delays` | view |
| PRODUCTION | Work Orders | `work-orders` | WorkOrdersPanel | work-orders APIs | view |
| PRODUCTION | Planning | `planning` | PlanningPanel | planning / WO | view |
| PRODUCTION | Batches | `batches` | BatchesPanel | `/batches` | createBatch + actions |
| PRODUCTION | Processes | `processes` | ProcessesPanel | `/processes` | start/completeProcess |
| PRODUCTION | Production Journey | `journey` | JourneyPanel | `/batches`, `/batches/:id` | view |
| PRODUCTION | Production Flow | `dept-flow` | DepartmentFlowPanel | `/live-floor/summary`, `/flow` | view |
| MATERIAL | Stock hub | `stock-*` | StockWorkspace | `/stock*` | manageStock / selectStock |
| MATERIAL | Metal Control hub | `metal-custody` / `movements` / `passes` | MetalControlWorkspace | `/metal-custody`, `/movements`, `/passes` | createPass / receivePass |
| QUALITY | QC | `qc` | QcPanel | `/qc` | submitQc |
| QUALITY | Rework | `rework` | ReworkQueuePanel | `/rework-queue` | view |
| FACTORY | Departments | `dept-*` | DepartmentPanel | `/departments/:key` | view + process actions |
| FACTORY | Machines | `machines` | MachinesPanel | `/machines` | manageMachines |
| FACTORY | Maintenance | `maintenance` | MaintenancePanel | `/maintenance` | manageMaintenance |
| FACTORY | Floor Manager | `floor-manager` | FloorManagerPanel | floor + summary | floorSession |
| FACTORY | Floor Attendance | `floor-attendance` | FloorAttendancePanel | `/floor-sessions` | floorSession |
| REPORTS | Reports | `reports` | ReportsPanel | `/reports/*` | viewReports |
| REPORTS | Audit | `audit` | AuditPanel | `/audit` | viewAudit |
| ADMIN | Settings | `settings` | SettingsPanel | `/flow`, `/shifts` | manageFlow / manageShifts |

## Stock workspace tabs

| Tab | Section id | Notes |
|-----|------------|-------|
| Overview | `stock-overview` | Flow copy: NEW → release → AVAILABLE |
| Available | `stock-selection` | Select / allocate |
| Under Processing | `stock-processing` | Multi-status filter |
| Finished | `stock-finished` | Dispatch |
| History | `stock-history` | Status events |
| Adjustments | `stock-adjustments` | Weight adjust |
| Stock In | `stock-in` | Toolbar action |

## Metal Control workspace tabs

| Tab | Section id |
|-----|------------|
| Current Custody | `metal-custody` |
| Movement History | `movements` |
| Handovers | `passes` |

## Batch detail tabs (collapsed)

| Tab | Contents |
|-----|----------|
| Summary | State + actions (issue/hold/release/return/split/weight) |
| Journey | Timeline from batch detail |
| Metal & Movement | Custody + processes + passes + weight reconciliation |
| Quality | QC inspections |
| History | Alerts + audit + documents |

## Socket events (examples)

`batch.*`, `pass.*`, `process.*`, `stock.*`, `alert.*`, `machine.*`, `maintenance.*`, `floor.session_*`, `weight.*`, `flow.updated`, `shift.updated`

Optional emit gaps (backend micro-fix): pass cancel, alert raise.

## Constraints

- Do not remove section ids from `SECTION_IDS`.
- Do not change backend statuses, models, or route contracts for UI redesign.
- Light theme via `--pcc-*` only.
- No fake production statistics.
