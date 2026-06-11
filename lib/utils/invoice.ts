// Invoice & order number generators.
//   Invoice: INV-{YYMMDD}-{3-digit sequence}   e.g. INV-260607-001
//   Order:   ORD-{YYMMDD}-{4-digit random}     e.g. ORD-260607-4829

function yymmdd(date = new Date()): string {
  // Always in IST, so the daily sequence rolls at IST midnight (not the server's
  // UTC midnight). en-CA renders YYYY-MM-DD; strip dashes and drop the century.
  const ist = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return ist.replace(/-/g, "").slice(2);
}

export function generateOrderNumber(date = new Date()): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${yymmdd(date)}-${rand}`;
}

/** The shared per-day prefix for invoice numbers, e.g. `INV-260607`. */
export function invoiceDatePrefix(date = new Date()): string {
  return `INV-${yymmdd(date)}`;
}

/**
 * Builds an invoice number for the given 1-based daily sequence.
 * e.g. seq 1 → INV-260607-001.
 */
export function generateInvoiceNumber(seq: number, date = new Date()): string {
  return `${invoiceDatePrefix(date)}-${String(seq).padStart(3, "0")}`;
}
