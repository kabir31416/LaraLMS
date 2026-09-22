import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as smsService from "./sms.service";
import { SmsTemplatedEvent } from "./sms.constants";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await smsService.getSmsSettingsForApi());
});

export const updateProvider = asyncHandler(async (req: Request, res: Response) => {
  await smsService.updateActiveProvider(req, req.body.activeProvider);
  sendSuccess(res, await smsService.getSmsSettingsForApi());
});

export const updateAlphaSettings = asyncHandler(async (req: Request, res: Response) => {
  await smsService.updateAlphaSettings(req, req.body);
  sendSuccess(res, await smsService.getSmsSettingsForApi());
});

export const updateBulkSmsBdSettings = asyncHandler(async (req: Request, res: Response) => {
  await smsService.updateBulkSmsBdSettings(req, req.body);
  sendSuccess(res, await smsService.getSmsSettingsForApi());
});

export const updateEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await smsService.updateEvents(req, req.body);
  sendSuccess(res, events);
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await smsService.updateEventTemplate(req, req.params.event as SmsTemplatedEvent, req.body.template);
  sendSuccess(res, { template });
});

export const checkBalance = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, await smsService.checkBalance());
});

export const sendTest = asyncHandler(async (req: Request, res: Response) => {
  const result = await smsService.sendTestSms(req.body.to, req.body.message);
  sendSuccess(res, result);
});

export const getDeliveryReport = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await smsService.getDeliveryReport(req.params.requestId));
});

export const listLogs = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await smsService.listSmsLogs(req);
  sendSuccess(res, items, 200, meta);
});
