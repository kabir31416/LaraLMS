import type { BatchMasterSheetView, IndividualResultView } from "@/types/marksheet";
import type { PublicInstitutionInfo } from "@/types/academic";

/**
 * Print / PDF for the Individual Marksheet and the Batch Master Sheet.
 *
 * Both are rendered as a styled, print-ready HTML document in a new window
 * (A4 portrait for the individual sheet, A4 landscape for the batch sheet)
 * with the institution header, Hind Siliguri font and repeated table headers.
 *
 * "PDF" uses the same document with a "Save as PDF" hint: the browser's own
 * PDF output renders Bengali correctly, which the previous jsPDF export could
 * not (jsPDF has no Bengali font, so names/subjects came out garbled).
 *
 * Every value is HTML-escaped before it is written — names and titles can
 * come from public forms and the print window shares the app's origin.
 */

function escapeDeep<T>(v: T): T {
  if (typeof v === "string") return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string) as unknown as T;
  if (Array.isArray(v)) return v.map(escapeDeep) as unknown as T;
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, escapeDeep(x)])) as T;
  return v;
}

const BASE_CSS = `
  *{box-sizing:border-box}
  body{font-family:'Hind Siliguri',sans-serif;margin:0;padding:24px;color:#0f172a;background:#fff;font-size:13px;line-height:1.45}
  .bar{position:sticky;top:0;display:flex;align-items:center;justify-content:space-between;gap:12px;margin:-24px -24px 20px;padding:10px 24px;background:#eff4ff;border-bottom:1px solid #c7d6fb;font-size:13px;color:#1e3a8a}
  .bar button{font:inherit;font-weight:600;border:0;border-radius:8px;padding:7px 14px;background:#1d4ed8;color:#fff;cursor:pointer}
  .head{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:3px solid #1e3a8a}
  .head img{height:46px;width:46px;object-fit:contain}
  .head .inst{font-size:18px;font-weight:700;color:#172554}
  .head .meta{font-size:11.5px;color:#475569}
  .title{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:16px 0 12px}
  .title h1{font-size:20px;margin:0;color:#172554}
  .title .range{font-size:12px;color:#475569}
  table{width:100%;border-collapse:collapse}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th{background:#172554;color:#fff;font-weight:600;font-size:11.5px;padding:6px 8px;text-align:left;border:1px solid #172554}
  td{border:1px solid #cbd5e1;padding:5px 8px;font-size:12px}
  tbody tr:nth-child(even) td{background:#f8fafc}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  .c{text-align:center}
  .pass{color:#15803d;font-weight:600}.fail{color:#b91c1c;font-weight:600}.absent{color:#64748b}
  .foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:36px;font-size:11px;color:#64748b}
  .sign{border-top:1px solid #94a3b8;padding-top:4px;min-width:170px;text-align:center;color:#334155}
  @media print{.bar{display:none}body{padding:0}}
`;

function headerHtml(institution?: PublicInstitutionInfo): string {
  const name = institution?.name ?? "";
  if (!name) return "";
  const logo = institution?.logoUrl ? `<img src="${institution.logoUrl}" alt="" />` : "";
  const meta = [institution?.address, institution?.phone, institution?.website].filter(Boolean).join(" • ");
  return `<div class="head">${logo}<div><div class="inst">${name}</div>${meta ? `<div class="meta">${meta}</div>` : ""}</div></div>`;
}

function openDoc(title: string, css: string, body: string, pdf: boolean, size: "portrait" | "landscape", width: number) {
  const w = window.open("", "_blank", `width=${width},height=800`);
  if (!w) return;
  const bar = pdf
    ? `<div class="bar"><span>PDF হিসেবে রাখতে প্রিন্ট ডায়ালগে <b>“Save as PDF”</b> বেছে নিন।</span><button onclick="window.print()">PDF সংরক্ষণ / প্রিন্ট</button></div>`
    : "";
  w.document.write(`<!doctype html><html lang="bn"><head><meta charset="utf-8"><title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>@page{size:A4 ${size};margin:12mm}${BASE_CSS}${css}</style></head><body>${bar}${body}
    <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script></body></html>`);
  w.document.close();
}

const statusClass = (s: string) => (s === "উত্তীর্ণ" ? "pass" : s === "অনুপস্থিত" ? "absent" : "fail");

