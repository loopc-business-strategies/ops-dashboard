import { apiRequest } from '@/src/api/client'
import { todayISO } from '@/src/utils/format'

export type ExpenseRegisterAccount = {
  code?: string
  name?: string
}

export type ExpenseRegisterItem = {
  id: string
  date?: string
  amount?: number
  currency?: string
  category?: string
  description?: string
  paymentSource?: 'bank' | 'cash' | 'transfer' | 'other'
  paymentMethod?: string
  paymentRoute?: string
  debitAccount?: ExpenseRegisterAccount
  creditAccount?: ExpenseRegisterAccount
  referenceType?: string
}

export type ExpenseRegisterResponse = {
  success?: boolean
  startDate?: string
  endDate?: string
  total?: number
  categories?: string[]
  items?: ExpenseRegisterItem[]
  message?: string
}

export type ExpenseRegisterQuery = {
  startDate?: string
  endDate?: string
  category?: string
  paymentSource?: 'all' | 'bank' | 'cash' | 'transfer' | 'other'
  limit?: number
}

export const EXPENSE_REGISTER_PATH = '/api/erp-accounting/reports/expense-register'

export function yearStartISO() {
  const d = new Date()
  return `${d.getFullYear()}-01-01`
}

function cleanParams(params: ExpenseRegisterQuery) {
  const out: Record<string, string | number> = {}
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'paymentSource' && value === 'all') return
    out[key] = value as string | number
  })
  return out
}

export async function fetchExpenseRegister(
  token: string,
  params: ExpenseRegisterQuery = {},
) {
  return apiRequest<ExpenseRegisterResponse>(EXPENSE_REGISTER_PATH, {
    token,
    params: cleanParams({
      startDate: params.startDate ?? yearStartISO(),
      endDate: params.endDate ?? todayISO(),
      limit: params.limit ?? 200,
      category: params.category,
      paymentSource: params.paymentSource,
    }),
  })
}
