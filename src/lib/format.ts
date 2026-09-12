/** Money formatting used across dashboard, fees, accounts, reports. */
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBanglaNumber(n: number | string): string {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatBDT(amount: number, { bengali = true } = {}): string {
  const rounded = Math.round(Number(amount) || 0);
  const withCommas = rounded.toLocaleString("en-IN");
  const num = bengali ? toBanglaNumber(withCommas) : withCommas;
  return `৳${num}`;
}