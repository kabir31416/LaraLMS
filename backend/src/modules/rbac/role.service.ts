import { Request } from "express";
import { Role, RoleDoc } from "./role.model";
import { ApiError } from "../../common/utils/ApiError";
import { recordAudit } from "../../audit/auditLog.service";

export async function listRoles(): Promise<RoleDoc[]> {
  return Role.find().sort({ name: 1 });
}

export async function getRoleById(id: string): Promise<RoleDoc> {
  const role = await Role.findById(id);
  if (!role) throw ApiError.notFound("Role not found");
  return role;
}

export async function createRole(req: Request, data: { name: string; permissions: string[] }): Promise<RoleDoc> {
  const existing = await Role.findOne({ name: data.name.toLowerCase() });
  if (existing) throw ApiError.conflict(`Role "${data.name}" already exists`);

  const role = await Role.create({ name: data.name.toLowerCase(), permissions: data.permissions, isSystem: false });
  await recordAudit({ req, action: "role.create", module: "rbac", targetCollection: "roles", targetId: String(role._id), after: role.toObject() });
  return role;
}

export async function updatePermissions(req: Request, id: string, permissions: string[]): Promise<RoleDoc> {
  const role = await getRoleById(id);
  if (role.isSystem && !permissions.length) {
    throw ApiError.badRequest("Cannot strip all permissions from a built-in system role");
  }
  const before = role.toObject();
  role.permissions = permissions;
  await role.save();
  await recordAudit({ req, action: "role.update-permissions", module: "rbac", targetCollection: "roles", targetId: id, before, after: role.toObject() });
  return role;
}

export async function deleteRole(req: Request, id: string): Promise<void> {
  const role = await getRoleById(id);
  if (role.isSystem) throw ApiError.forbidden("Built-in system roles cannot be deleted");
  await role.deleteOne();
  await recordAudit({ req, action: "role.delete", module: "rbac", targetCollection: "roles", targetId: id, before: role.toObject() });
}
