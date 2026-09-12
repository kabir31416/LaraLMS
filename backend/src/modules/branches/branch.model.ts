import { Schema, model, Document } from "mongoose";

/**
 * Unifies two mock branch lists that had drifted apart in the frontend —
 * Book Management's DEMO_BRANCHES (name/address/director/phone) and
 * Accounts' ACCOUNT_BRANCHES (id/name only). This is the one real
 * collection both features reference from Module 23 onward.
 */
export interface BranchDoc extends Document {
  name: string;
  address?: string;
  director?: string; // free text, not a Staff ref — matches the original mock shape
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const branchSchema = new Schema<BranchDoc>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    address: { type: String, trim: true },
    director: { type: String, trim: true },
    phone: { type: String, trim: true },
  },
  { timestamps: true },
);

export const Branch = model<BranchDoc>("Branch", branchSchema);
