import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/auth/password";
import { setSessionCookies } from "@/lib/server/auth/cookies";
import { assertSameOrigin, OriginNotAllowedError } from "@/lib/server/auth/request-origin";
import { createSession } from "@/lib/server/auth/session-service";

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

type LoginBody = {
  identification?: unknown;
  password?: unknown;
};

const attempts = new Map<
  string,
  {
    count: number;
    firstAttemptAt: number;
  }
>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();

  return ip ?? "unknown";
}

function assertAttemptsAllowed(key: string): void {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current) {
    return;
  }

  if (now - current.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    attempts.delete(key);

    return;
  }

  if (current.count >= MAX_ATTEMPTS) {
    throw new Error("Demasiados intentos. Inténtalo más tarde.");
  }
}

function registerFailedAttempt(key: string): void {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now - current.firstAttemptAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
    });

    return;
  }

  current.count += 1;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);

    const key = clientKey(request);
    assertAttemptsAllowed(key);

    const body = (await request.json()) as LoginBody;

    if (
      typeof body.identification !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        {
          error: "Identificación y contraseña son obligatorias.",
        },
        {
          status: 400,
        },
      );
    }

    const user = await db.user.findUnique({
      where: {
        identification: body.identification,
      },
    });

    const passwordIsValid =
      user?.status === "ACTIVE" &&
      (await verifyPassword(body.password, user.passwordHash));

    if (!passwordIsValid || !user) {
      registerFailedAttempt(key);

      return NextResponse.json(
        {
          error: "Identificación o contraseña incorrectas.",
        },
        {
          status: 401,
        },
      );
    }

    const created = await createSession(user.id);
    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          fullName: user.fullName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
      },
      {
        status: 201,
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
      error instanceof Error &&
      error.message === "Demasiados intentos. Inténtalo más tarde."
    ) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 429,
        },
      );
    }

    console.error("No se pudo iniciar sesión.", error);

    return NextResponse.json(
      {
        error: "No se pudo iniciar sesión.",
      },
      {
        status: 500,
      },
    );
  }
}