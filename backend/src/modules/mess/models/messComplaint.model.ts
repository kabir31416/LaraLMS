import { Schema, model, Document, Types } from "mongoose";
import { COMPLAINT_KINDS, COMPLAINT_PRIORITY, COMPLAINT_STATUS } from "../mess.constants";

/** Student complaints and maintenance tickets share one collection (`kind`) — same lifecycle, same assignment and history. */
export interface MessComplaintDoc extends Document {
  ticketNo: string;
  kind: (typeof COMPLAINT_KINDS)[number];
  messId: Types.ObjectId;
  roomId?: Types.ObjectId;
  seatId?: Types.ObjectId;
  category: string;
  title: string;
  description?: string;
  priority: (typeof COMPLAINT_PRIORITY)[number];
  attachment?: { url: string; publicId?: string; resourceType?: string };
  /** Set when a student submitted it from the Student Portal. */
  studentId?: Types.ObjectId;
  membershipId?: Types.ObjectId;
  submittedByUserId?: Types.ObjectId;
  submittedByRole?: string;
  date: string;
  assignedStaffId?: Types.ObjectId;
  status: (typeof COMPLAINT_STATUS)[number];
  history: { status: string; note?: string; at: Date; by?: Types.ObjectId; byRole?: string }[];
  resolvedAt?: Date;
  resolutionNote?: string;
  /** Maintenance cost (informational; spending itself is recorded as a Mess expense). */
  cost?: number;
  createdAt: Date;
  updatedAt: Date;
}

const messComplaintSchema = new Schema<MessComplaintDoc>(
  {
    ticketNo: { type: String, required: true, unique: true, immutable: true },
    kind: { type: String, enum: COMPLAINT_KINDS, default: "complaint" },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "MessRoom" },
    seatId: { type: Schema.Types.ObjectId, ref: "MessSeat" },
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    priority: { type: String, enum: COMPLAINT_PRIORITY, default: "normal" },
    attachment: { url: String, publicId: String, resourceType: String },
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    membershipId: { type: Schema.Types.ObjectId, ref: "MessMembership" },
    submittedByUserId: { type: Schema.Types.ObjectId },
    submittedByRole: { type: String },
    date: { type: String, required: true },
    assignedStaffId: { type: Schema.Types.ObjectId, ref: "Staff" },
    status: { type: String, enum: COMPLAINT_STATUS, default: "open" },
    history: {
      type: [{ status: String, note: String, at: Date, by: Schema.Types.ObjectId, byRole: String, _id: false }],
      default: [],
    },
    resolvedAt: { type: Date },
    resolutionNote: { type: String, trim: true },
    cost: { type: Number, min: 0 },
  },
  { timestamps: true },
);

messComplaintSchema.index({ messId: 1, status: 1, createdAt: -1 });
messComplaintSchema.index({ studentId: 1, createdAt: -1 });

export const MessComplaint = model<MessComplaintDoc>("MessComplaint", messComplaintSchema);
