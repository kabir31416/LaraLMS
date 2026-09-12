import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes";
import userRoutes from "../modules/users/user.routes";
import roleRoutes from "../modules/rbac/role.routes";

/**
 * Every module's router is mounted here under /api/v1/... — Phase 2 §12.
 * Modules 4-27 (Dashboard, Settings, Academic data, Students, Fees, ...)
 * are added to this same list as each is implemented; see the task tracker.
 */
const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);

export default router;
