import { ERPEnquiryTabContainer } from '../ERPTabContainers'
import { ERP_EMPTY_CARD_STYLE } from '../erpTabPresentation'
import { isPrimaryNavClick } from '../../../../utils/dashboardNavigation'

const linkButtonStyle = { textDecoration: 'none', display: 'inline-block' }

export default function ERPEnquiryTab({
  activeTab,
  C,
  isSuperAdmin,
  isFinance,
  canViewBalanceEnquiry,
  handleAccountEnquiry,
  accountEnquiryCode,
  setAccountEnquiryCode,
  setEnquiryStatus,
  filteredGroupedSummaryAccounts,
  fetchAccountEnquiryByCode,
  enquiryLoading,
  enquiryStatus,
  summaryAccountsLoading,
  safeSummaryAccounts,
  enquiryHistory,
  buildAccountEnquiryHref,
}) {
  return (
    <ERPEnquiryTabContainer activeTab={activeTab}>
      <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ marginBottom: '0.35rem', color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Account Summary</h3>
                  <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.9rem' }}>Search any chart-of-account code to view balances, account details, and exportable summary details.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: '#ECFDF5', color: '#065F46', fontSize: '0.78rem', fontWeight: '700' }}>{isSuperAdmin ? 'Super Admin' : isFinance ? 'Finance' : 'Department Head'}</span>
                  <span style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.78rem', fontWeight: '700' }}>Role Based</span>
                </div>
              </div>
              {!canViewBalanceEnquiry ? (
                <div style={{ ...ERP_EMPTY_CARD_STYLE, borderStyle: 'solid', background: '#FEF2F2', color: '#991B1B' }}>Account summary access restricted. Ask an admin to enable the Account Summary ERP permission for this user.</div>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <form onSubmit={handleAccountEnquiry} style={{ background: '#FAFAF7', border: '1px solid #D6D3C4', borderRadius: '0.75rem', padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                        <p style={{ margin: 0, color: '#3F4B2E', fontWeight: '800', letterSpacing: '0.02em' }}>Account Lookup</p>
                        <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>Type account code</span>
                      </div>
                      <input
                        placeholder="Enter Account Number (e.g. 1000)"
                        value={accountEnquiryCode}
                        onChange={(e) => {
                          setAccountEnquiryCode(e.target.value)
                          setEnquiryStatus({ type: '', message: '' })
                        }}
                        style={{ display: 'block', width: '100%', padding: '0.7rem 0.8rem', marginBottom: '0.75rem', background: '#FFFFFF', border: '1px solid #B8BEA0', color: C.ink, borderRadius: '0.5rem' }}
                      />
                      {filteredGroupedSummaryAccounts.length > 0 && (
                        <div style={{ marginTop: '-0.35rem', marginBottom: '0.75rem', border: '1px solid #D6D3C4', borderRadius: '0.6rem', background: '#FFFFFF', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)' }}>
                          {filteredGroupedSummaryAccounts.map((group) => (
                            <div key={group.type}>
                              <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '0.45rem 0.75rem', background: '#F5F7F0', borderBottom: '1px solid #E5E7EB', color: '#3F4B2E', fontSize: '0.76rem', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                {group.type}
                              </div>
                              {group.accounts.map((account) => (
                                <a
                                  key={account._id}
                                  href={buildAccountEnquiryHref?.(account.accountCode) || '#'}
                                  onMouseDown={(event) => {
                                    if (!isPrimaryNavClick(event)) return
                                    event.preventDefault()
                                    setAccountEnquiryCode(account.accountCode)
                                    setEnquiryStatus({ type: '', message: '' })
                                    fetchAccountEnquiryByCode(account.accountCode, { openModal: true })
                                  }}
                                  onClick={(event) => {
                                    if (!isPrimaryNavClick(event)) return
                                    event.preventDefault()
                                  }}
                                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0.75rem', border: 'none', borderBottom: '1px solid #F3F4F6', background: '#FFFFFF', color: C.ink, cursor: 'pointer', textAlign: 'left', textDecoration: 'none' }}
                                >
                                  <span style={{ fontWeight: '800', minWidth: '56px', color: '#111827' }}>{account.accountCode}</span>
                                  <span style={{ flex: 1, color: '#4B5563', fontSize: '0.86rem' }}>{account.accountName}</span>
                                  <span style={{ color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{account.accountType}</span>
                                </a>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <a
                          href={buildAccountEnquiryHref?.(accountEnquiryCode) || '#'}
                          onClick={(event) => {
                            if (!isPrimaryNavClick(event)) return
                            event.preventDefault()
                            handleAccountEnquiry(event)
                          }}
                          style={{
                            ...linkButtonStyle,
                            padding: '0.6rem 1rem',
                            background: 'var(--purple)',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '0.45rem',
                            cursor: enquiryLoading ? 'not-allowed' : 'pointer',
                            fontWeight: '700',
                            opacity: enquiryLoading ? 0.7 : 1,
                          }}
                        >
                          {enquiryLoading ? 'Loading...' : 'Load Summary'}
                        </a>
                        <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Live from ERP accounting balances</span>
                      </div>
                      {enquiryStatus.message && (
                        <p style={{ marginTop: '0.6rem', marginBottom: 0, color: enquiryStatus.type === 'success' ? '#047857' : C.danger, fontWeight: '600', fontSize: '0.85rem' }}>
                          {enquiryStatus.message}
                        </p>
                      )}
                      {summaryAccountsLoading && (
                        <p style={{ margin: '0.7rem 0 0', color: '#6B7280', fontSize: '0.82rem', fontWeight: '600' }}>
                          Loading account list…
                        </p>
                      )}
                      {!summaryAccountsLoading && !safeSummaryAccounts.length && (
                        <p style={{ margin: '0.7rem 0 0', color: '#92400E', fontSize: '0.82rem', fontWeight: '600' }}>
                          No accounts available for your role. Department heads only see mapped accounts in Account Summary.
                        </p>
                      )}
                      <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px solid #E5E7EB' }}>
                        <p style={{ margin: '0 0 0.5rem', color: '#6B7280', fontWeight: '700', fontSize: '0.78rem' }}>Quick Accounts</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                          {safeSummaryAccounts
                            .slice()
                            .sort((a, b) => String(a?.accountCode || '').localeCompare(String(b?.accountCode || '')))
                            .slice(0, 8)
                            .map((account) => (
                              <a
                                key={account._id}
                                href={buildAccountEnquiryHref?.(account.accountCode) || '#'}
                                onClick={(event) => {
                                  if (!isPrimaryNavClick(event)) return
                                  event.preventDefault()
                                  setAccountEnquiryCode(account.accountCode)
                                  fetchAccountEnquiryByCode(account.accountCode, { openModal: true })
                                }}
                                style={{
                                  ...linkButtonStyle,
                                  padding: '0.35rem 0.6rem',
                                  borderRadius: '999px',
                                  border: '1px solid #C7D2FE',
                                  background: '#EEF2FF',
                                  color: '#3730A3',
                                  cursor: 'pointer',
                                  fontSize: '0.76rem',
                                  fontWeight: '700',
                                }}
                                title={account.accountName}
                              >
                                {account.accountCode}
                              </a>
                            ))}
                        </div>
                      </div>
                    </form>
                  </div>
                  {enquiryHistory.length > 0 && (
                    <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem', marginBottom: '1rem' }}>
                      <p style={{ margin: 0, color: C.ink, fontWeight: '700', marginBottom: '0.55rem' }}>Recent Account Summary History</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {enquiryHistory.map((item) => (
                          <a
                            key={`${item.accountCode}-${item.searchedAt}`}
                            href={buildAccountEnquiryHref?.(item.accountCode) || '#'}
                            onClick={(event) => {
                              if (!isPrimaryNavClick(event)) return
                              event.preventDefault()
                              fetchAccountEnquiryByCode(item.accountCode, { openModal: true })
                            }}
                            style={{
                              ...linkButtonStyle,
                              padding: '0.35rem 0.6rem',
                              borderRadius: '0.4rem',
                              border: '1px solid #D1D5DB',
                              background: '#F9FAFB',
                              color: C.ink,
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                            }}
                            title={item.accountName || item.accountCode}
                          >
                            {item.accountCode}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
    </ERPEnquiryTabContainer>
  )
}
