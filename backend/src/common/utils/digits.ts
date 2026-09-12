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

/**
 * Student Portal login credential (Phase 3 addendum, revised): the phone
 * number is required on every student and is always digits, so its last 6
 * digits make a far more reliable password source than the Roll Number —
 * no Bengali/ASCII numeral ambiguity, no dependency on a Roll Number ever
 * being (correctly) set/edited. Strips everything but digits first (spaces,
 * dashes, a "+880" country code) so formatting differences never matter.
 */
export function passwordFromPhone(phone: string): string {
  const digitsOnly = toAsciiDigits(phone).replace(/\D/g, "");
  return digitsOnly.slice(-6);
}
