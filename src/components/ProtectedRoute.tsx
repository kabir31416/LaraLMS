import { Navigate } from "react-router-dom";
import { useAuth, type Role } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    // Director hitting an admin page → send to director dashboard
    return <Navigate to={user.role === "Batch Director" ? "/director" : "/"} replace />;
  }
  return <>{children}</>;
}
