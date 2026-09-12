import { Request } from "express";
import { User, UserDoc } from "./user.model";
import { Role } from "../rbac/role.model";
import { ApiError } from "../../common/utils/ApiError";
import { hashPassword, generateTempPassword } from "../../common/utils/password";
import { recordAudit } from "../../audit/auditLog.service";
import { parsePagination, buildMeta, buildSearchFilter } from "../../common/utils/pagination";
import { sendSms } from "../../common/utils/sms";
import { logger } from "../../logger/logger";

/**
 * Texts a Student's login credential to their own mobile number whenever
 * their login is created or reset (Phase 3 addendum — SMS delivery). Only
 * for Student accounts (`linkedStudentId` set): Staff logins are handed to
 * an admin in person/on-screen today, not SMS'd. Best-effort — a failed
 * send is logged and swallowed, never surfaced to the caller, since it must
 * never turn a successful login create/reset into a reported failure.
 */
async function notifyStudentCredential(identifier: string, plainPassword: string, linkedStudentId?: unknown): Promise<void> {
  if (!linkedStudentId) return;
  try {
    const { Student } = await import("../students/student.model");
    const student = await Student.findById(linkedStudentId, { name: 1 });
    const name = student?.name ? `${student.name}, ` : "";
    const message = `${name}আপনার LaraLMS Student Portal লগইন — মোবাইল: ${identifier}, পাসওয়ার্ড: ${plainPassword}`;
    await sendSms(identifier, message);
  } catch (err) {
    logger.warn({ err }, "failed to send student login-credential SMS — continuing without blocking");
  }
}

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
  const effectivePassword = input.password ?? tempPassword!;
  const passwordHash = await hashPassword(effectivePassword);

  const user = await User.create({
    identifier: input.identifier.toLowerCase(),
    passwordHash,
    roleId: input.roleId,
    linkedStaffId: input.linkedStaffId,
    linkedStudentId: input.linkedStudentId,
    mustChangePassword: !input.password,
  });

  await recordAudit({ req, action: "user.create", module: "users", targetCollection: "users", targetId: String(user._id), after: { identifier: user.identifier, roleId: user.roleId } });
  await notifyStudentCredential(user.identifier, effectivePassword, input.linkedStudentId);
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
  await notifyStudentCredential(user.identifier, patch.password, user.linkedStudentId);
  return user;
}

export async function deleteUser(req: Request, id: string): Promise<void> {
  const user = await getUserById(id);
  await user.deleteOne();
  await recordAudit({ req, action: "user.delete", module: "users", targetCollection: "users", targetId: id, before: user.toObject() });
}
