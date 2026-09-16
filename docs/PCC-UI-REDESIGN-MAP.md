# PCC UI Redesign Map

Frontend-only IA map. **No Mongo/API changes.** All `?section=` ids remain valid deep links.

## Entry

| Item | Detail |
|------|--------|
| Route | `/production` → `frontend/src/pages/ProductionControlCenter.jsx` |
| Default | `?section=live` |
| Close | `returnTo` / `sessionStorage.pcc_returnTo` / `/dashboard` |
| API | `/api/erp/production-control` |
| Realtime | Socket.IO `/production` → `production:update` |

## Sidebar groups → section ids → panels

| Sidebar group | Nav label | Section id | Panel module |
|---------------|-----------|------------|--------------|
| COMMAND | Live Floor | `live` | `LiveFloorPanel.jsx` |
| COMMAND | Overview | `overview` | `panels/OverviewPanel.jsx` |
| COMMAND | My Tasks | `my-tasks` | `panels/MyTasksPanel.jsx` |
| COMMAND | Alerts | `alerts` | `panels/AlertsPanel.jsx` |
| COMMAND | Delays | `delay-monitor` | `OpsPanels.jsx` → DelayMonitorPanel |
| PRODUCTION | Work Orders | `work-orders` | `WorkOrdersPanel.jsx` |
| PRODUCTION | Planning | `planning` | `PlanningPanel.jsx` |
| PRODUCTION | Batches | `batches` | `panels/BatchesPanel.jsx` |
| PRODUCTION | Processes | `processes` | `panels/ProcessesPanel.jsx` |
| PRODUCTION | Production Flow | `dept-flow` | `DepartmentFlowPanel.jsx` |
| MATERIAL | Stock | `stock-overview` (+ tabs below) | `StockWorkspace.jsx` → `StockPanels.jsx` |
| MATERIAL | Metal Movement | `movements` | `panels/MovementsPanel.jsx` |
| MATERIAL | Handovers | `passes` | `panels/PassesPanel.jsx` |
| MATERIAL | Metal Custody | `metal-custody` | `OpsPanels.jsx` → MetalCustodyPanel |
| QUALITY | QC | `qc` | `panels/QcPanel.jsx` |
| QUALITY | Rework | `rework` | `OpsPanels.jsx` → ReworkQueuePanel |
| FACTORY | Departments | `dept-flow` hub + `dept-*` | `DepartmentPanel.jsx` |
| FACTORY | Machines | `machines` | `panels/MachinesPanel.jsx` |
| FACTORY | Maintenance | `maintenance` | `OpsPanels.jsx` → MaintenancePanel |
| FACTORY | Floor Manager | `floor-manager` | `FloorManagerPanels.jsx` |
| FACTORY | Floor Attendance | `floor-attendance` | `FloorManagerPanels.jsx` |
| REPORTS | Reports | `reports` | `FloorManagerPanels.jsx` → ReportsPanel |
| REPORTS | Audit | `audit` | `panels/AuditPanel.jsx` |
| ADMIN | Settings | `settings` | `FloorManagerPanels.jsx` → SettingsPanel |

## Stock workspace tabs (same APIs)

| Tab | Section id | Panel |
|-----|------------|-------|
| Overview | `stock-overview` | StockOverviewPanel |
| Available | `stock-selection` | StockListPanel (AVAILABLE) |
| Under Processing | `stock-processing` | StockListPanel (processing statuses) |
| Finished | `stock-finished` | StockListPanel (FINISHED,DISPATCHED) |
| History | `stock-history` | StockHistoryPanel |
| Adjustments | `stock-adjustments` | StockAdjustmentsPanel |
| Stock In (toolbar) | `stock-in` | NewStockInPanel + MarkAvailableHelper |

## Department deep links

`dept-melting`, `dept-casting`, `dept-rolling`, `dept-bangle_division`, `dept-stamping`, `dept-polishing`, `dept-quality_control`, `dept-packing` → `DepartmentPanel` via `DEPT_SECTION_MAP`.

## Batch detail

`panels/BatchDetailModal.jsx` — opened from Live Floor / Batches (React state `selectedBatchId`, not URL).

## Constraints

- Do not remove section ids from `SECTION_IDS`.
- Do not change backend statuses, models, or routes for this redesign.
- Light theme via `--pcc-*` tokens only.
