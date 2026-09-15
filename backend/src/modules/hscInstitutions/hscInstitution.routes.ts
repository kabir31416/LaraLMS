import { Router } from "express";
import { requireAuth } from "../../common/middlewares/auth.middleware";
import { validate } from "../../common/middlewares/validate.middleware";
import { listQuerySchema } from "./hscInstitution.validation";
import * as controller from "./hscInstitution.controller";

/**
 * Read-only from the outside — same convention as course.routes.ts's GET
 * (open to any authenticated role, no extra permission needed since it's
 * low-sensitivity reference data). There is deliberately no POST/PATCH/DELETE
 * here: an institution is only ever created as a side effect of
 * student.service.ts's create()/update() (via getOrCreateByName), never
 * through a standalone privileged write endpoint.
 */
const router = Router();

router.use(requireAuth);
router.get("/", validate(listQuerySchema), controller.list);

export default router;
