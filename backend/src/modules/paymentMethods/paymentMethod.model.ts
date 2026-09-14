import { Schema, model, Document } from "mongoose";
import { MASTER_DATA_STATUS } from "../academicSessions/academicSession.model";

/**
 * Replaces the hard-coded `PAYMENT_METHODS` array (previously duplicated
 * verbatim across payment.constants.ts and src/types/student.ts) with real
 * admin-managed master data (Settings §9/§27). `Payment.method` stays a
 * plain string (not a ref) so existing Payment documents keep whatever name
 * they were recorded with even if that method is later deactivated or
 * renamed here — never rewritten retroactively (Settings §25).
 */
export interface PaymentMethodDoc extends Document {
  name: string;
  status: (typeof MASTER_DATA_STATUS)[number];
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const paymentMethodSchema = new Schema<PaymentMethodDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    status: { type: String, enum: MASTER_DATA_STATUS, default: "সক্রিয়" },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const PaymentMethod = model<PaymentMethodDoc>("PaymentMethod", paymentMethodSchema);
