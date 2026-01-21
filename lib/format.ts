export function formatCurrency(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(safeValue);
}

export function formatCurrencyPlain(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeValue);
}
