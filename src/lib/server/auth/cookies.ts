import type { NextResponse } from "next/server";

import { getRequiredEnv } from "../env";

const ACCESS_COOKIE_MAX_AGE = 15 * 60;
const REFRESH_COOKIE_MAX_AGE = 8 * 60 * 60;

export const ACCESS_COOKIE_NAME = getRequiredEnv(
  "AUTH_COOKIE_NAME",
  "Nombre de la cookie de acceso",
);

export const REFRESH_COOKIE_NAME = getRequiredEnv(
  "AUTH_REFRESH_COOKIE_NAME",
  "Nombre de la cookie de renovación",
);

export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): NextResponse {
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: accessToken,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });

  response.cookies.set({
    name: REFRESH_COOKIE_NAME,
    value: refreshToken,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });

  return response;
}

export function clearSessionCookies(
  response: NextResponse,
): NextResponse {
  response.cookies.delete(ACCESS_COOKIE_NAME);
  response.cookies.delete(REFRESH_COOKIE_NAME);

  return response;
}