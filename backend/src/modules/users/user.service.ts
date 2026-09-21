import { Request } from "express";
import { User, UserDoc } from "./user.model";
import { Role } from "../rbac/role.model";
import { ApiError } from "../../common/utils/ApiError";
import { hashPassword, generateTempPassword, normalizeIdentifier } from "../../common/utils/password";
import { recordAudit } from "../../audit/auditLog.service";
import { parsePagination, buildMeta, buildSearchFilter } from "../../common/utils/pagination";
import { sendSms } from "../sms/sms.service";
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
    // "login" is not one of the 4 configurable events (SMS Provider Upgrade
    // §4) — it always sends, same unconditional behavior as before this
    // module existed, just now going through whichever provider is active.
    await sendSms({ to: identifier, message, eventType: "login", studentId: String(linkedStudentId) });
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
  deniedPermissions?: string[];
}

function isDuplicateKeyError(err: unknown): boolean {
  return !!(err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000);
}

/**
 * True only for the original seeded root Admin (User.isSuperAdmin). For an
 * install that had its Admin seeded before this field existed, nobody is
 * flagged yet — in that case, the earliest-created Admin-role user (the
 * seeded account in every install, old or new) is treated as the super
 * admin, so the restriction below takes effect immediately without a
 * separate manual migration step. Called once at login time (auth.service.ts)
 * to bake the result into the JWT, not on every request.
 */
export async function resolveIsSuperAdmin(user: UserDoc): Promise<boolean> {
  if (user.isSuperAdmin) return true;
  const anyFlagged = await User.exists({ isSuperAdmin: true });
  if (anyFlagged) return false;
  const role = await Role.findById(user.roleId);
  if (!role || !role.permissions.includes("*")) return false;
  const earliestAdmin = await User.findOne({ roleId: user.roleId }).sort({ createdAt: 1 });
  return !!earliestAdmin && String(earliestAdmin._id) === String(user._id);
}

/** Throws unless the requester is the super admin — see resolveIsSuperAdmin(). */
export function assertSuperAdmin(req: Request): void {
  if (!req.user?.isSuperAdmin) {
    throw ApiError.forbidden("Only the original Super Admin account can do this");
  }
}

/**
 * A regular Admin can create other Admins and set their initial module
 * permissions, but must not be able to later edit an existing Admin's own
 * login (role/status/permissions/credentials) — otherwise any Admin could
 * escalate/deescalate another Admin's access, lock them out, or take over
 * their account outright. Only the root Super Admin may do that.
 */
async function isAdminRoleUser(user: UserDoc): Promise<boolean> {
  const role = await Role.findById(user.roleId);
  return role?.name === "admin";
}

/**
 * Turns the generic "already exists" conflict into a self-diagnosing one —
 * names exactly which existing account the identifier collides with, so an
 * operator (who already holds USERS_MANAGE to even reach this endpoint,
 * i.e. can already list every user) can immediately tell "this identifier
 * is genuinely already in use by X" apart from "this looks like a bug",
 * without needing server log access at all.
 */
async function describeExistingOwner(existing: UserDoc): Promise<string> {
  if (existing.linkedStaffId) {
    const { Staff } = await import("../staff/staff.model");
    const staff = await Staff.findById(existing.linkedStaffId).select("name staffType");
    if (staff) return `${staff.staffType} "${staff.name}"`;
    return "a staff account (that staff record has since been removed)";
  }
  if (existing.linkedStudentId) {
    const { Student } = await import("../students/student.model");
    const student = await Student.findById(existing.linkedStudentId).select("name");
    if (student) return `student "${student.name}"`;
    return "a student account (that student record has since been removed)";
  }
  // No linked Staff/Student — most commonly the initial seeded Super Admin
  // account (backend/src/scripts/seed.ts's seedAdmin(), identifier defaults
  // to ADMIN_SEED_PHONE, "01700000000" unless overridden), a very guessable
  // value a tester can easily retype without realizing it's already taken.
  return "an existing Admin login not linked to any staff record (this is often the initial seeded Super Admin account)";
}

/**
 * Resolves an identifier collision — either an idempotent reset (the
 * existing login already belongs to the *same* staff/student, e.g. a
 * retried request) or a real conflict (a different owner already uses this
 * identifier), never a raw duplicate-key error.
 */
async function resolveIdentifierCollision(
  req: Request,
  existing: UserDoc,
  input: CreateUserInput,
  passwordHash: string,
  effectivePassword: string,
  tempPassword: string | undefined,
): Promise<{ user: UserDoc; tempPassword?: string }> {
  const sameOwner =
    (!!input.linkedStudentId && String(existing.linkedStudentId ?? "") === input.linkedStudentId) ||
    (!!input.linkedStaffId && String(existing.linkedStaffId ?? "") === input.linkedStaffId);
  if (!sameOwner) {
    const owner = await describeExistingOwner(existing);
    throw ApiError.conflict(`A user with this identifier already exists — currently linked to ${owner}. Use a different login identifier.`);
  }

  const before = existing.toObject();
  existing.passwordHash = passwordHash;
  existing.roleId = input.roleId as never;
  existing.mustChangePassword = !input.password;
  existing.failedLoginCount = 0;
  if (existing.status === "locked") existing.status = "active";
  if (input.deniedPermissions) existing.deniedPermissions = input.deniedPermissions;
  await existing.save();

  await recordAudit({ req, action: "user.create", module: "users", targetCollection: "users", targetId: String(existing._id), before, after: { identifier: existing.identifier, roleId: existing.roleId } });
  await notifyStudentCredential(existing.identifier, effectivePassword, input.linkedStudentId);
  return { user: existing, tempPassword };
}

