import { Navigate } from "react-router-dom";
import { useAuth, type Role } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
  roles?: Role[];
}

/** Each role's own landing page — "/" itself is Admin-only, so anything that falls through to it for a non-Admin role would just bounce straight back here. */
function homeRouteFor(role: Role): string {
  if (role === "Batch Director") return "/director";
  if (role === "Student") return "/student";
  return "/";
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, initializing } = useAuth();
  if (initializing) return null; // avoid a flash-redirect to /login while the session cookie is being checked
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeRouteFor(user.role)} replace />;
  }
  return <>{children}</>;
}
