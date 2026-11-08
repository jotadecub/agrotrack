import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import {
  assertCanManageOperationalData,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import {
  AnimalNotFoundError,
} from "@/lib/server/animals/errors";
import {
  updateAnimalPasture,
} from "@/lib/server/animals/service";
import {
  updateAnimalPastureSchema,
} from "@/lib/server/animals/validation";
import {
  PastureNotFoundError,
} from "@/lib/server/pastures/errors";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "agrotrack_session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const origin = request.headers.get("origin");

    if (origin) {
      const allowedOrigin = process.env.APP_ORIGIN;

      if (!allowedOrigin || origin !== allowedOrigin) {
        return NextResponse.json(
          {
            error: "Origen no permitido.",
          },
          {
            status: 403,
          },
        );
      }
    }

    const { id } = await context.params;

    const cookieStore = await cookies();

    const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;

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

    assertCanManageOperationalData(authenticated.user.role);

    const body = await request.json();

    const input = updateAnimalPastureSchema.parse(body);

    const animal = await updateAnimalPasture(
      id,
      input,
      authenticated.user.id,
    );

    return NextResponse.json(
      {
        animal,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos de asignacion invalidos.",
          details: error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    if (error instanceof AnimalNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 404,
        },
      );
    }

    if (error instanceof PastureNotFoundError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 404,
        },
      );
    }

    return NextResponse.json(
      {
        error: "No fue posible actualizar el terreno del animal.",
      },
      {
        status: 500,
      },
    );
  }
}