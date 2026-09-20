import { Request, Response } from "express";
import { asyncHandler } from "../../common/utils/asyncHandler";
import { sendSuccess } from "../../common/utils/apiResponse";
import { ApiError } from "../../common/utils/ApiError";
import { parseDurationToMs } from "../../common/utils/duration";
import { env, isProd } from "../../config/env";
import * as authService from "./auth.service";

const REFRESH_COOKIE = "refreshToken";

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    // Frontend and backend are deployed as separate origins in production
    // (see app.ts's CORS_ORIGIN allow-list, already set up for
    // credentials:true cross-site requests) — a "lax" cookie is never sent
    // on a cross-site fetch/XHR, only on a top-level navigation, so
    // POST /auth/refresh would silently never receive it there, logging
    // Admin sessions out on every reload. "none" (paired with secure:true,
    // which isProd already guarantees) is required for a cross-site cookie
    // to be sent at all; "lax" is kept for local dev, where secure:false
    // would make sameSite:"none" cookies rejected outright by the browser.
    sameSite: isProd ? "none" : "lax",
    maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN),
    path: "/api/v1/auth",
  });
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { identifier, password } = req.body;
  const { accessToken, refreshToken, user } = await authService.login(req, identifier, password);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { accessToken, user });
});

/** Pure read-only lookup — no refresh cookie: there is no server-side session record to rotate. */
export const studentLogin = asyncHandler(async (req: Request, res: Response) => {
  const { phone, rollNumber } = req.body;
  const { accessToken, student } = await authService.studentLogin(phone, rollNumber);
  sendSuccess(res, { accessToken, student });
});

/** Pure read-only lookup — no refresh cookie: there is no server-side session record to rotate. */
export const staffLogin = asyncHandler(async (req: Request, res: Response) => {
  const { phone, staffId } = req.body;
  const { accessToken, staff } = await authService.staffLogin(phone, staffId);
  sendSuccess(res, { accessToken, staff });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized("No refresh token supplied");
  const { accessToken, refreshToken, user } = await authService.refresh(req, token);
  setRefreshCookie(res, refreshToken);
  sendSuccess(res, { accessToken, user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  await authService.logout(token);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
  sendSuccess(res, { loggedOut: true });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword(req, req.user!.id, currentPassword, newPassword);
  sendSuccess(res, { changed: true });
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.me(req.user!.id);
  sendSuccess(res, user);
});
