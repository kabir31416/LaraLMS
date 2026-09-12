/** Money formatting used across dashboard, fees, accounts, reports. */
const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toBanglaNumber(n: number | string): string {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

/**
 * Reverse of toBanglaNumber — a Roll Number is often typed with Bengali
 * numerals, but a login password is typed on a plain keyboard using ASCII
 * digits. The backend normalizes the same way when it sets a Student
 * Portal password from a Roll Number, so this must match exactly or a
 * correct-looking password will still fail to log in.
 */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function formatBDT(amount: number, { bengali = true } = {}): string {
  const rounded = Math.round(Number(amount) || 0);
  const withCommas = rounded.toLocaleString("en-IN");
  const num = bengali ? toBanglaNumber(withCommas) : withCommas;
  return `৳${num}`;
}