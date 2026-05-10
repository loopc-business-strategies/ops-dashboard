function ERPSubTabContainer({ activeTab, tabId, children }) {
  if (activeTab !== tabId) return null
  return children
}

export function ERPDashboardTabContainer({ activeTab, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="dashboard">{children}</ERPSubTabContainer>
}

export function ERPAccountsTabContainer({ activeTab, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="accounts">{children}</ERPSubTabContainer>
}

export function ERPEnquiryTabContainer({ activeTab, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="enquiry">{children}</ERPSubTabContainer>
}

export function ERPVouchersTabContainer({ activeTab, children }) {
  return <ERPSubTabContainer activeTab={activeTab} tabId="vouchers">{children}</ERPSubTabContainer>
}
