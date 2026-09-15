import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as service from "./material.service";

// -------------------- Material Master --------------------

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.list(req);
  sendSuccess(res, items, 200, meta);
});

export const getById = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getById(req.params.id)));

export const create = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.create(req, req.body), 201));

export const update = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.update(req, req.params.id, req.body)));

export const setStatus = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.setStatus(req, req.params.id, req.body.status)));

// -------------------- Stock Management --------------------

export const addStock = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.addStock(req, req.params.id, req.body.quantity, req.body.reason)));

export const adjustStock = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.adjustStock(req, req.params.id, req.body.quantity, req.body.reason, req.body.note)),
);

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.listMovements(req, req.params.id);
  sendSuccess(res, items, 200, meta);
});

// -------------------- Student Distribution --------------------

export const checkDuplicate = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.checkDuplicate(req.body.studentId, req.body.materialIds)),
);

export const createDistribution = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.createDistribution(req, req.body), 201));

export const listDistributions = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.listDistributions(req);
  sendSuccess(res, items, 200, meta);
});

export const getDistributionById = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getDistributionById(req.params.id)));

export const reverseDistribution = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, await service.reverseDistribution(req, req.params.id, req.body.reason)),
);

// -------------------- Student Material History --------------------

export const getStudentHistory = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getStudentHistory(req, req.params.studentId)));

// -------------------- Dashboard --------------------

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.getDashboardStats(req)));

// -------------------- Reports --------------------

export const stockReport = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.stockReport(req)));

export const distributionReport = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await service.distributionReport(req);
  sendSuccess(res, items, 200, meta);
});

export const studentWiseReport = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.studentWiseReport(req)));

export const materialWiseReport = asyncHandler(async (req: Request, res: Response) => sendSuccess(res, await service.materialWiseReport(req)));
