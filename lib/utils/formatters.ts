// Currency, date and misc formatting helpers.

export function formatCurrency(amount: number, symbol = "₹"): string {
  const value = Number(amount ?? 0);
  return `${symbol}${value.toLocaleString("en-IN", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Human label for an order's payment method, expanding split into its parts. */
export function formatPaymentMethod(
  order: { payment_method: string; paid_cash?: number; paid_upi?: number },
  symbol = "₹"
): string {
  if (order.payment_method === "split") {
    return `Split · ${formatCurrency(Number(order.paid_cash ?? 0), symbol)} cash + ${formatCurrency(Number(order.paid_upi ?? 0), symbol)} UPI`;
  }
  return order.payment_method.toUpperCase();
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

/** YYYY-MM-DD for date inputs / range queries. */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getISTNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

export function toISTDate(date: string | Date) {
  return new Date(new Date(date).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

export function getISTTimeBounds(days: number, offsetDays = 0) {
  const istNow = getISTNow();
  
  // Set to start of day in IST
  istNow.setHours(0, 0, 0, 0);
  istNow.setDate(istNow.getDate() - (days - 1) - offsetDays);
  
  // Convert IST start of day back to UTC
  const since = new Date(Date.UTC(istNow.getFullYear(), istNow.getMonth(), istNow.getDate()) - 5.5 * 60 * 60 * 1000);
  
  let until = new Date(); // Actual current UTC time
  if (offsetDays > 0 || days > 1) {
    // If not "today" up to now, we might want the end of the day or just up to current time.
    // Actually, "Yesterday" means until the start of Today.
    // "Last Week" usually means last 7 days up to now.
    // Let's standardise: if offsetDays > 0, until is the exact end of that range in IST (00:00 of the day after).
    // If offsetDays = 0, until is just now.
    if (offsetDays > 0) {
      const istUntil = new Date(istNow);
      istUntil.setDate(istUntil.getDate() + days);
      until = new Date(Date.UTC(istUntil.getFullYear(), istUntil.getMonth(), istUntil.getDate()) - 5.5 * 60 * 60 * 1000);
    }
  }
  
  return { since, until };
}

