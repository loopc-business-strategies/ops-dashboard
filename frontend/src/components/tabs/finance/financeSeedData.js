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

export const INIT_INVOICES = [
  { id:'INV-2026-041', client:'KazGold Distributors',  type:'Sales',    amount:2900000, issue:'Apr 1, 2026',  due:'May 1, 2026',  status:'Sent',    daysOverdue:0  },
  { id:'INV-2026-040', client:'Tashkent Trading Co',   type:'Sales',    amount:1450000, issue:'Mar 15, 2026', due:'Apr 14, 2026', status:'Overdue', daysOverdue:29 },
  { id:'INV-2026-039', client:'SecureForce KZ',        type:'Purchase', amount:180000,  issue:'Mar 1, 2026',  due:'Mar 31, 2026', status:'Paid',    daysOverdue:0  },
  { id:'INV-2026-038', client:'KazTrans LLC',          type:'Purchase', amount:95000,   issue:'Mar 5, 2026',  due:'Apr 4, 2026',  status:'Overdue', daysOverdue:9  },
  { id:'INV-2026-037', client:'Moscow Metals Ltd',     type:'Sales',    amount:3480000, issue:'Feb 20, 2026', due:'Mar 20, 2026', status:'Paid',    daysOverdue:0  },
  { id:'INV-2026-036', client:'Dubai Commodity House', type:'Sales',    amount:1740000, issue:'Apr 10, 2026', due:'May 10, 2026', status:'Draft',   daysOverdue:0  },
]

export const INIT_EXPENSES = [
  { id:'EXP-091', date:'Apr 10, 2026', dept:'Operations', cat:'Transport',   amount:42000,  by:'Omar Khan',  status:'Approved',     approvedBy:'Omar F.', flagged:false },
  { id:'EXP-090', date:'Apr 9, 2026',  dept:'Sales',      cat:'Marketing',   amount:15000,  by:'Layla S.',   status:'Pending',      approvedBy:'—',       flagged:true  },
  { id:'EXP-089', date:'Apr 8, 2026',  dept:'HR',         cat:'Salaries',    amount:284600, by:'Fatima N.',  status:'Approved',     approvedBy:'Omar F.', flagged:false },
  { id:'EXP-088', date:'Apr 7, 2026',  dept:'Compliance', cat:'Compliance',  amount:8500,   by:'Sara A.',    status:'Under Review', approvedBy:'—',       flagged:false },
  { id:'EXP-087', date:'Apr 5, 2026',  dept:'Production', cat:'Maintenance', amount:42600,  by:'Ali H.',     status:'Approved',     approvedBy:'Omar F.', flagged:false },
  { id:'EXP-086', date:'Apr 3, 2026',  dept:'Admin',      cat:'Admin',       amount:12000,  by:'spr',        status:'Rejected',     approvedBy:'Omar F.', flagged:true  },
]

export const INIT_PAYROLL = [
  { emp:'Ahmad Yusuf',    dept:'Production', role:'Operator',  basic:3200, allow:800,  ded:320, net:3680, status:'Pending',   date:'Apr 30' },
  { emp:'Zara Malik',     dept:'Quality',    role:'Inspector', basic:3800, allow:950,  ded:380, net:4370, status:'Pending',   date:'Apr 30' },
  { emp:'Hassan Ali',     dept:'Production', role:'Operator',  basic:3200, allow:800,  ded:320, net:3680, status:'Pending',   date:'Apr 30' },
  { emp:'Nadia Khan',     dept:'Training',   role:'Trainer',   basic:4200, allow:1050, ded:420, net:4830, status:'Pending',   date:'Apr 30' },
  { emp:'Omar Khan',      dept:'Operations', role:'Logistics', basic:4500, allow:1125, ded:450, net:5175, status:'Processed', date:'Mar 31' },
  { emp:'Layla Siddiqui', dept:'Sales',      role:'Sales Rep', basic:4000, allow:1800, ded:400, net:5400, status:'Processed', date:'Mar 31' },
]

export const BUDGETS = [
  { dept:'Production',             annual:1800000, spent:892000, status:'On Track' },
  { dept:'HR & Hiring',            annual:420000,  spent:341000, status:'Warning'  },
  { dept:'Sales & Marketing',      annual:280000,  spent:178000, status:'On Track' },
  { dept:'Operations & Logistics', annual:650000,  spent:394000, status:'On Track' },
  { dept:'Compliance & Legal',     annual:220000,  spent:142000, status:'On Track' },
  { dept:'Finance & Admin',        annual:180000,  spent:156000, status:'Warning'  },
  { dept:'Training',               annual:95000,   spent:38000,  status:'On Track' },
]