function individualDoc(rawView: IndividualResultView, rawInstitution: PublicInstitutionInfo | undefined, pdf: boolean) {
  const view = escapeDeep(rawView);
  const institution = rawInstitution && escapeDeep(rawInstitution);
  const { student, dateRange, subjects, overall, details } = view;
  const subjectRows = subjects
    .map((s) => `<tr><td>${s.subject}</td><td class="num">${s.fullMarks}</td><td class="num">${s.obtained}</td><td class="num">${s.percentage}%</td><td class="c"><b>${s.grade}</b></td></tr>`)
    .join("");
  const detailRows = details
    .map((d) => `<tr><td>${d.date}</td><td>${d.subject}</td><td>${d.examTitle}</td><td class="num">${d.fullMarks}</td><td class="num">${d.obtained ?? "—"}</td><td class="num">${d.percentage != null ? `${d.percentage}%` : "—"}</td><td class="${statusClass(d.status)}">${d.status}</td></tr>`)
    .join("");
  const css = `
    .info{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;margin-bottom:14px}
    .info div{padding:8px 10px;border-right:1px solid #e2e8f0}.info div:last-child{border-right:0}
    .info span{display:block;font-size:10.5px;color:#64748b}.info b{font-size:13px}
    h2{font-size:14px;margin:18px 0 6px;color:#172554}
    .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:6px}
    .tiles div{border:1px solid #c7d6fb;background:#eff4ff;border-radius:8px;padding:8px 10px;text-align:center}
    .tiles b{display:block;font-size:20px;color:#172554}.tiles span{font-size:11px;color:#475569}
    .tiles .hl{background:#1e3a8a;border-color:#1e3a8a}.tiles .hl b,.tiles .hl span{color:#fff}`;
  const body = `${headerHtml(institution)}
    <div class="title"><h1>ফলাফল বিবরণী (মার্কশিট)</h1><div class="range">সময়সীমা: ${dateRange.start} — ${dateRange.end}</div></div>
    <div class="info"><div><span>নাম</span><b>${student.name}</b></div><div><span>রেজিস্ট্রেশন / রোল</span><b>${student.rollNumber}</b></div><div><span>কোর্স</span><b>${student.course ?? "—"}</b></div><div><span>ব্যাচ</span><b>${student.batch ?? "—"}</b></div></div>
    <h2>সামগ্রিক ফলাফল</h2>
    <div class="tiles"><div><b>${overall.fullMarks}</b><span>মোট পূর্ণমান</span></div><div><b>${overall.obtained}</b><span>মোট প্রাপ্ত নম্বর</span></div><div class="hl"><b>${overall.percentage}%</b><span>মোট শতাংশ</span></div><div><b>${overall.grade}</b><span>গ্রেড (${overall.status})</span></div></div>
    <h2>বিষয়ভিত্তিক সারসংক্ষেপ</h2>
    <table><thead><tr><th>বিষয়</th><th class="num">পূর্ণমান</th><th class="num">প্রাপ্ত নম্বর</th><th class="num">শতাংশ</th><th class="c">গ্রেড</th></tr></thead><tbody>${subjectRows}</tbody></table>
    <h2>বিস্তারিত ফলাফল</h2>
    <table><thead><tr><th>তারিখ</th><th>বিষয়</th><th>পরীক্ষা</th><th class="num">পূর্ণমান</th><th class="num">প্রাপ্ত</th><th class="num">শতাংশ</th><th>অবস্থা</th></tr></thead><tbody>${detailRows}</tbody></table>
    <div class="foot"><span>মুদ্রণের তারিখ: ${new Date().toLocaleDateString("bn-BD")} • মোট শতাংশ = মোট প্রাপ্ত ÷ মোট পূর্ণমান; অনুপস্থিত পরীক্ষা গণনায় নেই</span><span class="sign">কর্তৃপক্ষের স্বাক্ষর</span></div>`;
  openDoc(`ফলাফল বিবরণী — ${student.name}`, css, body, pdf, "portrait", 900);
}

export function printIndividualMarksheet(view: IndividualResultView, institution?: PublicInstitutionInfo) {
  individualDoc(view, institution, false);
}

/** Opens the print-ready marksheet with a "Save as PDF" hint (correct Bengali text). */
export function downloadIndividualMarksheetPdf(view: IndividualResultView, institution?: PublicInstitutionInfo) {
  individualDoc(view, institution, true);
}

const RANK_LABEL: Record<number, string> = { 1: "১ম", 2: "২য়", 3: "৩য়" };

