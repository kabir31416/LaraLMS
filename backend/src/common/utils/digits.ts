const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

/**
 * Roll Numbers are commonly entered with Bengali numerals (admission forms
 * even suggest it — "যেমন: ০৭"), but a login password is almost always
 * typed on a plain keyboard using ASCII digits. Since bcrypt compares raw
 * bytes, "০৭" and "07" are simply different passwords — this is why a
 * Student Portal login can look right (the Roll Number shown matches) yet
 * still fail as "invalid credentials". Normalizing to ASCII digits
 * wherever a Roll Number is used as a password makes it independent of
 * which keyboard/input method it was originally typed with.
 */
export function toAsciiDigits(input: string): string {
  return input.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)));
}
