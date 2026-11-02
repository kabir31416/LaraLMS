import { Navigate, useLocation } from "react-router-dom";
import { hasPermission, useAuth, type Role } from "@/contexts/AuthContext";
import { ChangePasswordGate } from "@/components/ChangePasswordGate";

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
  if (role === "Mess Staff") return "/mess";
  return "/";
}

/** The login portal that owns a protected path — a signed-out visitor is sent to the right one, with `next` so they return afterwards. */
export function loginRouteFor(pathname: string): string {
  if (pathname.startsWith("/student")) return "/studentLogin";
  if (pathname.startsWith("/director") || pathname.startsWith("/mess")) return "/staffLogin";
  return "/adminLogin";
}

export function ProtectedRoute({ children, roles, permission }: Props) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) return null; // avoid a flash-redirect to a login page while the session cookie is being checked
  if (!user) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`${loginRouteFor(location.pathname)}?next=${encodeURIComponent(next)}`} replace />;
  }
  // A forced password change (backend's User.mustChangePassword — set for
  // the seeded root Super Admin, and for any login created/reset without an
  // explicit password) blocks every protected page until resolved, ahead of
  // the role/permission checks below, since a stale/default credential is a
  // bigger problem than which page was requested.
  if (user.mustChangePassword) return <ChangePasswordGate />;
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
