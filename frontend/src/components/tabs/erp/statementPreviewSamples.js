import { getTenantBranding } from '../../../config/tenantBranding'
import { DEFAULT_BRANDING } from './ERPBrandingUtils'
import { generateStatementHtml } from './statementPrintHtml'

const SAMPLE_START = '2026-05-01'
const SAMPLE_END = '2026-07-08'

const buildEmptyAccountEnquiry = () => ({
  account: {
    accountCode: 'CUST-001',
    accountName: '',
    address: '',
  },
  balances: { netBalance: 0 },
  metals: { goldBalance: 0, silverBalance: 0, XAU: 0 },
})

const buildSampleAccountEnquiry = () => ({
  account: {
    accountCode: 'CUST-001',
    accountName: 'SAMPLE CUSTOMER LLC',
    address: 'Office 12, Business Bay\nDubai, UAE',
  },
  balances: { netBalance: 1250.75 },
  metals: { goldBalance: 15.5, silverBalance: 0, XAU: 15.5 },
})

const buildSampleEntries = () => ([
  {
    _id: 'sample-e1',
    date: '2026-05-10',
    description: 'Payment voucher for office expenses',
    debitAmount: 0,
    creditAmount: 440.3,
    metalSignedWeight: 0,
    referenceType: 'payment',
  },
  {
    _id: 'sample-e2',
    date: '2026-06-02',
    description: 'Receipt against invoice INV-204',
    debitAmount: 1200,
    creditAmount: 0,
    metalSignedWeight: 0,
    referenceType: 'receipt',
  },
  {
    _id: 'sample-e3',
    date: '2026-06-18',
    description: 'Metal purchase adjustment',
    debitAmount: 0,
    creditAmount: 250.5,
    metalSignedWeight: 2.5,
    referenceType: 'purchase',
    metalCode: 'XAU',
  },
  {
    _id: 'sample-e4',
    date: '2026-07-05',
    description: 'Metal receipt',
    debitAmount: 0,
    creditAmount: 0,
    metalSignedWeight: 13,
    referenceType: 'metal_receipt',
    metalCode: 'XAU',
  },
])

const resolveTenantBranding = ({ user, tenantBranding }) => {
  if (tenantBranding) return tenantBranding
  const key = String(user?.company || user?.tenant?.key || 'loopc').trim().toLowerCase()
  return getTenantBranding(key)
}

/**
 * Build context object for generateStatementHtml from Master Settings preview mode.
 */
export function buildStatementPreviewContext({
  mode = 'empty',
  branding = {},
  user = {},
  tenantBranding = null,
}) {
  const isSample = mode === 'sample'
  const accountEnquiryData = isSample ? buildSampleAccountEnquiry() : buildEmptyAccountEnquiry()
  const filteredStatementEntries = isSample ? buildSampleEntries() : []
  const rawStatementEntries = isSample ? buildSampleEntries() : []

  return {
    accountEnquiryData,
    filteredStatementEntries,
    rawStatementEntries,
    resolveStatementReceiptNo: (entry) => {
      if (entry?.referenceType === 'payment') return 'Pay/2026/0014'
      if (entry?.referenceType === 'receipt') return 'Rec/2026/0008'
      if (entry?.referenceType === 'purchase') return 'Pur/2026/0003'
      if (entry?.referenceType === 'metal_receipt') return 'MRec/2026/0002'
      return 'DOC-0001'
    },
    statementSelectedMetalCode: 'XAU',
    resolvePreferredStatementMetalCode: () => 'XAU',
    statementDisplayCurrency: 'USD',
    formatStatementDate: (value) => String(value || '').slice(0, 10),
    convertStatementDisplayAmount: (value) => Number(value || 0),
    tenantBranding: resolveTenantBranding({ user, tenantBranding }),
    user: {
      name: user?.name || 'Finance Officer',
      company: user?.company || 'loopc',
      tenant: user?.tenant || { key: 'loopc' },
    },
    branding,
    defaultBranding: DEFAULT_BRANDING,
    statementFilters: {
      startDate: isSample ? SAMPLE_START : '',
      endDate: isSample ? SAMPLE_END : '',
    },
  }
}

/**
 * Generate full statement HTML for Master Settings preview.
 */
export async function buildStatementPreviewHtml({
  mode = 'empty',
  branding = {},
  user = {},
  tenantBranding = null,
}) {
  const ctx = buildStatementPreviewContext({ mode, branding, user, tenantBranding })
  const result = await generateStatementHtml(ctx)
  if (!result?.html) {
    throw new Error('Failed to generate statement preview HTML')
  }
  const title = String(branding?.statementPrint?.title || 'Statement of Account').trim() || 'Statement of Account'
  return {
    html: result.html,
    accountCode: result.accountCode || ctx.accountEnquiryData?.account?.accountCode || 'CUST-001',
    title: `${title} — ${result.accountCode || 'CUST-001'}`,
  }
}
