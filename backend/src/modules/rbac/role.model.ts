import { Schema, model, Document } from "mongoose";

export interface RoleDoc extends Document {
  name: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDoc>(
  {
    name: { type: String, required: true, unique: true, trim: true, lowercase: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Role = model<RoleDoc>("Role", roleSchema);
