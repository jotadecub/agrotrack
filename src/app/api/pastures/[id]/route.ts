import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import {
  assertCanManageOperationalData,
  assertCanReadData,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import {
  PastureConflictError,
  PastureNotFoundError,
  PastureValidationError,
} from "@/lib/server/pastures/errors";
import {
  getPastureById,
  updatePasture,
} from "@/lib/server/pastures/service";
import {
  updatePastureSchema,
  UpdatePastureInput,
} from "@/lib/server/pastures/validation";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "agrotrack_session";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  try {
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
      recordActivity: false,
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

    assertCanReadData(authenticated.user.role);

    const pasture = await getPastureById(id);

    return NextResponse.json(
      {
        pasture,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
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
        error: "No fue posible obtener el terreno.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function PATCH(
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

    const parsed = updatePastureSchema.parse(body);

    const input: UpdatePastureInput = {
      name: parsed.name,
      description: parsed.description,
      areaHectares: parsed.areaHectares,
      isActive: parsed.isActive,
    };

    const pasture = await updatePasture(
      id,
      input,
      authenticated.user.id,
    );

    return NextResponse.json(
      {
        pasture,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos de terreno invalidos.",
          details: error.flatten().fieldErrors,
        },
        {
          status: 400,
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

    if (error instanceof PastureConflictError) {
      return NextResponse.json(
        {
          error: error.message,
        },
        {
          status: 409,
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
        error: "No fue posible actualizar el terreno.",
      },
      {
        status: 500,
      },
    );
  }
}