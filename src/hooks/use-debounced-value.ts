import { useEffect, useState } from "react";

/** Delays reflecting `value` until it stops changing for `delayMs` — used to avoid firing a server request on every keystroke of a search box. */
export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
