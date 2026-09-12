import { Schema, model, Document, Types } from "mongoose";

export interface RefreshTokenDoc extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  device?: string;
  ip?: string;
  expiresAt: Date;
  revokedAt?: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  tokenHash: { type: String, required: true, unique: true },
  device: String,
  ip: String,
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
});

// TTL — Mongo auto-purges a token document once it's expired (Phase 2 §4).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<RefreshTokenDoc>("RefreshToken", refreshTokenSchema);