export const RECEIVABLES = [
  { client:'KazGold Distributors',  inv:'INV-2026-041', amount:2900000, due:'May 1, 2026',  overdue:0,  status:'Current' },
  { client:'Tashkent Trading Co',   inv:'INV-2026-040', amount:1450000, due:'Apr 14, 2026', overdue:29, status:'Overdue' },
  { client:'Dubai Commodity House', inv:'INV-2026-036', amount:1740000, due:'May 10, 2026', overdue:0,  status:'Current' },
]

export const PAYABLES = [
  { vendor:'KazTrans LLC',      inv:'INV-2026-038', amount:95000, due:'Apr 4, 2026',  pstatus:'Overdue'   },
  { vendor:'AlphaGuard Ltd',    inv:'PINV-031',     amount:75000, due:'Apr 20, 2026', pstatus:'Pending'   },
  { vendor:'ChemEx Corp',       inv:'PINV-030',     amount:42000, due:'Apr 28, 2026', pstatus:'Pending'   },
  { vendor:'KAZ Equipment Svc', inv:'PINV-029',     amount:28000, due:'May 1, 2026',  pstatus:'Scheduled' },
]

export const TAXES = [
  { type:'Corporate Tax',      period:'Q1 2026',  amount:282500, due:'Apr 30, 2026', filed:'—',             status:'Due Soon' },
  { type:'VAT',                period:'Mar 2026', amount:48000,  due:'Apr 15, 2026', filed:'Apr 13, 2026',  status:'Filed'    },
  { type:'Withholding Tax',    period:'Mar 2026', amount:28400,  due:'Apr 15, 2026', filed:'Apr 14, 2026',  status:'Filed'    },
  { type:'Import Duty (Gold)', period:'Q1 2026',  amount:72000,  due:'Apr 30, 2026', filed:'—',             status:'Pending'  },
]

export const INIT_AUDIT = [
  { action:'Invoice Created',     user:'Omar F.', urole:'Finance Manager', amount:'$2,900,000', dt:'Apr 13 10:32 AM', ip:'192.168.1.12', before:'—',       after:'INV-2026-041 Created' },
  { action:'Expense Approved',    user:'Omar F.', urole:'Finance Manager', amount:'$42,000',    dt:'Apr 13 09:15 AM', ip:'192.168.1.12', before:'Pending', after:'Approved'             },
  { action:'Invoice Marked Paid', user:'spr',     urole:'Super Admin',     amount:'$3,480,000', dt:'Apr 10 02:00 PM', ip:'192.168.1.1',  before:'Sent',    after:'Paid'                 },
  { action:'Payroll Run',         user:'Omar F.', urole:'Finance Manager', amount:'$284,600',   dt:'Mar 31 09:00 AM', ip:'192.168.1.12', before:'Pending', after:'Processed'            },
  { action:'Budget Increased',    user:'spr',     urole:'Super Admin',     amount:'+$50,000',   dt:'Mar 28 11:30 AM', ip:'192.168.1.1',  before:'$400k',   after:'$450k'                },
  { action:'Expense Rejected',    user:'Omar F.', urole:'Finance Manager', amount:'$12,000',    dt:'Apr 5 03:20 PM',  ip:'192.168.1.12', before:'Pending', after:'Rejected'             },
]

export const INIT_NOTIFS = [
  { id:'FN1', lv:'crit', read:false, title:'🔴 Invoice INV-2026-040 Overdue 29 Days',   desc:'Tashkent Trading Co owes $1,450,000. 29 days past due. Auto-escalated.',  time:'Today',     roles:['superadmin','fin_mgr','auditor']              },
  { id:'FN2', lv:'high', read:false, title:'🟠 Large Expense Needs Approval — $15,000', desc:'Sales submitted $15,000 marketing expense. Above $10,000 threshold.',    time:'1 hr ago',  roles:['superadmin','fin_mgr']                        },
  { id:'FN3', lv:'med',  read:false, title:'🟡 Corporate Tax Due in 17 Days',           desc:'Q1 2026 Corporate Tax of $282,500 due Apr 30. Not yet filed.',            time:'2 hrs ago', roles:['superadmin','fin_mgr','auditor']              },
  { id:'FN4', lv:'med',  read:false, title:'🟡 HR Budget at 81% Utilization',           desc:'HR & Hiring has used 81% of annual budget with 8 months remaining.',     time:'Today',     roles:['superadmin','fin_mgr']                        },
  { id:'FN5', lv:'info', read:true,  title:'🔵 New Invoice Draft Pending Review',       desc:'INV-2026-036 for Dubai Commodity House ($1,740,000) awaiting FM review.', time:'Yesterday', roles:['superadmin','fin_mgr','fin_analyst','auditor'] },
  { id:'FN6', lv:'suc',  read:true,  title:'🟢 Payment Received — $3,480,000',         desc:'Moscow Metals Ltd paid INV-2026-037 in full. Revenue updated.',           time:'Apr 10',    roles:['superadmin','fin_mgr','sales_head','auditor']  },
]
