import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { useStudents } from "@/contexts/StudentContext";
import { useBatches } from "@/contexts/BatchContext";
import { StudentFilters } from "@/components/students/StudentFilters";
import { StudentTable } from "@/components/students/StudentTable";
import { AdmissionForm } from "@/components/students/AdmissionForm";
import type { Student } from "@/types/student";
import { toast } from "sonner";
import { ApiClientError } from "@/contexts/AuthContext";

const Students = () => {
  const { students, deleteStudent } = useStudents();
  const { batches } = useBatches();
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [section, setSection] = useState("all");
  const [director, setDirector] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        s.mobile.includes(q);
      const matchCourse = course === "all" || s.course === course;
      const matchSection = section === "all" || s.section === section;
      const matchDue = !dueOnly || s.due > 0;

      const studentBatch = batches.find((b) => b.id === s.batchId);
      let matchBatch = true;
      if (batchFilter === "unassigned") matchBatch = !studentBatch;
      else if (batchFilter !== "all") matchBatch = studentBatch?.id === batchFilter;

      let matchDirector = true;
      if (director !== "all") matchDirector = studentBatch?.directorId === director;

      return matchSearch && matchCourse && matchBatch && matchSection && matchDue && matchDirector;
    });
  }, [students, batches, search, course, batchFilter, section, dueOnly, director]);

  const handleEdit = (student: Student) => {
    setEditStudent(student);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStudent(id);
      toast.success("শিক্ষার্থী মুছে ফেলা হয়েছে");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "মুছতে ব্যর্থ হয়েছে");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">শিক্ষার্থী</h1>
            <p className="text-sm text-muted-foreground">মোট {students.length} জন শিক্ষার্থী</p>
          </div>
          <Button onClick={() => { setEditStudent(null); setFormOpen(true); }}>
            <UserPlus className="mr-2 h-4 w-4" /> নতুন ভর্তি
          </Button>
        </div>

        <StudentFilters
          search={search}
          onSearchChange={setSearch}
          course={course}
          onCourseChange={setCourse}
          batch={batchFilter}
          onBatchChange={setBatchFilter}
          section={section}
          onSectionChange={setSection}
          director={director}
          onDirectorChange={setDirector}
          dueOnly={dueOnly}
          onDueOnlyChange={setDueOnly}
        />

        <Card className="border-none shadow-sm">
          <StudentTable students={filtered} onEdit={handleEdit} onDelete={handleDelete} />
        </Card>

        <AdmissionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editStudent={editStudent}
        />
      </div>
    </DashboardLayout>
  );
};

export default Students;
