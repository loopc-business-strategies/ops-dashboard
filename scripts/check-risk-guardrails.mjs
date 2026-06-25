import fs from 'node:fs'

const budgets = [
  {
    file: 'frontend/src/components/tabs/ERPTab.jsx',
    maxLines: 8400,
    message: 'ERPTab is already a high-risk component. Extract helpers/hooks instead of adding more bulk.',
  },
  {
    file: 'frontend/src/components/tabs/VoucherTab.jsx',
    maxLines: 3500,
    message: 'VoucherTab is high-risk. Extract panels/hooks instead of growing the shell.',
  },
  {
    file: 'backend/routes/erp-accountingContext.js',
    maxLines: 2400,
    message: 'ERP accounting route context is high-risk. Put new route slices or services in focused modules.',
  },
]

const failures = []

for (const budget of budgets) {
  const text = fs.readFileSync(budget.file, 'utf8')
  const lines = text.split(/\r?\n/).length
  if (lines > budget.maxLines) {
    failures.push({ ...budget, lines })
  }
}

if (failures.length) {
  console.error('Risk guardrail check failed:')
  for (const failure of failures) {
    console.error(`- ${failure.file}: ${failure.lines} lines, budget ${failure.maxLines}. ${failure.message}`)
  }
  process.exit(1)
}

console.log('Risk guardrail check passed.')
