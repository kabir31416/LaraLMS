import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as idCards from "./idCard.service";
import * as exams from "./examSchedule.service";
import { cardInstitution, cardSettingsView, getCardSettings, updateCardSettings } from "./cardCommon";

const p = (req: Request, k: string) => String(req.params[k]);

// ---- settings
/** Card design settings plus the institution branding they are printed with (for previews). */
export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const [settings, institution] = await Promise.all([getCardSettings(), cardInstitution()]);
  sendSuccess(res, { settings: cardSettingsView(settings), institution });
});
export const patchSettings = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, cardSettingsView(await updateCardSettings(req, req.body))));

// ---- ID cards
export const idStats = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await idCards.stats(req)));
export const idList = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await idCards.listStudents(req);
  sendSuccess(res, items, 200, meta);
});
export const idData = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await idCards.cardData(req, req.body)));
export const idGenerate = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await idCards.generate(req, req.body.selector, req.body.mode), 201));
export const idMine = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await idCards.myCard(req)));

// ---- exams
export const examOverview = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.overview(req)));
export const examList = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await exams.list(req);
  sendSuccess(res, items, 200, meta);
});
export const examGet = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.getOne(req, p(req, "id"))));
export const examCreate = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.create(req, req.body), 201));
export const examUpdate = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.update(req, p(req, "id"), req.body)));
export const examStatus = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.setStatus(req, p(req, "id"), req.body.status, req.body.reason)));
export const examDelete = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.remove(req, p(req, "id"))));
export const examEligible = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.eligible(req, p(req, "id"))));
export const examAssign = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.assign(req, p(req, "id"), req.body.studentIds, req.body.method)));
export const examUnassign = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.unassign(req, p(req, "id"), req.body.studentIds, req.body.reason)));
export const examAssignments = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await exams.assignments(req, p(req, "id"));
  sendSuccess(res, items, 200, meta);
});
export const admitGenerate = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.generateAdmits(req, p(req, "id"), req.body.selector, req.body.mode)));
export const admitData = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.admitData(req, p(req, "id"), req.body.selector, !!req.body.includePending)));
export const myExams = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.myExams(req)));
export const myAdmit = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.myAdmitCard(req, p(req, "examId"))));

// ---- public
export const verifyId = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await idCards.verify(p(req, "code"))));
export const verifyAdmit = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await exams.verifyAdmit(p(req, "code"))));
