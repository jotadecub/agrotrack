import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { decodeJwt } from "jose";

import { refreshSession } from "@/lib/server/auth/refresh-session";
import { setSessionCookies } from "@/lib/server/auth/cookies";
import {
  assertSameOrigin,
  OriginNotAllowedError,
} from "@/lib/server/auth/request-origin";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const cookieStore = await cookies();

    const accessToken = cookieStore.get(
      process.env.AUTH_COOKIE_NAME ?? "agrotrack_session",
    )?.value;

    const refreshToken = cookieStore.get(
      process.env.AUTH_REFRESH_COOKIE_NAME ?? "agrotrack_refresh",
    )?.value;

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        {
          error: "No hay una sesión para renovar.",
        },
        {
          status: 401,
        },
      );
    }

    let sessionId: string | undefined;

    try {
      const payload = decodeJwt(accessToken);

      if (typeof payload.sessionId === "string") {
        sessionId = payload.sessionId;
      }
    } catch {
      sessionId = undefined;
    }

    if (!sessionId) {
      return NextResponse.json(
        {
          error: "No hay una sesión para renovar.",
        },
        {
          status: 401,
        },
      );
    }

    const renewed = await refreshSession(sessionId, refreshToken);

    if (!renewed) {
      const response = NextResponse.json(
        {
          error: "La sesión no puede renovarse.",
        },
        {
          status: 401,
        },
      );

      response.cookies.delete(
        process.env.AUTH_COOKIE_NAME ?? "agrotrack_session",
      );

      response.cookies.delete(
        process.env.AUTH_REFRESH_COOKIE_NAME ?? "agrotrack_refresh",
      );

      return response;
    }

    const response = NextResponse.json(
      {
        message: "Sesión renovada.",
      },
      {
        status: 200,
      },
    );

    return setSessionCookies(
      response,
      renewed.accessToken,
      renewed.refreshToken,
    );
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

    console.error("No se pudo renovar la sesión.", error);

    return NextResponse.json(
      {
        error: "No se pudo renovar la sesión.",
      },
      {
        status: 500,
      },
    );
  }
}