/**
 * Creates a login for a staff member or student. The identifier's unique
 * index is the SINGLE source of truth for "does this already exist" — this
 * always attempts the insert directly rather than checking first and
 * inserting second, which closes the race window a separate find-then-
 * insert would otherwise leave open (two concurrent requests could both see
 * "doesn't exist yet" and both try to create, one of them then hitting a
 * raw duplicate-key error the caller never asked for). Only when the
 * insert itself reports a collision do we look up who it belongs to — at
 * that point the identifier is guaranteed to exist, so unlike an upfront
 * check there is nothing left to race against.
 */
export async function createUser(req: Request, input: CreateUserInput, retriesLeft = 1): Promise<{ user: UserDoc; tempPassword?: string }> {
  const role = await Role.findById(input.roleId);
  if (!role) throw ApiError.badRequest("Unknown roleId");

  const normalizedIdentifier = normalizeIdentifier(input.identifier);
  const tempPassword = input.password ? undefined : generateTempPassword();
  const effectivePassword = input.password ?? tempPassword!;
  const passwordHash = await hashPassword(effectivePassword);

  let user: UserDoc;
  try {
    user = await User.create({
      identifier: normalizedIdentifier,
      passwordHash,
      roleId: input.roleId,
      linkedStaffId: input.linkedStaffId,
      linkedStudentId: input.linkedStudentId,
      mustChangePassword: !input.password,
      deniedPermissions: input.deniedPermissions ?? [],
    });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;

    const existing = await User.findOne({ identifier: normalizedIdentifier });
    // Temporary diagnostic — safe fields only (never password/hash/tokens).
    // Remove once the "false duplicate" report is confirmed resolved.
    logger.info(
      {
        receivedIdentifier: input.identifier,
        normalizedIdentifier,
        linkedStaffId: input.linkedStaffId,
        linkedStudentId: input.linkedStudentId,
        existingId: existing ? String(existing._id) : undefined,
        existingRoleId: existing ? String(existing.roleId) : undefined,
        existingLinkedStaffId: existing?.linkedStaffId ? String(existing.linkedStaffId) : undefined,
        existingLinkedStudentId: existing?.linkedStudentId ? String(existing.linkedStudentId) : undefined,
        existingCreatedAt: existing?.createdAt,
      },
      "ADMIN CREATE DEBUG — duplicate-key collision on createUser()",
    );
    if (!existing) {
      // The insert just failed BECAUSE this identifier existed, so it is
      // not simply "not found yet" — this only happens if it was deleted in
      // the instant between our failed insert and this lookup. Safe to
      // treat as if our own insert race had simply not happened: retry once
      // (retriesLeft bounds this so a persistent anomaly fails loudly
      // instead of recursing forever).
      if (retriesLeft <= 0) throw ApiError.conflict("A user with this identifier already exists. Use a different login identifier.");
      return createUser(req, input, retriesLeft - 1);
    }
    return resolveIdentifierCollision(req, existing, input, passwordHash, effectivePassword, tempPassword);
  }

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

export async function updateUser(
  req: Request,
  id: string,
  patch: { roleId?: string; status?: "active" | "locked"; overridePermissions?: string[]; deniedPermissions?: string[] },
): Promise<UserDoc> {
  const user = await getUserById(id);
  if (await isAdminRoleUser(user)) assertSuperAdmin(req);
  const before = user.toObject();
  if (patch.roleId) user.roleId = patch.roleId as never;
  if (patch.status) {
    user.status = patch.status;
    if (patch.status === "active") user.failedLoginCount = 0;
  }
  if (patch.overridePermissions) user.overridePermissions = patch.overridePermissions;
  if (patch.deniedPermissions) user.deniedPermissions = patch.deniedPermissions;
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
  if (await isAdminRoleUser(user)) assertSuperAdmin(req);
  const before = user.toObject();

  if (patch.identifier) {
    const normalized = normalizeIdentifier(patch.identifier);
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
  try {
    await user.save();
  } catch (err) {
    if (isDuplicateKeyError(err)) throw ApiError.conflict("Another account already uses this identifier");
    throw err;
  }

  await recordAudit({ req, action: "user.reset-credentials", module: "users", targetCollection: "users", targetId: id, before, after: { identifier: user.identifier } });
  await notifyStudentCredential(user.identifier, patch.password, user.linkedStudentId);
  return user;
}

export async function deleteUser(req: Request, id: string): Promise<void> {
  const user = await getUserById(id);
  if (await isAdminRoleUser(user)) assertSuperAdmin(req);
  await user.deleteOne();
  await recordAudit({ req, action: "user.delete", module: "users", targetCollection: "users", targetId: id, before: user.toObject() });
}
