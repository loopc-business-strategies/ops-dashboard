# Legacy Production tab panels (deprecated)

The dashboard **Production** nav item redirects to **Production Control Center** (`/production`) via [`../ProductionTab.jsx`](../ProductionTab.jsx).

Files in this folder (`KPIOverview`, `LiveMonitor`, `Equipment`, `Maintenance`, `QualityControl`, `AlertsReports`, `CostTracking`, `ShiftManagement`, etc.) are **not mounted** by the app. Prefer PCC for live floor, stock, QC, and maintenance.

Do not re-enable these panels with seed/demo metrics. If a monitor is needed again, wire it to PCC/production APIs or deep-link into PCC sections.
