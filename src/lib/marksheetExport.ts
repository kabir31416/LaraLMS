import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { IndividualResultView } from "@/types/marksheet";

/**
 * Print/PDF for the public Individual Marksheet (Phase 6 §23/§24) — a
 * richer layout than the generic ReportToolbar/exporters.ts pair (student
 * summary + subject table + overall totals + detail table in one document),
 * built with the same underlying approach: jsPDF + jspdf-autotable for a
 * real vector PDF (never a screenshot), a styled print window for print.
 *
 * No institution name/logo is included — Settings has no such branding
 * field today (checked before writing this), so the header is generic.
 */

function statusColor(status: string): [number, number, number] {
  if (status === "উত্তীর্ণ") return [22, 163, 74];
  if (status === "অনুপস্থিত") return [100, 116, 139];
  return [220, 38, 38];
}

export function printIndividualMarksheet(view: IndividualResultView) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const { student, dateRange, subjects, overall, details } = view;

  const subjectRows = subjects
    .map((s) => `<tr><td>${s.subject}</td><td>${s.fullMarks}</td><td>${s.obtained}</td><td>${s.percentage}%</td><td>${s.grade}</td></tr>`)
    .join("");
  const detailRows = details
    .map(
      (d) =>
        `<tr><td>${d.date}</td><td>${d.subject}</td><td>${d.examTitle}</td><td>${d.fullMarks}</td><td>${d.obtained ?? "—"}</td><td>${d.percentage != null ? `${d.percentage}%` : "—"}</td><td>${d.status}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><title>ফলাফল বিবরণী — ${student.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>
      body{font-family:'Hind Siliguri',sans-serif;padding:24px;color:#0f172a}
      h1{font-size:20px;margin:0 0 4px}
      h2{font-size:15px;margin:20px 0 8px;border-bottom:1px solid #cbd5e1;padding-bottom:4px}
      .sub{color:#475569;font-size:13px;margin:0 0 16px}
      .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 24px;font-size:13px;margin-bottom:8px}
      .grid div span{color:#64748b}
      table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px}
      th,td{border:1px solid #cbd5e1;padding:5px 8px;text-align:left}
      th{background:#f1f5f9}
      .overall{display:flex;gap:24px;margin-top:8px;font-size:14px}
      .overall b{font-size:18px;display:block}
      @media print{ body{padding:8px} }
    </style></head><body>
    <h1>ফলাফল বিবরণী</h1>
    <p class="sub">${dateRange.start} থেকে ${dateRange.end}</p>
    <div class="grid">
      <div><span>নাম: </span>${student.name}</div>
      <div><span>রোল: </span>${student.rollNumber}</div>
      <div><span>কোর্স: </span>${student.course ?? "—"}</div>
      <div><span>ব্যাচ: </span>${student.batch ?? "—"}</div>
    </div>

    <h2>বিষয়ভিত্তিক সারসংক্ষেপ</h2>
    <table><thead><tr><th>বিষয়</th><th>পূর্ণমান</th><th>প্রাপ্ত নম্বর</th><th>শতাংশ</th><th>গ্রেড</th></tr></thead>
    <tbody>${subjectRows}</tbody></table>

    <h2>সামগ্রিক ফলাফল</h2>
    <div class="overall">
      <div><b>${overall.fullMarks}</b>মোট পূর্ণমান</div>
      <div><b>${overall.obtained}</b>মোট প্রাপ্ত নম্বর</div>
      <div><b>${overall.percentage}%</b>মোট শতাংশ</div>
      <div><b>${overall.grade}</b>গ্রেড (${overall.status})</div>
    </div>

    <h2>বিস্তারিত ফলাফল</h2>
    <table><thead><tr><th>তারিখ</th><th>বিষয়</th><th>পরীক্ষা</th><th>পূর্ণমান</th><th>প্রাপ্ত</th><th>শতাংশ</th><th>অবস্থা</th></tr></thead>
    <tbody>${detailRows}</tbody></table>

    <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
  w.document.write(html);
  w.document.close();
}

export function downloadIndividualMarksheetPdf(view: IndividualResultView) {
  const { student, dateRange, subjects, overall, details } = view;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("ফলাফল বিবরণী", 14, 16);
  doc.setFontSize(10);
  doc.text(`${dateRange.start} - ${dateRange.end}`, 14, 22);
  doc.text(`${student.name}  |  Roll: ${student.rollNumber}  |  ${student.course ?? "-"}  |  ${student.batch ?? "-"}`, 14, 28);

  autoTable(doc, {
    startY: 34,
    head: [["Subject", "Full Marks", "Obtained", "Percentage", "Grade"]],
    body: subjects.map((s) => [s.subject, String(s.fullMarks), String(s.obtained), `${s.percentage}%`, s.grade]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });

  const afterSubjects = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.text(
    `Total: ${overall.fullMarks}   Obtained: ${overall.obtained}   Percentage: ${overall.percentage}%   Grade: ${overall.grade} (${overall.status})`,
    14,
    afterSubjects,
  );

  autoTable(doc, {
    startY: afterSubjects + 6,
    head: [["Date", "Subject", "Exam", "Full Marks", "Obtained", "Percentage", "Status"]],
    body: details.map((d) => [d.date, d.subject, d.examTitle, String(d.fullMarks), d.obtained != null ? String(d.obtained) : "-", d.percentage != null ? `${d.percentage}%` : "-", d.status]),
    styles: { fontSize: 8.5 },
    headStyles: { fillColor: [37, 99, 235] },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 6) {
        const [r, g, b] = statusColor(String(data.cell.raw));
        data.cell.styles.textColor = [r, g, b];
      }
    },
  });

  doc.save(`marksheet-${student.rollNumber}.pdf`);
}
