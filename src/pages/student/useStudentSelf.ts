import { useAuth } from "@/contexts/AuthContext";
import { useStudentSelfContext } from "@/contexts/StudentSelfContext";

export function useStudentSelf() {
  const { user } = useAuth();
  const { student, batch, director } = useStudentSelfContext();
  return { user, student, batch, director };
}
