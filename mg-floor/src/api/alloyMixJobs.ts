import { apiRequest } from '@/src/api/client'

export type AlloyMixJob = {
  id: string
  mixCode: string
  /** Same as mixCode — canonical batch id for Floor / Ops. */
  batchNumber?: string
  reasonBase: string
  karat: number
  targetGross: number
  metalLossGross?: number
  finishedProductName: string
  /** Post Mix Inputs (OUT) — product + grams for Allocate / Metal In. */
  inputComponents?: Array<{
    itemId?: string
    name: string
    role?: string
    label?: string
    gross: number
  }>
  purity: number | null
  stockCode: string
  status: 'in_vault' | 'pending_receive' | 'in_department' | 'closed'
  currentDepartment: string
  pendingFromDepartment?: string
  pendingReceive?: boolean
  hasOpenFloorDescendants?: boolean
  canUpdateMix: boolean
  canAllocate?: boolean
  updatedAt?: string
}

export async function listAlloyMixJobs(opts: {
  token: string
  department?: string
  signal?: AbortSignal
}) {
  return apiRequest<{
    success: boolean
    department: string | null
    departments: string[]
    jobs: AlloyMixJob[]
  }>('/api/mg-floor/alloy-mix-jobs', {
    token: opts.token,
    params: { department: opts.department || undefined },
    signal: opts.signal,
  })
}

export async function allocateAlloyMixJob(opts: {
  token: string
  mixId: string
  toDepartment: string
  note?: string
  /** Grams to move; omit for full mix. */
  weight?: number
}) {
  return apiRequest<{
    success: boolean
    partial?: boolean
    pendingReceive?: boolean
    job: AlloyMixJob
    parentJob?: AlloyMixJob
    childJob?: AlloyMixJob
  }>(
    `/api/mg-floor/alloy-mix-jobs/${encodeURIComponent(opts.mixId)}/allocate`,
    {
      method: 'POST',
      token: opts.token,
      body: {
        toDepartment: opts.toDepartment,
        note: opts.note || '',
        ...(opts.weight != null && Number.isFinite(opts.weight) ? { weight: opts.weight } : {}),
      },
    },
  )
}

export async function receiveAlloyMixJob(opts: {
  token: string
  mixId: string
  decision: 'APPROVED' | 'REJECTED'
  note?: string
}) {
  return apiRequest<{
    success: boolean
    decision: 'APPROVED' | 'REJECTED'
    job: AlloyMixJob
    metalInEntryId?: string | null
  }>(
    `/api/mg-floor/alloy-mix-jobs/${encodeURIComponent(opts.mixId)}/receive`,
    {
      method: 'POST',
      token: opts.token,
      body: {
        decision: opts.decision,
        note: opts.note || '',
      },
    },
  )
}

export type InventoryProductRow = {
  _id?: string
  id?: string
  name?: string
  category?: string
  purity?: number | string
  unit?: string
  quantity?: number
  isDeleted?: boolean
  deletedAt?: string | null
}

/** Created stock products for Vault Add metal picker. */
export async function listInventoryProducts(opts: {
  token: string
  signal?: AbortSignal
}) {
  return apiRequest<{
    success: boolean
    products: InventoryProductRow[]
  }>('/api/mg-floor/inventory-products', {
    token: opts.token,
    signal: opts.signal,
  })
}

/** Vault Room only — bump mix targetGross with selected product gross (+ optional purity). */
export async function addMetalToVaultMixJob(opts: {
  token: string
  mixId: string
  productId: string
  gross: number
  purity?: number | null
  note?: string
}) {
  return apiRequest<{
    success: boolean
    job: AlloyMixJob
  }>(
    `/api/mg-floor/alloy-mix-jobs/${encodeURIComponent(opts.mixId)}/add-metal`,
    {
      method: 'POST',
      token: opts.token,
      body: {
        productId: opts.productId,
        gross: opts.gross,
        ...(opts.purity != null && Number.isFinite(opts.purity) ? { purity: opts.purity } : {}),
        note: opts.note || '',
      },
    },
  )
}

/** Vault Room only — transfer full or partial in-vault mix into Finished Jewelry & Inventory. */
export async function transferVaultMixToFinished(opts: {
  token: string
  mixId: string
  productId?: string
  newProduct?: { name: string; sku?: string; category?: string } | null
  gross: number
  pcs?: number
  note?: string
}) {
  return apiRequest<{
    success: boolean
    job: AlloyMixJob
    product: { id: string; name: string; sku?: string; category?: string; quantity: number; pcs: number }
    transferGross: number
    transferPcs: number
    remainingGross: number
    isFullTransfer: boolean
  }>(
    `/api/mg-floor/alloy-mix-jobs/${encodeURIComponent(opts.mixId)}/transfer-finished`,
    {
      method: 'POST',
      token: opts.token,
      body: {
        ...(opts.productId ? { productId: opts.productId } : {}),
        ...(opts.newProduct ? { newProduct: opts.newProduct } : {}),
        gross: opts.gross,
        ...(opts.pcs != null ? { pcs: opts.pcs } : {}),
        note: opts.note || '',
      },
    },
  )
}
