export function getFinanceTabs(t) {
  return [
    { id:'kpi',     label:`📊 ${t('kpiOverview')}` },
    { id:'revenue', label:`💰 ${t('revenue')}` },
    { id:'expense', label:`💸 ${t('expenses')}` },
    { id:'invoice', label:`📄 ${t('invoices')}` },
    { id:'budget',  label:`📅 ${t('budget')}` },
    { id:'payroll', label:`👥 ${t('payroll')}` },
    { id:'arpa',    label:`🏦 ${t('arAp')}` },
    { id:'gold',    label:`🪙 ${t('goldTracker')}` },
    { id:'tax',     label:`📑 ${t('tax')}` },
    { id:'reports', label:`📈 ${t('reports')}` },
    { id:'ledger',  label:`📕 ${t('generalLedger')}` },
    { id:'audit',   label:`🔍 ${t('auditTrail')}` },
  ]
}
