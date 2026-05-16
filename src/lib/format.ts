// Indian number / currency formatting helpers (lakh system).

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrCompactFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

/** Format a number as Indian rupees: 123456 -> "₹1,23,456.00". */
export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return "₹0.00";
  return inrFormatter.format(value);
}

/** No decimals variant: 123456 -> "₹1,23,456". */
export function formatINRCompact(value: number): string {
  if (!Number.isFinite(value)) return "₹0";
  return "₹" + inrCompactFormatter.format(value);
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
