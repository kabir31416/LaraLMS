import { Navigate } from "react-router-dom";
import { hasPermission, useAuth, type Role } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
  roles?: Role[];
  /** When set, the caller must additionally hold this permission key (or "*") — see AuthContext's hasPermission. Used to gate a page whose access can be individually restricted per-Admin (e.g. Admission Result) without a separate role. */
  permission?: string;
}

/** Each role's own landing page — "/" itself is Admin-only, so anything that falls through to it for a non-Admin role would just bounce straight back here. Exported so Login.tsx can send a freshly-logged-in user to the right place too. */
export function homeRouteFor(role: Role): string {
  if (role === "Batch Director") return "/director";
  if (role === "Student") return "/student";
  return "/";
}

export function ProtectedRoute({ children, roles, permission }: Props) {
  const { user, initializing } = useAuth();
  if (initializing) return null; // avoid a flash-redirect to /login while the session cookie is being checked
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homeRouteFor(user.role)} replace />;
  }
  // Backend still enforces this on every API call regardless — this only
  // stops the page itself (and any direct-URL navigation to it) from
  // rendering for a caller the server would reject anyway.
  if (permission && !hasPermission(user, permission)) {
    return <Navigate to={homeRouteFor(user.role)} replace />;
  }
  return <>{children}</>;
}
