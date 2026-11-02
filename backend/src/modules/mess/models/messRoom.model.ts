import { Schema, model, Document, Types } from "mongoose";
import { ROOM_STATUS } from "../mess.constants";

export interface MessRoomDoc extends Document {
  messId: Types.ObjectId;
  name: string; // room number / name, e.g. "201" or "দক্ষিণ-১"
  /** Lower-cased/trimmed `name` — backs the per-Mess uniqueness index so "201" and " 201 " can't both exist. */
  nameKey: string;
  floor?: string;
  roomType?: string;
  /** Capacity — the number of seats this room can hold. Seat creation refuses to go past it. */
  totalSeats: number;
  facilities: string[];
  status: (typeof ROOM_STATUS)[number];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const messRoomSchema = new Schema<MessRoomDoc>(
  {
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true },
    floor: { type: String, trim: true },
    roomType: { type: String, trim: true },
    totalSeats: { type: Number, required: true, min: 0, default: 0 },
    facilities: { type: [String], default: [] },
    status: { type: String, enum: ROOM_STATUS, default: "active" },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

messRoomSchema.index({ messId: 1, nameKey: 1 }, { unique: true });

export const MessRoom = model<MessRoomDoc>("MessRoom", messRoomSchema);
