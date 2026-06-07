// Invoice & order number generators.
//   Invoice: INV-{YYMMDD}-{3-digit sequence}   e.g. INV-260607-001
//   Order:   ORD-{YYMMDD}-{4-digit random}     e.g. ORD-260607-4829

function yymmdd(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

export function generateOrderNumber(date = new Date()): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${yymmdd(date)}-${rand}`;
}

/**
 * Builds an invoice number given how many invoices already exist for today.
 * `todayCount` is the count of orders that already have an invoice for the day.
 */
export function generateInvoiceNumber(todayCount: number, date = new Date()): string {
  const seq = String(todayCount + 1).padStart(3, "0");
  return `INV-${yymmdd(date)}-${seq}`;
}
