import { Request } from "express";
import crypto from "crypto";
import { User, UserDoc } from "../users/user.model";
import { Role } from "../rbac/role.model";
import { RefreshToken } from "./refreshToken.model";
import { ApiError } from "../../common/utils/ApiError";
import { comparePassword, hashPassword } from "../../common/utils/password";
import { signAccessToken } from "../../common/utils/jwt";
import { parseDurationToMs } from "../../common/utils/duration";
import { env } from "../../config/env";
import { MAX_FAILED_LOGIN_ATTEMPTS } from "../../config/constants";
import { recordAudit } from "../../audit/auditLog.service";

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
