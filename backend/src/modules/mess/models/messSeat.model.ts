import { Schema, model, Document, Types } from "mongoose";
import { SEAT_STATUS, SeatStatus } from "../mess.constants";

export interface MessSeatDoc extends Document {
  messId: Types.ObjectId;
  roomId: Types.ObjectId;
  seatNumber: string;
  seatNumberKey: string;
  seatType?: string;
  monthlyRent: number;
  /**
   * Workflow-owned: "reserved"/"occupied" are set only through atomic
   * conditional updates in messSeat.service.ts (claimSeat/releaseSeat), so
   * two operators can never hand the same seat to two students.
   */
  status: SeatStatus;
  currentMembershipId?: Types.ObjectId;
  currentReservationId?: Types.ObjectId;
  currentStudentId?: Types.ObjectId;
  availableFrom?: string; // yyyy-mm-dd
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const messSeatSchema = new Schema<MessSeatDoc>(
  {
    messId: { type: Schema.Types.ObjectId, ref: "Mess", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "MessRoom", required: true },
    seatNumber: { type: String, required: true, trim: true },
    seatNumberKey: { type: String, required: true },
    seatType: { type: String, trim: true },
    monthlyRent: { type: Number, required: true, min: 0, default: 0 },
    status: { type: String, enum: SEAT_STATUS, default: "available" },
    currentMembershipId: { type: Schema.Types.ObjectId, ref: "MessMembership" },
    currentReservationId: { type: Schema.Types.ObjectId, ref: "MessReservation" },
    currentStudentId: { type: Schema.Types.ObjectId, ref: "Student" },
    availableFrom: { type: String },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

messSeatSchema.index({ roomId: 1, seatNumberKey: 1 }, { unique: true });
messSeatSchema.index({ messId: 1, status: 1 });

export const MessSeat = model<MessSeatDoc>("MessSeat", messSeatSchema);
