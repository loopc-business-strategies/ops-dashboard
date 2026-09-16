# Legacy Production tab panels (removed)

The dashboard **Production** nav item redirects to **Production Control Center** (`/production`) via [`../ProductionTab.jsx`](../ProductionTab.jsx).

Orphan monitors that previously lived in this folder (`KPIOverview`, `LiveMonitor`, `Equipment`, `Maintenance`, `QualityControl`, `AlertsReports`, `CostTracking`, `ShiftManagement`, `Planning`) were unused and have been removed. Use PCC sections for live floor, stock, QC, maintenance, and related workflows.

Do not reintroduce seed/demo metrics here. Wire new monitors to PCC/production APIs or deep-link into PCC `?section=` routes.
