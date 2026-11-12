import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import {
  assertCanManageOperationalData,
  ForbiddenError,
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
  animalIdParamsSchema,
} from "@/lib/server/animals/validation";
import {
  PastureNotFoundError,
  PastureValidationError,
} from "@/lib/server/pastures/errors";
import {
  assertSameOrigin,
  OriginNotAllowedError,
} from "@/lib/server/auth/request-origin";

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
    assertSameOrigin(request);

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

    const { id } = animalIdParamsSchema.parse(await context.params);

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

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        {
          error: "No tienes permiso para cambiar el terreno del animal.",
        },
        {
          status: 403,
        },
      );
    }

    if (error instanceof PastureValidationError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        {
          status: 400,
        },
      );
    }

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