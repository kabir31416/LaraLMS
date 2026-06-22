import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportData {
  filename: string;
  title: string;
  headers: string[];
  rows: (string | number)[][];
}

export function exportExcel({ filename, headers, rows }: ExportData) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPDF({ filename, title, headers, rows }: ExportData) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  });
  doc.save(`${filename}.pdf`);
}

export function printReport(title: string, headers: string[], rows: (string | number)[][]) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const html = `<!doctype html><html><head><title>${title}</title>
    <style>
      body{font-family:'Hind Siliguri',sans-serif;padding:24px;color:#0f172a}
      h1{font-size:20px;margin:0 0 16px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left}
      th{background:#f1f5f9}
    </style></head><body>
    <h1>${title}</h1>
    <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <script>window.onload=()=>{window.print();}</script>
    </body></html>`;
  w.document.write(html);
  w.document.close();
}