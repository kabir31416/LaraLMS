import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { UserPlus, Printer, FileSpreadsheet } from "lucide-react";
import { useStudents, fromApi, type ApiStudent } from "@/contexts/StudentContext";
import { useAcademic } from "@/contexts/AcademicContext";
import { STUDENTS_APPROVE_ENTRY } from "@/lib/permissions";
import { EMPTY_FILTERS, FILTER_KEYS, StudentFilters, studentFilterQuery, type StudentFilterValues } from "@/components/students/StudentFilters";
import { StudentTable } from "@/components/students/StudentTable";
import { AdmissionForm } from "@/components/students/AdmissionForm";
import { StudentPhotoUploader } from "@/components/students/photo/StudentPhotoUploader";
import type { Student } from "@/types/student";
import { toast } from "sonner";
import { ApiClientError, useAuth, hasPermission } from "@/contexts/AuthContext";
import { api } from "@/lib/apiClient";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { exportExcel, printReport } from "@/lib/exporters";

/**
 * The Student List filters/paginates entirely server-side (§15 of the "Move
 * Excel Import / Student List filters" spec) — it deliberately does NOT read
 * from StudentContext's own `students` array, since that context caps its
 * fetch at 100 rows for the dropdown/lookup use cases elsewhere in the app
 * (StudentTable's batch lookup excepted, which only ever needs to resolve a
 * batch's own name — batches are few). Mutations (add/edit/delete) still go
 * through StudentContext so every other page reading it stays in sync, but
 * this page's own display list is re-fetched fresh after each one.
 */
const PAGE_SIZE = 20;

interface ExportRow {
  id: string;
  name: string;
  rollNumber?: string;
  registrationId: string;
  phone: string;
  guardianMobile?: string;
  dob?: string;
  course?: string;
  batchName?: string;
  hscInstitution?: string;
  due: number;
  status: string;
}

interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function friendlyError(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

const Students = () => {
  const { deleteStudent, uploadStudentPhoto, deleteStudentPhoto, approveEntry, rejectEntry } = useStudents();
  const { getCourse, loading: academicLoading } = useAcademic();
  const { user } = useAuth();
  const canApproveEntry = hasPermission(user, STUDENTS_APPROVE_ENTRY);

  // Every filter, the sort and the page live in the URL, so they survive
  // pagination, reloads, back/forward and can be shared as a link.
  const [params, setParams] = useSearchParams();
  const filters = useMemo<StudentFilterValues>(() => {
    const f = { ...EMPTY_FILTERS };
    for (const k of FILTER_KEYS) f[k] = params.get(k) ?? "";
    return f;
  }, [params]);
  const page = Math.max(1, Number(params.get("page")) || 1);
  const setPage = (p: number) => setParams((prev) => { const n = new URLSearchParams(prev); if (p > 1) n.set("page", String(p)); else n.delete("page"); return n; });
  // Any filter change (other than page itself) starts back at page 1 — a
  // stale page number from a previous, larger result set could otherwise
  // land past the end of a newly-narrowed one.
  const updateFilters = (patch: Partial<StudentFilterValues>) => setParams((prev) => {
    const n = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) { if (v) n.set(k, v); else n.delete(k); }
    n.delete("page");
    return n;
  }, { replace: true });
  const resetFilters = () => setParams((prev) => { const n = new URLSearchParams(); if (prev.get("sort")) n.set("sort", prev.get("sort")!); return n; }, { replace: true });

  // Only the free-text fields are debounced (so a keystroke doesn't fire a
  // request); dropdowns, dates and paging apply immediately.
  const textKey = JSON.stringify([filters.search, filters.division, filters.district, filters.guardianMobile]);
  const debouncedTextKey = useDebouncedValue(textKey, 350);
  const debouncedFilters = useMemo<StudentFilterValues>(() => {
    const [search, division, district, guardianMobile] = JSON.parse(debouncedTextKey) as string[];
    return { ...filters, search, division, district, guardianMobile };
  }, [filters, debouncedTextKey]);

  const [students, setStudents] = useState<Student[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<"print" | "excel" | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [photoStudent, setPhotoStudent] = useState<Student | null>(null);
  const [rejecting, setRejecting] = useState<Student | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [entryBusyId, setEntryBusyId] = useState<string | null>(null);

  const courseName = debouncedFilters.courseId ? getCourse(debouncedFilters.courseId)?.name : undefined;
  // A course id that no longer resolves (deleted course, stale link) must not
  // silently widen the list to every course.
  const courseUnresolved = !!debouncedFilters.courseId && !courseName;
  const courseMissing = courseUnresolved && !academicLoading;

  // One query string shared by the list, Print and Export — they can never disagree.
  const filterQuery = useMemo(() => studentFilterQuery(debouncedFilters, courseName).toString(), [debouncedFilters, courseName]);
  const buildFilterParams = useCallback((): URLSearchParams => new URLSearchParams(filterQuery), [filterQuery]);

  const load = useCallback(() => {
    if (courseUnresolved) return;
    setLoading(true);
    const qs = buildFilterParams();
    qs.set("page", String(page));
    qs.set("limit", String(PAGE_SIZE));
    api
      .getWithMeta<ApiStudent[]>(`/students?${qs.toString()}`)
      .then((res) => {
        setStudents(res.data.map(fromApi));
        setMeta((res.meta as unknown as ListMeta) ?? null);
      })
      .catch((err) => toast.error(friendlyError(err, "শিক্ষার্থী তালিকা লোড করা যায়নি।")))
      .finally(() => setLoading(false));
  }, [buildFilterParams, page, courseUnresolved]);

  useEffect(() => { load(); }, [load]);

  const handleEdit = (student: Student) => {
    setEditStudent(student);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStudent(id);
      toast.success("শিক্ষার্থী মুছে ফেলা হয়েছে");
      load();
    } catch (err) {
      toast.error(friendlyError(err, "মুছতে ব্যর্থ হয়েছে"));
    }
  };

  /** Student Entry Workflow — Approve/Reject reachable straight from the Student List's own 3-dot menu, same endpoints the dedicated Pending Applications page uses. */
  const handleApprove = async (student: Student) => {
    if (entryBusyId) return;
    setEntryBusyId(student.id);
    try {
      await approveEntry(student.id);
      toast.success(`${student.name}-কে অনুমোদন করা হয়েছে`);
      load();
    } catch (err) {
      toast.error(friendlyError(err, "অনুমোদন করা যায়নি"));
    } finally {
      setEntryBusyId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejecting || entryBusyId) return;
    setEntryBusyId(rejecting.id);
    try {
      await rejectEntry(rejecting.id, rejectReason.trim() || undefined);
      toast.success(`${rejecting.name}-এর আবেদন বাতিল করা হয়েছে`);
      setRejecting(null);
      setRejectReason("");
      load();
    } catch (err) {
      toast.error(friendlyError(err, "বাতিল করা যায়নি"));
    } finally {
      setEntryBusyId(null);
    }
  };

  const handlePhotoOpenChange = (open: boolean) => {
    if (!open) {
      setPhotoStudent(null);
      load(); // refresh this page's own list so the new photo shows immediately, same as after edit/delete
    }
  };

  const handleFormOpenChange = (open: boolean) => {
    setFormOpen(open);
    if (!open) load();
  };

  const fetchFilteredForExport = async (): Promise<ExportRow[]> => {
    const qs = buildFilterParams();
    return api.get<ExportRow[]>(`/students/export?${qs.toString()}`);
  };

  const handlePrint = async () => {
    setExporting("print");
    try {
      const rows = await fetchFilteredForExport();
      if (rows.length === 0) { toast.error("বর্তমান ফিল্টারে কোনো শিক্ষার্থী পাওয়া যায়নি।"); return; }
      const headers = ["নাম", "রেজিস্ট্রেশন নম্বর", "আইডি", "মোবাইল", "অভিভাবকের নম্বর", "জন্মতারিখ", "কোর্স", "ব্যাচ", "HSC প্রতিষ্ঠান", "বকেয়া"];
      const dataRows = rows.map((r) => [
        r.name, r.rollNumber || "—", r.registrationId, r.phone, r.guardianMobile || "—",
        r.dob || "—", r.course || "—", r.batchName || "—", r.hscInstitution || "—",
        r.due > 0 ? `৳${r.due.toLocaleString("bn-BD")}` : "পরিশোধিত",
      ]);
      printReport("শিক্ষার্থী তালিকা", headers, dataRows);
    } catch (err) {
      toast.error(friendlyError(err, "প্রিন্ট করা যায়নি।"));
    } finally {
      setExporting(null);
    }
  };

  const handleExport = async () => {
    setExporting("excel");
    try {
      const rows = await fetchFilteredForExport();
      if (rows.length === 0) { toast.error("বর্তমান ফিল্টারে কোনো শিক্ষার্থী পাওয়া যায়নি।"); return; }
      const headers = ["নাম", "রেজিস্ট্রেশন নম্বর", "আইডি", "মোবাইল", "অভিভাবকের নম্বর", "জন্মতারিখ", "কোর্স", "ব্যাচ", "HSC প্রতিষ্ঠান", "বকেয়া", "স্ট্যাটাস"];
      const dataRows = rows.map((r) => [
        r.name, r.rollNumber || "—", r.registrationId, r.phone, r.guardianMobile || "—",
        r.dob || "—", r.course || "—", r.batchName || "—", r.hscInstitution || "—", r.due, r.status,
      ]);
      exportExcel({ filename: "student-list", title: "শিক্ষার্থী তালিকা", headers, rows: dataRows });
    } catch (err) {
      toast.error(friendlyError(err, "এক্সপোর্ট করা যায়নি।"));
    } finally {
      setExporting(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">শিক্ষার্থী</h1>
            <p className="text-sm text-muted-foreground">ফিল্টার, খোঁজ ও সাজানো — প্রিন্ট ও এক্সপোর্টেও একই ফলাফল</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handlePrint} disabled={exporting !== null}>
              <Printer className="mr-2 h-4 w-4" /> {exporting === "print" ? "প্রস্তুত হচ্ছে..." : "প্রিন্ট"}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={exporting !== null}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> {exporting === "excel" ? "প্রস্তুত হচ্ছে..." : "এক্সপোর্ট"}
            </Button>
            <Button onClick={() => { setEditStudent(null); setFormOpen(true); }}>
              <UserPlus className="mr-2 h-4 w-4" /> নতুন ভর্তি
            </Button>
          </div>
        </div>

        <StudentFilters value={filters} onChange={updateFilters} onReset={resetFilters} total={loading && !meta ? null : meta?.total ?? 0} loading={loading} />

        <Card className="border-none shadow-sm">
          {courseMissing ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              নির্বাচিত কোর্সটি আর পাওয়া যাচ্ছে না।{" "}
              <Button variant="link" className="h-auto p-0" onClick={() => updateFilters({ courseId: "", batchId: "" })}>কোর্স ফিল্টার মুছুন</Button>
            </div>
          ) : loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <StudentTable
              students={students}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUploadPhoto={setPhotoStudent}
              onApprove={canApproveEntry ? handleApprove : undefined}
              onReject={canApproveEntry ? setRejecting : undefined}
            />
          )}

          {meta && meta.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t">
              <p className="text-sm text-muted-foreground">
                মোট {meta.total.toLocaleString("bn-BD")} জনের মধ্যে {((meta.page - 1) * meta.limit + 1).toLocaleString("bn-BD")}–
                {Math.min(meta.page * meta.limit, meta.total).toLocaleString("bn-BD")} জন দেখানো হচ্ছে
              </p>
              <Pagination className="mx-0 w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      className={meta.page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={() => meta.page > 1 && setPage(meta.page - 1)}
                    />
                  </PaginationItem>
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === meta.totalPages || Math.abs(p - meta.page) <= 1)
                    .map((p, idx, arr) => (
                      <PaginationItem key={p}>
                        {idx > 0 && arr[idx - 1] !== p - 1 ? <span className="px-2 text-muted-foreground">…</span> : null}
                        <PaginationLink isActive={p === meta.page} className="cursor-pointer" onClick={() => setPage(p)}>
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      className={meta.page >= meta.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      onClick={() => meta.page < meta.totalPages && setPage(meta.page + 1)}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>

        <AdmissionForm
          open={formOpen}
          onOpenChange={handleFormOpenChange}
          editStudent={editStudent}
        />
        {photoStudent && (
          <StudentPhotoUploader
            open={!!photoStudent}
            onOpenChange={handlePhotoOpenChange}
            studentName={photoStudent.name}
            currentPhotoUrl={photoStudent.photo}
            onUpload={async (blob) => { await uploadStudentPhoto(photoStudent.id, blob); }}
            onRemove={async () => { await deleteStudentPhoto(photoStudent.id); }}
          />
        )}

        <AlertDialog open={!!rejecting} onOpenChange={(v) => { if (!v) { setRejecting(null); setRejectReason(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>আবেদন বাতিল করবেন?</AlertDialogTitle>
              <AlertDialogDescription>
                {rejecting?.name}-এর আবেদন বাতিল করা হবে। এই শিক্ষার্থী কোনো ব্যাচে যুক্ত হবে না। জমাকৃত তথ্য ইতিহাসের জন্য সংরক্ষিত থাকবে।
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Textarea placeholder="বাতিলের কারণ (ঐচ্ছিক)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>বাতিল করুন</AlertDialogCancel>
              <AlertDialogAction onClick={handleRejectConfirm} disabled={entryBusyId === rejecting?.id}>আবেদন বাতিল করুন</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
};

export default Students;
