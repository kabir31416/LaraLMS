import { Schema, model, Document, Types } from "mongoose";
import { RESERVATION_STATUS } from "../mess.constants";

export interface MessReservationDoc extends Document {
  reservationNo: string;
  studentId: Types.ObjectId;
  messId: Types.ObjectId;
  roomId: Types.ObjectId;
  seatId: Types.ObjectId;
  reservationDate: string; // yyyy-mm-dd
  expiryDate: string; // yyyy-mm-dd — inclusive; expired once today > expiryDate
  /** The agreed advance amount. Money actually received is a MessPayment linked by reservationId. */
  advanceAmount: number;
  status: (typeof RESERVATION_STATUS)[number];
  /** Derived from status === "active" — backs the per-seat and per-student uniqueness indexes. */
  isActive: boolean;
  membershipId?: Types.ObjectId;
  notes?: string;
  cancelReason?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const messReservationSchema = new Schema<MessReservationDoc>(
  {
    reservationNo: { type: String, required: true, unique: true, immutable: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "MessRoom", required: true },
    seatId: { type: Schema.Types.ObjectId, ref: "MessSeat", required: true },
    reservationDate: { type: String, required: true },
    expiryDate: { type: String, required: true },
    advanceAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: RESERVATION_STATUS, default: "active" },
    isActive: { type: Boolean, default: true },
    membershipId: { type: Schema.Types.ObjectId, ref: "MessMembership" },
    notes: { type: String, trim: true },
    cancelReason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

messReservationSchema.index({ seatId: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
messReservationSchema.index({ studentId: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
messReservationSchema.index({ messId: 1, status: 1, expiryDate: 1 });

export const MessReservation = model<MessReservationDoc>("MessReservation", messReservationSchema);
