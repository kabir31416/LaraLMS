const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/** Parses "15m", "30d", "1h" style durations (as used by JWT_*_EXPIRES_IN) into milliseconds. */
export function parseDurationToMs(input: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(input.trim());
  if (!match) throw new Error(`Invalid duration string: ${input}`);
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
