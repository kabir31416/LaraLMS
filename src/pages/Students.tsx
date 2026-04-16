import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import { useStudents } from "@/contexts/StudentContext";
import { StudentFilters } from "@/components/students/StudentFilters";
import { StudentTable } from "@/components/students/StudentTable";
import { AdmissionForm } from "@/components/students/AdmissionForm";
import type { Student } from "@/types/student";
import { toast } from "sonner";

const Students = () => {
  const { students, deleteStudent } = useStudents();
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("all");
  const [batch, setBatch] = useState("all");
  const [section, setSection] = useState("all");
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
      const matchBatch = batch === "all" || s.batch === batch;
      const matchSection = section === "all" || s.section === section;
      const matchDue = !dueOnly || s.due > 0;
      return matchSearch && matchCourse && matchBatch && matchSection && matchDue;
    });
  }, [students, search, course, batch, section, dueOnly]);

  const handleEdit = (student: Student) => {
    setEditStudent(student);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteStudent(id);
    toast.success("শিক্ষার্থী মুছে ফেলা হয়েছে");
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
          batch={batch}
          onBatchChange={setBatch}
          section={section}
          onSectionChange={setSSection}
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
