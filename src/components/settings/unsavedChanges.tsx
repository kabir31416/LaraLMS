import { createContext, useContext, useEffect } from "react";

/**
 * Lets each Settings form report "I have unsaved edits" to the Settings
 * page, which then warns before switching category or closing the tab.
 * Purely client-side UX — saving still goes through each tab's own API call.
 */
export const UnsavedChangesContext = createContext<((key: string, dirty: boolean) => void) | null>(null);

export function useUnsavedChanges(key: string, dirty: boolean) {
  const report = useContext(UnsavedChangesContext);
  useEffect(() => {
    report?.(key, dirty);
    return () => report?.(key, false);
  }, [report, key, dirty]);
}
