import { useCallback, useEffect, useState } from "react";
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
import { StudentFilters, type DueStatus } from "@/components/students/StudentFilters";
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
  const { getCourse } = useAcademic();
  const { user } = useAuth();
  const canApproveEntry = hasPermission(user, STUDENTS_APPROVE_ENTRY);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [courseId, setCourseId] = useState("all");
  const [batchId, setBatchId] = useState("all");
  const [hscInstitution, setHscInstitution] = useState("all");
  const [division, setDivision] = useState("");
  const debouncedDivision = useDebouncedValue(division, 350);
  const [district, setDistrict] = useState("");
  const debouncedDistrict = useDebouncedValue(district, 350);
  const [guardianMobile, setGuardianMobile] = useState("");
  const debouncedGuardianMobile = useDebouncedValue(guardianMobile, 350);
  const [gender, setGender] = useState("all");
  const [dueStatus, setDueStatus] = useState<DueStatus>("all");
  const [birthdayToday, setBirthdayToday] = useState(false);
  const [page, setPage] = useState(1);

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

  const courseName = courseId === "all" ? undefined : getCourse(courseId)?.name;

  const buildFilterParams = useCallback((): URLSearchParams => {
    const qs = new URLSearchParams();
    if (debouncedSearch.trim()) qs.set("search", debouncedSearch.trim());
    if (courseName) qs.set("course", courseName);
    if (batchId !== "all") qs.set("batchId", batchId);
    if (hscInstitution !== "all") qs.set("hscInstitution", hscInstitution);
    if (debouncedDivision.trim()) qs.set("division", debouncedDivision.trim());
    if (debouncedDistrict.trim()) qs.set("district", debouncedDistrict.trim());
    if (debouncedGuardianMobile.trim()) qs.set("guardianMobile", debouncedGuardianMobile.trim());
    if (gender !== "all") qs.set("gender", gender);
    if (dueStatus !== "all") qs.set("dueStatus", dueStatus);
    if (birthdayToday) qs.set("birthdayToday", "true");
    return qs;
  }, [debouncedSearch, courseName, batchId, hscInstitution, debouncedDivision, debouncedDistrict, debouncedGuardianMobile, gender, dueStatus, birthdayToday]);

  const load = useCallback(() => {
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
  }, [buildFilterParams, page]);

  useEffect(() => { load(); }, [load]);

  // Any filter change (other than page itself) starts back at page 1 — a
  // stale page number from a previous, larger result set could otherwise
  // land past the end of a newly-narrowed one.
  useEffect(() => { setPage(1); }, [debouncedSearch, courseName, batchId, hscInstitution, debouncedDivision, debouncedDistrict, debouncedGuardianMobile, gender, dueStatus, birthdayToday]);

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
            <p className="text-sm text-muted-foreground">মোট {(meta?.total ?? 0).toLocaleString("bn-BD")} জন শিক্ষার্থী</p>
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

        <StudentFilters
          search={search}
          onSearchChange={setSearch}
          courseId={courseId}
          onCourseIdChange={setCourseId}
          batchId={batchId}
          onBatchIdChange={setBatchId}
          hscInstitution={hscInstitution}
          onHscInstitutionChange={setHscInstitution}
          division={division}
          onDivisionChange={setDivision}
          district={district}
          onDistrictChange={setDistrict}
          guardianMobile={guardianMobile}
          onGuardianMobileChange={setGuardianMobile}
          gender={gender}
          onGenderChange={setGender}
          dueStatus={dueStatus}
          onDueStatusChange={setDueStatus}
          birthdayToday={birthdayToday}
          onBirthdayTodayChange={setBirthdayToday}
        />

        <Card className="border-none shadow-sm">
          {loading ? (
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
