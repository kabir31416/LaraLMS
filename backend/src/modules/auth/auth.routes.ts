import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { authLimiter } from "../../common/middlewares/rateLimit.middleware";
import { changePasswordSchema, loginSchema, studentLoginSchema } from "./auth.validation";
import * as authController from "./auth.controller";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/student-login", authLimiter, validate(studentLoginSchema), authController.studentLogin);
router.post("/refresh", authLimiter, authController.refresh);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);
router.post("/change-password", requireAuth, validate(changePasswordSchema), authController.changePassword);

export default router;
