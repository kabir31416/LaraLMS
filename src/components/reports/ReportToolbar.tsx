import { Button } from "@/components/ui/button";
import { Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { exportExcel, exportPDF, printReport, type ExportData } from "@/lib/exporters";

export function ReportToolbar({ data }: { data: ExportData }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => printReport(data.title, data.headers, data.rows)}>
        <Printer className="h-4 w-4 mr-1" /> প্রিন্ট
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportPDF(data)}>
        <FileDown className="h-4 w-4 mr-1" /> PDF
      </Button>
      <Button size="sm" variant="outline" onClick={() => exportExcel(data)}>
        <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
      </Button>
    </div>
  );
}