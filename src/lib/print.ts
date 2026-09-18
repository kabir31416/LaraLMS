/** Creates (once) or reuses a single <style> tag carrying the @page rule for a print job — kept in sync with Institution Settings' own print.paperSize rather than a hard-coded page size. */
export function applyPrintPageSize(paperSize: "A4" | "Letter") {
  const styleId = "print-page-size";
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  const margin = paperSize === "A4" ? "12mm" : "0.5in";
  styleEl.textContent = `@page { size: ${paperSize}; margin: ${margin}; }`;
}
