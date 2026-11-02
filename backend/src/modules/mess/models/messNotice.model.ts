import { Schema, model, Document, Types } from "mongoose";
import { MESS_NOTICE_AUDIENCE, MESS_NOTICE_TYPES } from "../mess.constants";

export interface MessNoticeDoc extends Document {
  messId: Types.ObjectId;
  audience: (typeof MESS_NOTICE_AUDIENCE)[number];
  /** audience "member" only. */
  membershipId?: Types.ObjectId;
  studentId?: Types.ObjectId;
  type: (typeof MESS_NOTICE_TYPES)[number];
  title: string;
  body: string;
  publishDate: string;
  expiryDate?: string;
  status: "active" | "archived";
  /** Students who opened it in the Student Portal — bounded by the Mess's own member count. */
  readBy: Types.ObjectId[];
  sms?: { requested: boolean; recipients: number; sent: number; failed: number; finishedAt?: Date };
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messNoticeSchema = new Schema<MessNoticeDoc>(
  {
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    audience: { type: String, enum: MESS_NOTICE_AUDIENCE, default: "mess" },
    membershipId: { type: Schema.Types.ObjectId, ref: "MessMembership" },
    studentId: { type: Schema.Types.ObjectId, ref: "Student" },
    type: { type: String, enum: MESS_NOTICE_TYPES, default: "general" },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    publishDate: { type: String, required: true },
    expiryDate: { type: String },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    readBy: { type: [Schema.Types.ObjectId], default: [] },
    sms: {
      requested: { type: Boolean, default: false },
      recipients: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      finishedAt: { type: Date },
    },
    createdBy: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

messNoticeSchema.index({ messId: 1, publishDate: -1 });
messNoticeSchema.index({ studentId: 1, publishDate: -1 });

export const MessNotice = model<MessNoticeDoc>("MessNotice", messNoticeSchema);
