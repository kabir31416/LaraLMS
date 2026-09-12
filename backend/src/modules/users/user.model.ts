import { Schema, model, Document, Types } from "mongoose";
import { ACCOUNT_STATUS } from "../../config/constants";

export interface UserDoc extends Document {
  identifier: string;
  passwordHash: string;
  roleId: Types.ObjectId;
  overridePermissions: string[];
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
