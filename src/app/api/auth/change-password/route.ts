import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { changePassword } from "@/lib/server/auth/change-password";
import {
  InvalidCurrentPasswordError,
  PasswordChangeNotAllowedError,
  UserUnavailableError,
} from "@/lib/server/auth/change-password";
import { setSessionCookies } from "@/lib/server/auth/cookies";
import {
  assertSameOrigin,
  OriginNotAllowedError,
} from "@/lib/server/auth/request-origin";
import { validateAccessToken } from "@/lib/server/auth/validate-session";

type ChangePasswordBody = {
  currentPassword?: unknown;
  newPassword?: unknown;
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

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

    const body = (await request.json()) as ChangePasswordBody;

    if (
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return NextResponse.json(
        {
          error: "La contraseña actual y la nueva son obligatorias.",
        },
        {
          status: 400,
        },
      );
    }

    const created = await changePassword({
      userId: authenticated.user.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    const response = NextResponse.json(
      {
        user: {
          id: authenticated.user.id,
          fullName: authenticated.user.fullName,
          role: authenticated.user.role,
          mustChangePassword: false,
        },
      },
      {
        status: 200,
      },
    );

    return setSessionCookies(
      response,
      created.accessToken,
      created.refreshToken,
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

    if (
      error instanceof InvalidCurrentPasswordError ||
      error instanceof PasswordChangeNotAllowedError ||
      error instanceof UserUnavailableError
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        },
      );
    }

    if (
        error instanceof Error &&
        error.message.startsWith("La contraseña")
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 400,
        },
      );
    }

    console.error("No se pudo cambiar la contraseña.", error);

    return NextResponse.json(
      {
        error: "No se pudo cambiar la contraseña.",
      },
      {
        status: 500,
      },
    );
  }
}