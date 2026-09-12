import { Schema, model, Document } from "mongoose";

export const NOTICE_TYPES = ["All", "Course", "Batch", "Staff", "Director"] as const;
export const NOTICE_PRIORITIES = ["Normal", "Important", "Urgent"] as const;

export interface NoticeDoc extends Document {
  title: string;
  description: string;
  type: (typeof NOTICE_TYPES)[number];
  targetId?: string; // Course id or Batch id, depending on type — not a single fixed ref
  publishDate: string; // yyyy-mm-dd
  expiryDate?: string;
  priority: (typeof NOTICE_PRIORITIES)[number];
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const noticeSchema = new Schema<NoticeDoc>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    type: { type: String, enum: NOTICE_TYPES, default: "All" },
    targetId: { type: String },
    publishDate: { type: String, required: true },
    expiryDate: { type: String },
    priority: { type: String, enum: NOTICE_PRIORITIES, default: "Normal" },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true },
);

noticeSchema.index({ publishDate: -1 });

export const Notice = model<NoticeDoc>("Notice", noticeSchema);
