import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../../config/env";

export interface AccessTokenPayload {
  sub: string; // userId
  roleId: string;
  role: string;
  permissions: string[];
  staffId?: string;
  studentId?: string;
}

export function signAccessToken(payload: AccessTokenPayload, expiresIn: string = env.JWT_ACCESS_EXPIRES_IN): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

/** The refresh token itself is a random opaque string (see auth.service.ts), not a JWT — this signs only the short-lived reset/invite tokens. */
export function signShortLivedToken(payload: Record<string, unknown>, expiresIn: string): string {
  const options: SignOptions = { expiresIn: expiresIn as SignOptions["expiresIn"] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyShortLivedToken<T>(token: string): T {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as T;
}
