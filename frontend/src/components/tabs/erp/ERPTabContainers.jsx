function ERPSubTabContainer({ activeTab, tabId, persist = false, children }) {
  if (!persist && activeTab !== tabId) return null
  return children
}

export function ERPDashboardTabContainer({ activeTab, persist = false, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="dashboard" persist={persist}>{children}</ERPSubTabContainer>
}

export function ERPAccountsTabContainer({ activeTab, persist = false, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="accounts" persist={persist}>{children}</ERPSubTabContainer>
}

export function ERPEnquiryTabContainer({ activeTab, persist = false, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="enquiry" persist={persist}>{children}</ERPSubTabContainer>
}

export function ERPVouchersTabContainer({ activeTab, persist = false, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="vouchers" persist={persist}>{children}</ERPSubTabContainer>
}
