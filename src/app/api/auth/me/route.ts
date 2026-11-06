import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { validateAccessToken } from "@/lib/server/auth/validate-session";

export async function GET() {
  const cookieStore = await cookies();

  const accessToken = cookieStore.get(
    process.env.AUTH_COOKIE_NAME ?? "agrotrack_session",
  )?.value;

  if (!accessToken) {
    return NextResponse.json(
      {
        error: "No hay una sesión activa.",
      },
      {
        status: 401,
      },
    );
  }

  const authenticated = await validateAccessToken(accessToken, {
    recordActivity: true,
  });

  if (!authenticated) {
    return NextResponse.json(
      {
        error: "La sesión no es válida.",
      },
      {
        status: 401,
      },
    );
  }

  return NextResponse.json(
    {
      user: authenticated.user,
    },
    {
      status: 200,
    },
  );
}