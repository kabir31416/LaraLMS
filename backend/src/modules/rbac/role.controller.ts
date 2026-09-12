import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import * as roleService from "./role.service";
import { ALL_PERMISSION_KEYS } from "./permissions";

export const listPermissions = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, ALL_PERMISSION_KEYS);
});

export const listRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await roleService.listRoles();
  sendSuccess(res, roles);
});

export const getRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.getRoleById(req.params.id);
  sendSuccess(res, role);
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.createRole(req, req.body);
  sendSuccess(res, role, 201);
});

export const updateRolePermissions = asyncHandler(async (req: Request, res: Response) => {
  const role = await roleService.updatePermissions(req, req.params.id, req.body.permissions ?? []);
  sendSuccess(res, role);
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  await roleService.deleteRole(req, req.params.id);
  sendSuccess(res, { deleted: true });
});
