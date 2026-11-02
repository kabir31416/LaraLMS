import { Schema, model, Document, Types } from "mongoose";
import { MESS_STAFF_RESPONSIBILITIES, MESS_STATUS, MessStaffResponsibility, MessStatus } from "../mess.constants";

export interface MessStaffAssignment {
  staffId: Types.ObjectId; // -> Staff (existing staff record, never a parallel staff collection)
  responsibility: MessStaffResponsibility;
  assignedAt: Date;
}

export interface MessDoc extends Document {
  name: string;
  /** System-generated (MESS-0001), unique and immutable. */
  code: string;
  address?: string;
  contactNumber?: string;
  openingDate?: string; // yyyy-mm-dd
  notes?: string;
  status: MessStatus;
  /** Which existing Staff members work at this Mess — also the Mess-level access list for mess staff logins (mess.scope.ts). */
  staff: MessStaffAssignment[];
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const staffAssignmentSchema = new Schema<MessStaffAssignment>(
  {
    staffId: { type: Schema.Types.ObjectId, ref: "Staff", required: true },
    responsibility: { type: String, enum: MESS_STAFF_RESPONSIBILITIES, required: true },
    assignedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const messSchema = new Schema<MessDoc>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, immutable: true },
    address: { type: String, trim: true },
    contactNumber: { type: String, trim: true },
    openingDate: { type: String },
    notes: { type: String, trim: true },
    status: { type: String, enum: MESS_STATUS, default: "active" },
    staff: { type: [staffAssignmentSchema], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

messSchema.index({ "staff.staffId": 1 });
messSchema.index({ status: 1, name: 1 });

export const Mess = model<MessDoc>("Mess", messSchema);
