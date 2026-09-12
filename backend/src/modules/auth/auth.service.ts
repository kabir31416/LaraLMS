import { Request } from "express";
import crypto from "crypto";
import { User, UserDoc } from "../users/user.model";
import { Role } from "../rbac/role.model";
import { Student } from "../students/student.model";
import { RefreshToken } from "./refreshToken.model";
import { ApiError } from "../../common/utils/ApiError";
import { comparePassword, hashPassword } from "../../common/utils/password";
import { signAccessToken } from "../../common/utils/jwt";
import { parseDurationToMs } from "../../common/utils/duration";
import { env } from "../../config/env";
import { MAX_FAILED_LOGIN_ATTEMPTS } from "../../config/constants";
import { recordAudit } from "../../audit/auditLog.service";
import { DEFAULT_ROLE_PERMISSIONS } from "../rbac/permissions";
import { toAsciiDigits } from "../../common/utils/digits";

const REFRESH_BYTES = 48;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

async function resolvePermissions(user: UserDoc): Promise<{ role: { id: string; name: string }; permissions: string[] }> {
  const role = await Role.findById(user.roleId);
  if (!role) throw ApiError.internal("User has no valid role");
  const merged = role.permissions.includes("*") ? ["*"] : Array.from(new Set([...role.permissions, ...user.overridePermissions]));
  return { role: { id: String(role._id), name: role.name }, permissions: merged };
}

async function issueTokens(req: Request, user: UserDoc) {
  const { role, permissions } = await resolvePermissions(user);

  const accessToken = signAccessToken({
    sub: String(user._id),
    roleId: role.id,
    role: role.name,
    permissions,
    staffId: user.linkedStaffId ? String(user.linkedStaffId) : undefined,
    studentId: user.linkedStudentId ? String(user.linkedStudentId) : undefined,
  });

  const rawRefresh = crypto.randomBytes(REFRESH_BYTES).toString("hex");
  await RefreshToken.create({
    userId: user._id,
    tokenHash: hashToken(rawRefresh),
    device: req.headers["user-agent"],
    ip: req.ip,
    expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN)),
  });

  return {
    accessToken,
    refreshToken: rawRefresh,
    user: {
      id: String(user._id),
      identifier: user.identifier,
      role: role.name,
      mustChangePassword: user.mustChangePassword,
      staffId: user.linkedStaffId,
      studentId: user.linkedStudentId,
    },
  };
}

export async function login(req: Request, identifier: string, password: string) {
  const user = await User.findOne({ identifier: identifier.toLowerCase() }).select("+passwordHash");
  // Same generic message whether the identifier doesn't exist or the password is wrong —
  // never let login responses reveal which one failed (Phase 1 §9).
  const genericError = () => ApiError.unauthorized("Invalid credentials");
  if (!user) throw genericError();

  if (user.status === "locked") throw ApiError.forbidden("This account is locked — contact an administrator");

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS) user.status = "locked";
    await user.save();
    await recordAudit({ req, action: "auth.login-failed", module: "auth", targetCollection: "users", targetId: String(user._id) });
    throw genericError();
  }

  user.failedLoginCount = 0;
  user.lastLoginAt = new Date();
  await user.save();

  const result = await issueTokens(req, user);
  await recordAudit({ req, action: "auth.login", module: "auth", targetCollection: "users", targetId: String(user._id) });
  return result;
}

/**
 * Direct Student Portal login: no separately-maintained password at all —
 * a match against the student's own live phone number + Roll Number *is*
 * the credential, checked fresh every time against the Student collection
 * itself. This sidesteps the entire class of bugs a separate hashed
 * User-account password kept hitting (never created, created with a stale
 * value, digit-format mismatches): there's nothing to fall out of sync
 * with, because nothing is stored except the Student record admins
 * already maintain.
 *
 * A linked User account is still ensured behind the scenes (created with a
 * random, never-used password) purely so the rest of the session
 * machinery — access/refresh tokens, RBAC, audit logging — stays exactly
 * the one already used for Admin/Staff, rather than a second parallel
 * system. Its password is never what's checked here.
 */
export async function studentLogin(req: Request, phone: string, rollNumber: string) {
  const genericError = () => ApiError.unauthorized("Invalid credentials");

  const normalizedPhone = phone.trim();
  const normalizedRoll = toAsciiDigits(rollNumber).trim();
  if (!normalizedPhone || !normalizedRoll) throw genericError();

  const student = await Student.findOne({ phone: normalizedPhone });
  if (!student || !student.currentRollNumber) throw genericError();
  if (toAsciiDigits(student.currentRollNumber).trim() !== normalizedRoll) throw genericError();

  let role = await Role.findOne({ name: "student" });
  if (!role) {
    role = await Role.create({ name: "student", permissions: DEFAULT_ROLE_PERMISSIONS.student, isSystem: true });
  }

  let user = await User.findOne({ linkedStudentId: student._id });
  if (!user) {
    const identifier = normalizedPhone.toLowerCase();
    const clash = await User.findOne({ identifier });
    if (clash) {
      // Identifier taken by an account not linked to this student (e.g. a
      // shared family phone used for a sibling/staff login already) — a
      // real conflict for an admin to resolve, not something to paper over.
      throw ApiError.conflict("This phone number is already linked to a different account — contact an administrator");
    }
    user = await User.create({
      identifier,
      passwordHash: await hashPassword(crypto.randomBytes(24).toString("hex")),
      roleId: role._id,
      linkedStudentId: student._id,
      mustChangePassword: false,
    });
  }

  if (user.status === "locked") throw ApiError.forbidden("This account is locked — contact an administrator");

  const result = await issueTokens(req, user);
  await recordAudit({ req, action: "auth.student-login", module: "auth", targetCollection: "users", targetId: String(user._id) });
  return result;
}

export async function refresh(req: Request, rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await User.findById(stored.userId);
  if (!user || user.status === "locked") throw ApiError.unauthorized("Account unavailable");

  stored.revokedAt = new Date();
  await stored.save();

  return issueTokens(req, user);
}

export async function logout(rawRefreshToken?: string): Promise<void> {
  if (!rawRefreshToken) return;
  await RefreshToken.updateOne({ tokenHash: hashToken(rawRefreshToken) }, { $set: { revokedAt: new Date() } });
}

export async function changePassword(req: Request, userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw ApiError.notFound("User not found");

  const valid = await comparePassword(currentPassword, user.passwordHash);
  if (!valid) throw ApiError.badRequest("Current password is incorrect");

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
  // Force re-login everywhere else — a changed password invalidates all standing sessions.
  await RefreshToken.updateMany({ userId: user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  await recordAudit({ req, action: "auth.change-password", module: "auth", targetCollection: "users", targetId: userId });
}

export async function me(userId: string) {
  const user = await User.findById(userId).populate("roleId", "name permissions");
  if (!user) throw ApiError.notFound("User not found");
  return user;
}
