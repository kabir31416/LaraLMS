import { useAuth } from "@/contexts/AuthContext";
import { useStudentSelfContext } from "@/contexts/StudentSelfContext";

export function useStudentSelf() {
  const { user } = useAuth();
  const { student, batch, directors, updateProfile, uploadPhoto, removePhoto } = useStudentSelfContext();
  return { user, student, batch, directors, updateProfile, uploadPhoto, removePhoto };
}
