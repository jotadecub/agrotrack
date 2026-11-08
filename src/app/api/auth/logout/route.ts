import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { logoutSession } from "@/lib/server/auth/logout";
import { clearSessionCookies } from "@/lib/server/auth/cookies";
import {
  assertSameOrigin,
  OriginNotAllowedError,
} from "@/lib/server/auth/request-origin";
import { verifySessionToken } from "@/lib/server/auth/token";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const cookieStore = await cookies();

    const accessToken = cookieStore.get(
      process.env.AUTH_COOKIE_NAME ?? "agrotrack_session",
    )?.value;

    const response = NextResponse.json(
      {
        message: "Sesión cerrada.",
      },
      {
        status: 200,
      },
    );

    clearSessionCookies(response);

    if (!accessToken) {
      return response;
    }

    const token = await verifySessionToken(accessToken);

    if (token) {
        await logoutSession(token.sessionId, token.userId);
    }
    return response;
  } catch (error) {
    if (error instanceof OriginNotAllowedError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 403,
        },
      );
    }

    console.error("No se pudo cerrar la sesión.", error);

    const response = NextResponse.json(
      {
        error: "No se pudo cerrar la sesión.",
      },
      {
        status: 500,
      },
    );

    return clearSessionCookies(response);
  }
}