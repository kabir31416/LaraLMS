import { useAuth } from "@/contexts/AuthContext";
import { useStudents } from "@/contexts/StudentContext";
import { useBatches } from "@/contexts/BatchContext";
import { useStaff } from "@/contexts/StaffContext";

export function useStudentSelf() {
  const { user } = useAuth();
  const { students } = useStudents();
  const { batches } = useBatches();
  const { staff } = useStaff();
  const student = user?.studentId ? students.find((s) => s.id === user.studentId) : undefined;
  const batch = student ? batches.find((b) => b.studentIds.includes(student.id)) : undefined;
  const director = batch?.directorId ? staff.find((s) => s.id === batch.directorId) : undefined;
  return { user, student, batch, director };
}