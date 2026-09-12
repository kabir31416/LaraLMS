import { Request } from "express";
import { User, UserDoc } from "./user.model";
import { Role } from "../rbac/role.model";
import { ApiError } from "../../common/utils/ApiError";
import { hashPassword, generateTempPassword } from "../../common/utils/password";
import { recordAudit } from "../../audit/auditLog.service";
import { parsePagination, buildMeta, buildSearchFilter } from "../../common/utils/pagination";

interface CreateUserInput {
  identifier: string;
  password?: string;
  roleId: string;
  linkedStaffId?: string;
  linkedStudentId?: string;
}

export async function createUser(req: Request, input: CreateUserInput): Promise<{ user: UserDoc; tempPassword?: string }> {
  const role = await Role.findById(input.roleId);
  if (!role) throw ApiError.badRequest("Unknown roleId");

  const existing = await User.findOne({ identifier: input.identifier.toLowerCase() });
  if (existing) throw ApiError.conflict("A user with this identifier already exists");

  const tempPassword = input.password ? undefined : generateTempPassword();
  const passwordHash = await hashPassword(input.password ?? tempPassword!);

  const user = await User.create({
    identifier: input.identifier.toLowerCase(),
    passwordHash,
    roleId: input.roleId,
    linkedStaffId: input.linkedStaffId,
    linkedStudentId: input.linkedStudentId,
    mustChangePassword: !input.password,
  });

  await recordAudit({ req, action: "user.create", module: "users", targetCollection: "users", targetId: String(user._id), after: { identifier: user.identifier, roleId: user.roleId } });
  return { user, tempPassword };
}

export async function listUsers(req: Request) {
  const { page, limit, skip, sort } = parsePagination(req, { createdAt: -1 });
  const filter: Record<string, unknown> = {
    ...buildSearchFilter(req.query.search, ["identifier"]),
  };
  if (req.query.roleId) filter.roleId = req.query.roleId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.linkedStaffId) filter.linkedStaffId = req.query.linkedStaffId;
  if (req.query.linkedStudentId) filter.linkedStudentId = req.query.linkedStudentId;

  const [items, total] = await Promise.all([
    User.find(filter).populate("roleId", "name").sort(sort).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(page, limit, total) };
}

export async function getUserById(id: string): Promise<UserDoc> {
  const user = await User.findById(id).populate("roleId", "name permissions");
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export async function updateUser(req: Request, id: string, patch: { roleId?: string; status?: "active" | "locked"; overridePermissions?: string[] }): Promise<UserDoc> {
  const user = await getUserById(id);
  const before = user.toObject();
  if (patch.roleId) user.roleId = patch.roleId as never;
  if (patch.status) {
    user.status = patch.status;
    if (patch.status === "active") user.failedLoginCount = 0;
  }
  if (patch.overridePermissions) user.overridePermissions = patch.overridePermissions;
  await user.save();
  await recordAudit({ req, action: "user.update", module: "users", targetCollection: "users", targetId: id, before, after: user.toObject() });
  return user;
}

/**
 * Admin-forced reset of an existing login's identifier/password — the fix
 * for a stale credential (e.g. a Student's Roll Number was changed after
 * their login was created, so the old password hash no longer matches what
 * the admin now shows them). Self-service change-password can't help here
 * since it requires the *current* password, which is exactly what's wrong.
 */
export async function resetCredentials(req: Request, id: string, patch: { identifier?: string; password: string }): Promise<UserDoc> {
  const user = await getUserById(id);
  const before = user.toObject();

  if (patch.identifier) {
    const normalized = patch.identifier.toLowerCase();
    if (normalized !== user.identifier) {
      const clash = await User.findOne({ identifier: normalized, _id: { $ne: user._id } });
      if (clash) throw ApiError.conflict("Another account already uses this identifier");
      user.identifier = normalized;
    }
  }

  user.passwordHash = await hashPassword(patch.password);
  user.mustChangePassword = false;
  user.failedLoginCount = 0;
  if (user.status === "locked") user.status = "active";
  await user.save();

  await recordAudit({ req, action: "user.reset-credentials", module: "users", targetCollection: "users", targetId: id, before, after: { identifier: user.identifier } });
  return user;
}

export async function deleteUser(req: Request, id: string): Promise<void> {
  const user = await getUserById(id);
  await user.deleteOne();
  await recordAudit({ req, action: "user.delete", module: "users", targetCollection: "users", targetId: id, before: user.toObject() });
}
