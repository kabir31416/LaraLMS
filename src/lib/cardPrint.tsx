import { renderToStaticMarkup } from "react-dom/server";
import QRCode from "qrcode";
import { AdmitCard, CARD_CSS, IdCardBack, IdCardFront } from "@/components/cards/CardDesigns";
import type { AdmitPayload, IdCardItem, IdCardPayload } from "@/types/cards";

/**
 * Print / PDF for ID cards and admit cards.
 *
 * The window is opened synchronously inside the click handler (so popup
 * blockers allow it) and filled once the data and QR codes are ready. The
 * cards are the same React components as the on-screen preview, rendered to
 * static, escaped HTML. "PDF" is the same document with a "Save as PDF" hint —
 * the browser's own PDF output renders Bengali correctly.
 */

export interface PrintHandle {
  win: Window | null;
  close: () => void;
}

const SHELL_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#e2e8f0}
body{font-family:'Hind Siliguri',sans-serif}
.bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;background:#eff4ff;border-bottom:1px solid #c7d6fb;font-size:13px;color:#1e3a8a}
.bar button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:7px 14px;background:#1d4ed8;color:#fff;cursor:pointer}
.sheet{position:relative;background:#fff;margin:10px auto;box-shadow:0 2px 10px rgba(15,23,42,.15);overflow:hidden;page-break-after:always;break-after:page}
.sheet:last-child{page-break-after:auto;break-after:auto}
.sheet .cap{position:absolute;left:0;right:0;bottom:2mm;text-align:center;font-size:7pt;color:#94a3b8}
.cell{position:absolute}
.cell.guide{outline:.2mm dashed #94a3b8;outline-offset:.8mm}
.cell .cm{position:absolute;width:3mm;height:3mm;border-color:#64748b;border-style:solid;border-width:0}
.cell .cm.tl{left:-4.2mm;top:-4.2mm;border-right-width:.2mm;border-bottom-width:.2mm}
.cell .cm.tr{right:-4.2mm;top:-4.2mm;border-left-width:.2mm;border-bottom-width:.2mm}
.cell .cm.bl{left:-4.2mm;bottom:-4.2mm;border-right-width:.2mm;border-top-width:.2mm}
.cell .cm.br{right:-4.2mm;bottom:-4.2mm;border-left-width:.2mm;border-top-width:.2mm}
.loading{padding:60px 20px;text-align:center;color:#334155;font-size:15px}
.admit-page{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:0}
.admit-page .cut{width:186mm;border-top:.3mm dashed #94a3b8;margin:2.5mm 0;position:relative}
.admit-page .cut span{position:absolute;left:50%;top:-2.4mm;transform:translateX(-50%);background:#fff;padding:0 2mm;font-size:6.5pt;color:#94a3b8}
@media print{html,body{background:#fff}.bar{display:none}.sheet{margin:0;box-shadow:none}}
`;

const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com" /><link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet" />`;

/** Waits for fonts and every image (photos, logo) before printing, so nothing prints blank. */
const READY_SCRIPT = `<script>
(function(){
  function imgs(){return Promise.all(Array.from(document.images).map(function(i){return i.complete?0:new Promise(function(r){i.onload=i.onerror=r;})}))}
  var go=function(){(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(imgs).then(function(){setTimeout(function(){window.print()},250)})};
  if(document.readyState==="complete")go();else window.addEventListener("load",go);
})();
</script>`;

export function startPrintWindow(title = "প্রিন্ট"): PrintHandle {
  const win = window.open("", "_blank", "width=1000,height=850");
  if (win) {
    win.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${title}</title><style>${SHELL_CSS}</style></head><body><div class="loading">প্রিন্ট প্রস্তুত হচ্ছে...</div></body></html>`);
    win.document.close();
  }
  return { win, close: () => win?.close() };
}

function writeDoc(h: PrintHandle, title: string, pageCss: string, body: string, pdf: boolean) {
  if (!h.win || h.win.closed) return false;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
  const bar = `<div class="bar"><span>${pdf ? "PDF হিসেবে রাখতে প্রিন্ট ডায়ালগে <b>“Save as PDF”</b> বেছে নিন।" : "প্রিন্ট সেটিংসে Scale <b>100%</b> (Actual size) ও Margins <b>None</b> রাখুন।"}</span><button onclick="window.print()">${pdf ? "PDF সংরক্ষণ / প্রিন্ট" : "প্রিন্ট"}</button></div>`;
  h.win.document.open();
  h.win.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${esc(title)}</title>${FONT_LINKS}<style>${pageCss}${SHELL_CSS}${CARD_CSS}</style></head><body>${bar}${body}${READY_SCRIPT}</body></html>`);
  h.win.document.close();
  return true;
}

async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
}

export const verifyUrl = (kind: "id" | "admit", code: string) => `${window.location.origin}/verify/${kind}/${code}`;

// ---------------------------------------------------------------- ID cards

export type IdPrintOptions = {
  /** "front": fronts only; "both": front sheet followed by a mirrored back sheet (for long-edge duplex). */
  sides: "front" | "both";
  /** "a4": several cards per A4 with cutting guides; "card": one CR80-sized page per card side (PVC card printers). */
  paper: "a4" | "card";
  pdf?: boolean;
};

const CR80 = { w: 85.6, h: 53.98 };

export async function idQrMap(payload: IdCardPayload): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!payload.settings.idCardShowQr) return out;
  await Promise.all(payload.cards.filter((c) => c.card).map(async (c) => out.set(c.student.id, await qrSvg(verifyUrl("id", c.card!.verifyCode)))));
  return out;
}

export async function printIdCards(h: PrintHandle, payload: IdCardPayload, opts: IdPrintOptions): Promise<boolean> {
  const { institution, settings } = payload;
  const items = payload.cards;
  const qrs = await idQrMap(payload);
  const land = settings.idCardLayout !== "portrait";
  const w = land ? CR80.w : CR80.h, hgt = land ? CR80.h : CR80.w;
  const withBack = opts.sides === "both" && settings.idCardShowBack;
  const props = (c: IdCardItem) => ({ student: c.student, institution, settings, validUntil: c.validUntil, qrSvg: qrs.get(c.student.id) ?? null, preview: !c.card });
  const front = (c: IdCardItem) => renderToStaticMarkup(<IdCardFront {...props(c)} />);
  const back = (c: IdCardItem) => renderToStaticMarkup(<IdCardBack {...props(c)} />);

  if (opts.paper === "card") {
    const pages = items.flatMap((c) => [front(c), ...(withBack ? [back(c)] : [])]);
    const body = pages.map((p) => `<div class="sheet" style="width:${w}mm;height:${hgt}mm">${p}</div>`).join("");
    return writeDoc(h, "আইডি কার্ড", `@page{size:${w}mm ${hgt}mm;margin:0}`, body, !!opts.pdf);
  }

  // A4 portrait sheet: landscape cards 2 × 5 = 10, portrait cards 3 × 3 = 9 per page.
  const cols = land ? 2 : 3, rows = land ? 5 : 3, gx = land ? 8 : 6, gy = land ? 3 : 6;
  const left = (210 - (cols * w + (cols - 1) * gx)) / 2;
  const top = (297 - (rows * hgt + (rows - 1) * gy)) / 2;
  const per = cols * rows;
  const sheets: string[] = [];
  const marks = `<span class="cm tl"></span><span class="cm tr"></span><span class="cm bl"></span><span class="cm br"></span>`;
  const cell = (i: number, html: string, mirrored: boolean) => {
    const r = Math.floor(i / cols), c0 = i % cols, c = mirrored ? cols - 1 - c0 : c0;
    return `<div class="cell guide" style="left:${left + c * (w + gx)}mm;top:${top + r * (hgt + gy)}mm;width:${w}mm;height:${hgt}mm">${marks}${html}</div>`;
  };
  const total = Math.ceil(items.length / per);
  for (let p = 0; p < total; p++) {
    const chunk = items.slice(p * per, (p + 1) * per);
    sheets.push(`<div class="sheet" style="width:210mm;height:297mm">${chunk.map((c, i) => cell(i, front(c), false)).join("")}<div class="cap">পৃষ্ঠা ${p + 1}/${total} — সামনের দিক · ডটেড দাগ বরাবর কাটুন</div></div>`);
    if (withBack) sheets.push(`<div class="sheet" style="width:210mm;height:297mm">${chunk.map((c, i) => cell(i, back(c), true)).join("")}<div class="cap">পৃষ্ঠা ${p + 1}/${total} — পিছনের দিক (ডুপ্লেক্স: লম্বা দিকে উল্টান)</div></div>`);
  }
  return writeDoc(h, `আইডি কার্ড (${items.length})`, "@page{size:A4 portrait;margin:0}", sheets.join(""), !!opts.pdf);
}

// ---------------------------------------------------------------- Admit cards

export async function admitQrMap(payload: AdmitPayload): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!payload.settings.admitShowQr) return out;
  await Promise.all(payload.cards.filter((c) => c.admit).map(async (c) => out.set(c.assignmentId, await qrSvg(verifyUrl("admit", c.admit!.verifyCode)))));
  return out;
}

export async function printAdmitCards(h: PrintHandle, payload: AdmitPayload, opts: { perPage?: 1 | 2; pdf?: boolean }): Promise<boolean> {
  const perPage = opts.perPage ?? payload.settings.admitCardsPerPage ?? 1;
  const qrs = await admitQrMap(payload);
  const html = payload.cards.map((c) => renderToStaticMarkup(
    <AdmitCard exam={payload.exam} student={c.student} institution={payload.institution} settings={payload.settings} admit={c.admit} qrSvg={qrs.get(c.assignmentId) ?? null} half={perPage === 2} />,
  ));
  const pages: string[] = [];
  for (let i = 0; i < html.length; i += perPage) {
    const chunk = html.slice(i, i + perPage);
    pages.push(`<div class="sheet admit-page" style="width:210mm;height:297mm;padding:${perPage === 2 ? "8mm" : "12mm"} 12mm">${chunk.join(`<div class="cut"><span>✂ এখানে কাটুন</span></div>`)}</div>`);
  }
  return writeDoc(h, `অ্যাডমিট কার্ড — ${payload.exam.name}`, "@page{size:A4 portrait;margin:0}", pages.join(""), !!opts.pdf);
}
