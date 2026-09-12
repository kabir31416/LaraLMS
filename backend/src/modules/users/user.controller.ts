import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as userService from "./user.service";

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { user, tempPassword } = await userService.createUser(req, req.body);
  sendSuccess(res, { user, tempPassword }, 201);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const { items, meta } = await userService.listUsers(req);
  sendSuccess(res, items, 200, meta);
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.updateUser(req, req.params.id, req.body);
  sendSuccess(res, user);
});

export const resetCredentials = asyncHandler(async (req: Request, res: Response) => {
  const user = await userService.resetCredentials(req, req.params.id, req.body);
  sendSuccess(res, user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await userService.deleteUser(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
