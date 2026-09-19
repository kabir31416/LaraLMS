import { Schema, model, Document, Types } from "mongoose";
import { ACCOUNT_STATUS } from "../../config/constants";

export interface UserDoc extends Document {
  identifier: string;
  passwordHash: string;
  roleId: Types.ObjectId;
  overridePermissions: string[];
  /**
   * The inverse of overridePermissions — permission keys explicitly REVOKED
   * from this specific user, on top of whatever their role would otherwise
   * grant. Only meaningful for a wildcard ("*") role like admin: a
   * non-wildcard role's permissions are just role.permissions plus
   * overridePermissions, so there's nothing for a per-user denial to
   * subtract from there (auth.service.ts's resolvePermissions). Lets one
   * Admin be individually blocked from a specific module (e.g. Admission
   * Result) without touching the shared admin Role document, which would
   * affect every other Admin too. Defaults to empty, so every existing
   * Admin keeps full "*" access exactly as before this field existed.
   */
  deniedPermissions: string[];
  /**
   * True only for the original seeded root account (scripts/seed.ts's
   * seedAdmin()). A regular Admin created later through the UI can create
   * other Admins, but only this one account can edit an existing Admin's
   * Staff record or reset/update their password — otherwise a compromised
   * or careless regular Admin could take over another Admin's (or this
   * very account's) login. Never set anywhere except at seed time.
   */
  isSuperAdmin: boolean;
  linkedStaffId?: Types.ObjectId;
  linkedStudentId?: Types.ObjectId;
  status: "active" | "locked";
  mustChangePassword: boolean;
  failedLoginCount: number;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    identifier: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    roleId: { type: Schema.Types.ObjectId, ref: "Role", required: true },
    overridePermissions: { type: [String], default: [] },
    deniedPermissions: { type: [String], default: [] },
    isSuperAdmin: { type: Boolean, default: false },
    linkedStaffId: { type: Schema.Types.ObjectId, ref: "Staff" },
    linkedStudentId: { type: Schema.Types.ObjectId, ref: "Student" },
    status: { type: String, enum: ACCOUNT_STATUS, default: "active" },
    mustChangePassword: { type: Boolean, default: false },
    failedLoginCount: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  {
    timestamps: true,
    // `select: false` above only suppresses passwordHash from a *query's*
    // default projection — it does nothing once a document already holds
    // the field in memory (freshly created via .create(), or explicitly
    // (re)assigned by createUser()/resetCredentials() before a save/return).
    // Those call sites hand the live document straight to sendSuccess(),
    // which JSON-serializes it — without this transform the bcrypt hash
    // would leak into the API response every time an admin login is
    // created or reset.
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export const User = model<UserDoc>("User", userSchema);
