// Re-export the payment label map for use in TabAturSaku
// (avoids importing the full category-badge module which has React deps)
export const PAYMENT_MAP_LABELS: Record<string, string> = {
  gopay:     'GoPay',
  ovo:       'OVO',
  dana:      'DANA',
  shopeepay: 'ShopeePay',
  bca:       'BCA',
  bni:       'BNI',
  bri:       'BRI',
  mandiri:   'Mandiri',
  jago:      'Jago',
  tunai:     'Tunai',
  transfer:  'Transfer',
  qris:      'QRIS',
  kartu:     'Kartu',
  lainnya:   'Lainnya',
}
