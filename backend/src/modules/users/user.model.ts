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
    linkedStaffId: { type: Schema.Types.ObjectId, ref: "Staff" },
    linkedStudentId: { type: Schema.Types.ObjectId, ref: "Student" },
    status: { type: String, enum: ACCOUNT_STATUS, default: "active" },
    mustChangePassword: { type: Boolean, default: false },
    failedLoginCount: { type: Number, default: 0 },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

export const User = model<UserDoc>("User", userSchema);