function cellText(cell: { value: number | null; status: "present" | "absent" | "na" }): string {
  if (cell.status === "na") return "—";
  if (cell.status === "absent") return `<span class="absent">অনু.</span>`;
  return String(cell.value);
}

function batchDoc(rawView: BatchMasterSheetView, rawInstitution: PublicInstitutionInfo | undefined, pdf: boolean) {
  const view = escapeDeep(rawView);
  const institution = rawInstitution && escapeDeep(rawInstitution);
  const { batch, dateRange, columns, rows } = view;
  const colHeaders = columns.map((c) => `<th class="c">${c.subject}<br/><span class="muted">${c.date}</span><br/><span class="muted">পূর্ণ ${c.fullMarks}</span></th>`).join("");
  const bodyRows = rows
    .map((r) => {
      const cells = r.cells.map((c) => `<td class="c">${cellText(c)}</td>`).join("");
      const rank = r.rank ? `<span class="badge rank-${r.rank}">${RANK_LABEL[r.rank]}</span>` : "";
      return `<tr><td class="c">${r.rollNumber}</td><td class="name">${r.name}</td>${cells}<td class="num">${r.totalObtained}</td><td class="num">${r.totalFullMarks}</td><td class="num"><b>${r.percentage}%</b></td><td class="c">${r.grade}</td><td class="c">${rank}</td></tr>`;
    })
    .join("");
  const top = rows.filter((r) => r.rank).sort((a, b) => (a.rank ?? 9) - (b.rank ?? 9));
  const podium = top.length ? `<div class="podium">${top.map((r) => `<div class="rank-${r.rank}"><span>${RANK_LABEL[r.rank!]}</span><b>${r.name}</b><em>${r.percentage}% • রোল ${r.rollNumber}</em></div>`).join("")}</div>` : "";
  const css = `
    body{font-size:11px}
    th,td{font-size:10px;padding:4px 5px}
    td.name{white-space:nowrap}
    .muted{color:#c7d2fe;font-weight:400;font-size:9.5px}
    .badge{display:inline-block;padding:1px 7px;border-radius:9999px;font-size:10px;font-weight:700}
    .rank-1 .badge,.badge.rank-1{background:#fef3c7;color:#92400e}
    .badge.rank-2{background:#e2e8f0;color:#334155}
    .badge.rank-3{background:#ffedd5;color:#9a3412}
    .podium{display:flex;gap:8px;margin:0 0 12px}
    .podium div{flex:1;border:1px solid #cbd5e1;border-radius:8px;padding:6px 10px}
    .podium span{font-weight:700;color:#1e3a8a;margin-right:6px}.podium b{font-size:12px}.podium em{display:block;font-style:normal;color:#64748b;font-size:10.5px}
    .podium .rank-1{background:#fffbeb;border-color:#fcd34d}`;
  const body = `${headerHtml(institution)}
    <div class="title"><h1>ব্যাচ ভিত্তিক ফলাফল শীট — ${batch.name}${batch.courseName ? ` (${batch.courseName})` : ""}</h1><div class="range">সময়সীমা: ${dateRange.start ?? "শুরু থেকে"} — ${dateRange.end ?? "বর্তমান পর্যন্ত"} • মোট ${rows.length} জন</div></div>
    ${podium}
    <table><thead><tr><th class="c">রোল</th><th>নাম</th>${colHeaders}<th class="num">মোট প্রাপ্ত</th><th class="num">পূর্ণমান</th><th class="num">শতাংশ</th><th class="c">গ্রেড</th><th class="c">অবস্থান</th></tr></thead><tbody>${bodyRows}</tbody></table>
    <div class="foot"><span>মুদ্রণের তারিখ: ${new Date().toLocaleDateString("bn-BD")} • "অনু." = অনুপস্থিত, "—" = পরীক্ষায় তালিকাভুক্ত নয়</span><span class="sign">কর্তৃপক্ষের স্বাক্ষর</span></div>`;
  openDoc(`ব্যাচ ফলাফল শীট — ${batch.name}`, css, body, pdf, "landscape", 1200);
}

export function printBatchMasterSheet(view: BatchMasterSheetView, institution?: PublicInstitutionInfo) {
  batchDoc(view, institution, false);
}

/** Opens the print-ready batch sheet with a "Save as PDF" hint (correct Bengali text). */
export function downloadBatchMasterSheetPdf(view: BatchMasterSheetView, institution?: PublicInstitutionInfo) {
  batchDoc(view, institution, true);
}
