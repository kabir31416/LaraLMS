import { Schema, model, Document, Types } from "mongoose";

/**
 * branchId is a plain string, not a ref, for now — Branch itself doesn't
 * have a real collection yet (that's Module 23). Same forward-reference
 * pattern Batch.directorId used before Staff (Module 13) existed: this
 * migrates to a real ObjectId ref once Branch is built.
 */
export interface BranchStockDoc extends Document {
  branchId: string;
  bookId: Types.ObjectId; // -> Book
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
}

const branchStockSchema = new Schema<BranchStockDoc>(
  {
    branchId: { type: String, required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
    quantity: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

branchStockSchema.index({ branchId: 1, bookId: 1 }, { unique: true });

export const BranchStock = model<BranchStockDoc>("BranchStock", branchStockSchema);
