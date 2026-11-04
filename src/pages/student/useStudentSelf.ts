import { useAuth } from "@/contexts/AuthContext";
import { useStudentSelfContext } from "@/contexts/StudentSelfContext";

export function useStudentSelf() {
  const { user } = useAuth();
  const { student, batch, directors, loading, refresh, updateProfile, uploadPhoto, removePhoto } = useStudentSelfContext();
  return { user, student, batch, directors, loading, refresh, updateProfile, uploadPhoto, removePhoto };
}
