import { Schema, model, Document, Types } from "mongoose";

/**
 * §3 "Smart Stock Management" — every single change to Material.currentStock
 * must create one of these. `quantity` is the SIGNED delta actually applied
 * (positive for IN/REVERSAL, negative for DISTRIBUTION or a negative
 * ADJUSTMENT), so `previousStock + quantity === newStock` always holds and
 * a full audit trail can be reconstructed without ever trusting the
 * Material document's current value alone.
 */
export const STOCK_MOVEMENT_TYPES = ["IN", "DISTRIBUTION", "ADJUSTMENT", "REVERSAL"] as const;

export const STOCK_ADJUSTMENT_REASONS = ["পরিমাণ গণনা সংশোধন", "ক্ষতিগ্রস্ত", "হারিয়ে গেছে", "অন্যান্য"] as const;

export interface StockMovementDoc extends Document {
  materialId: Types.ObjectId; // -> Material
  materialName: string; // snapshot at the time of this movement
  movementType: (typeof STOCK_MOVEMENT_TYPES)[number];
  quantity: number; // signed delta
  previousStock: number;
  newStock: number;
  /** e.g. the MaterialDistribution._id this movement came from (DISTRIBUTION/REVERSAL) — absent for a plain IN/ADJUSTMENT. */
  referenceId?: Types.ObjectId;
  reason?: string;
  createdBy: Types.ObjectId; // -> User
  createdAt: Date;
}

const stockMovementSchema = new Schema<StockMovementDoc>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    materialName: { type: String, required: true, trim: true },
    movementType: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true },
    previousStock: { type: Number, required: true, min: 0 },
    newStock: { type: Number, required: true, min: 0 },
    referenceId: { type: Schema.Types.ObjectId },
    reason: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

stockMovementSchema.index({ materialId: 1, createdAt: -1 });
stockMovementSchema.index({ movementType: 1 });
stockMovementSchema.index({ referenceId: 1 });

export const StockMovement = model<StockMovementDoc>("StockMovement", stockMovementSchema);
