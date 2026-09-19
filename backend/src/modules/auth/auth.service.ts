import { Request } from "express";
import crypto from "crypto";
import { User, UserDoc } from "../users/user.model";
import { Role } from "../rbac/role.model";
import { Student } from "../students/student.model";
import { Staff, StaffDoc } from "../staff/staff.model";
import { RefreshToken } from "./refreshToken.model";
import { ApiError } from "../../common/utils/ApiError";
import { comparePassword, hashPassword, normalizeIdentifier } from "../../common/utils/password";
import { signAccessToken } from "../../common/utils/jwt";
import { parseDurationToMs } from "../../common/utils/duration";
import { env } from "../../config/env";
import { MAX_FAILED_LOGIN_ATTEMPTS } from "../../config/constants";
import { recordAudit } from "../../audit/auditLog.service";
import { ALL_PERMISSION_KEYS, DEFAULT_ROLE_PERMISSIONS } from "../rbac/permissions";
import { toAsciiDigits } from "../../common/utils/digits";

const REFRESH_BYTES = 48;

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * A wildcard ("*") role normally collapses straight to ["*"] — but if this
 * specific user has one or more permissions explicitly revoked
 * (deniedPermissions, e.g. an Admin individually blocked from Admission
 * Result), "*" can no longer be used as-is: requirePermission's own
 * "*" shortcut would ignore the denial entirely. Materializing the full
 * concrete permission list minus the denied ones preserves every other
 * permission exactly as "*" would have, while still letting the denied
 * key fail its check. A user with no denials (the overwhelming majority,
 * and every existing Admin as of when this field was added) still gets
 * the plain "*" string, unchanged from before.
 */
async function resolvePermissions(user: UserDoc): Promise<{ role: { id: string; name: string }; permissions: string[] }> {
  const role = await Role.findById(user.roleId);
  if (!role) throw ApiError.internal("User has no valid role");
  let merged: string[];
  if (role.permissions.includes("*")) {
    merged = user.deniedPermissions?.length ? ALL_PERMISSION_KEYS.filter((p) => !user.deniedPermissions.includes(p)) : ["*"];
  } else {
    merged = Array.from(new Set([...role.permissions, ...user.overridePermissions]));
  }
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
      // Same array already embedded in the access token — surfaced here too
      // so the Admin frontend can conditionally show/hide something (e.g.
      // the Admission Result nav item) without decoding the JWT itself.
      // Never a new source of truth: every actual enforcement decision is
      // still made server-side by requirePermission off the token.
      permissions,
    },
  };
}

export async function login(req: Request, identifier: string, password: string) {
  // normalizeIdentifier() is the SAME function createUser()/resetCredentials()
  // use before saving (common/utils/password.ts) — one shared rule so a
  // lookup here can never silently diverge from how the value was stored
  // (e.g. one side trimming whitespace and the other not).
  const user = await User.findOne({ identifier: normalizeIdentifier(identifier) }).select("+passwordHash");
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
 * A Bangladeshi mobile number can be typed as "01XXXXXXXXX" (local, 11
 * digits — how every Student record in this app stores it) or with a
 * country code ("+8801XXXXXXXXX" / "8801XXXXXXXXX", 13 digits once
 * non-digits are stripped). This normalizes an input to the local form so
 * either typing style matches the stored value, without ever touching the
 * stored value itself.
 */
function normalizePhoneForLookup(input: string): string {
  const digits = toAsciiDigits(input).replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("880")) return "0" + digits.slice(3);
  return digits;
}

/**
 * Student Portal login — a pure, read-only lookup. Phone + Roll Number
 * matching the *same* Student record is the entire credential; there is no
 * separate password, no login/User account, and this function performs no
 * database write of any kind. A previous design lazily provisioned a
 * linked User account behind the scenes so the existing Admin/Staff
 * session machinery (issueTokens, backed by a User + Role document) could
 * be reused — but that write path kept surfacing "already exists" whenever
 * it raced or hit a stale record, which is exactly the class of bug a
 * read-only design can't have. The access token is signed directly here,
 * with the fixed default Student permission set (rbac/permissions.ts) —
 * no Role document lookup either.
 */
export async function studentLogin(phone: string, rollNumber: string) {
  const genericError = () => ApiError.unauthorized("Phone number or roll number is incorrect");

  const normalizedPhone = normalizePhoneForLookup(phone);
  const normalizedRoll = toAsciiDigits(rollNumber).trim();
  if (!normalizedPhone || !normalizedRoll) throw genericError();

  const student = await Student.findOne({ phone: normalizedPhone, currentRollNumber: normalizedRoll });
  if (!student) throw genericError();

  const accessToken = signAccessToken(
    {
      sub: String(student._id),
      roleId: "",
      role: "student",
      permissions: DEFAULT_ROLE_PERMISSIONS.student,
      studentId: String(student._id),
    },
    env.PORTAL_ACCESS_EXPIRES_IN,
  );

  return {
    accessToken,
    student: {
      id: String(student._id),
      name: student.name,
      phone: student.phone,
      currentRollNumber: student.currentRollNumber,
    },
  };
}

/**
 * Only staff types with a real portal home page today map to a role here —
 * currently just Batch Director (see routes.tsx's "/director" section on
 * the frontend). Admin keeps its existing identifier+password login
 * (User/Role model, via login() above) — this map deliberately excludes
 * "Admin" so a Staff row of that type can't also get in through the
 * phone+staffId door.
 */
const STAFF_TYPE_TO_ROLE: Partial<Record<StaffDoc["staffType"], "batch_director">> = {
  "Batch Director": "batch_director",
};

/**
 * Staff Portal login — the same pure read-only design as studentLogin
 * above, and for the same reason: an earlier "create a User account for
 * this staff member" flow (still used for Admin logins) kept hitting
 * duplicate-key conflicts when identifiers collided or a create/re-create
 * raced. Phone + Staff ID matching the *same* Staff record is the entire
 * credential — no password, no login/User account, no database write here
 * at all.
 */
export async function staffLogin(phone: string, staffId: string) {
  const genericError = () => ApiError.unauthorized("Phone number or staff ID is incorrect");

  const normalizedPhone = normalizePhoneForLookup(phone);
  const normalizedStaffId = toAsciiDigits(staffId).trim();
  if (!normalizedPhone || !normalizedStaffId) throw genericError();

  const staff = await Staff.findOne({ phone: normalizedPhone, staffId: normalizedStaffId });
  if (!staff) throw genericError();

  const roleName = STAFF_TYPE_TO_ROLE[staff.staffType];
  if (!roleName) {
    throw ApiError.forbidden("এই স্টাফ টাইপের জন্য এখনো কোনো পোর্টাল চালু নেই — Batch Director ছাড়া অন্য কেউ এই লগইন ব্যবহার করতে পারবে না");
  }

  const accessToken = signAccessToken(
    {
      sub: String(staff._id),
      roleId: "",
      role: roleName,
      permissions: DEFAULT_ROLE_PERMISSIONS[roleName],
      staffId: String(staff._id),
    },
    env.PORTAL_ACCESS_EXPIRES_IN,
  );

  return {
    accessToken,
    staff: {
      id: String(staff._id),
      name: staff.name,
      phone: staff.phone,
      staffId: staff.staffId,
      staffType: staff.staffType,
      role: roleName,
    },
  };
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
