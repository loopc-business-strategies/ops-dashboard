export function buildVoucherTypeConfigs(t) {
  return {
    payment: { key: 'payment', label: 'Payment Voucher', short: t('paymentVoucher'), code: 'PAY', docPrefix: 'Pay', icon: '💳', partySelectLabel: 'Vendor', partyPlaceholder: 'Auto from vendor' },
    receipt: { key: 'receipt', label: 'Receipt Voucher', short: t('receiptVoucher'), code: 'REC', docPrefix: 'Rec', icon: '🧾', partySelectLabel: 'Customer', partyPlaceholder: 'Auto from customer' },
    purchase: { key: 'purchase', label: 'Metal Purchase Voucher', short: 'Metal Purchase', code: 'PUR', docPrefix: 'Pur', icon: '🟫', partySelectLabel: 'Vendor / Customer', partyPlaceholder: 'Vendor, customer, or account code' },
    sale: { key: 'sale', label: 'Metal Sale Voucher', short: 'Metal Sale', code: 'SAL', docPrefix: 'Sal', icon: '🟨', partySelectLabel: 'Customer / Vendor', partyPlaceholder: 'Customer, vendor, or account code' },
    metal_receipt: { key: 'metal_receipt', label: 'Metal Receipt Voucher', short: 'Metal Receipt', code: 'MREC', docPrefix: 'MRec', icon: '📥', partySelectLabel: 'Account Name', partyPlaceholder: 'Vendor, customer, or account code' },
    metal_payment: { key: 'metal_payment', label: 'Metal Payment Voucher', short: 'Metal Payment', code: 'MPAY', docPrefix: 'MPay', icon: '📤', partySelectLabel: 'Account Name', partyPlaceholder: 'Customer, vendor, or account code' },
  }
}
