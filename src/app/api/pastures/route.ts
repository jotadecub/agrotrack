import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import {
  assertCanManageOperationalData,
  assertCanReadData,
  ForbiddenError,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import {
  PastureConflictError,
  PastureValidationError,
} from "@/lib/server/pastures/errors";
import {
  createPasture,
  listPastures,
} from "@/lib/server/pastures/service";
import {
  createPastureSchema,
  listPasturesQuerySchema,
} from "@/lib/server/pastures/validation";
import {
  assertSameOrigin,
  OriginNotAllowedError,
} from "@/lib/server/auth/request-origin";

const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "agrotrack_session";

export async function GET(request: NextRequest) {
  try {
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

    const searchParams = request.nextUrl.searchParams;

    const query = listPasturesQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      isActive: searchParams.get("isActive") ?? undefined,
    });

    const result = await listPastures(query);

    return NextResponse.json(result, {
      status: 200,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Parámetros de consulta invalidos.",
          details: error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    return NextResponse.json(
      {
        error: "No fue posible obtener los terrenos.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();

    const input = createPastureSchema.parse(body);

    const pasture = await createPasture(
      input,
      authenticated.user.id,
    );

    return NextResponse.json(
      {
        pasture,
      },
      {
        status: 201,
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
          error: "No tienes permiso para crear terrenos.",
        },
        {
          status: 403,
        },
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        {
          error: "No tienes permiso para crear terrenos.",
        },
        {
          status: 403,
        },
      );
    }

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

    return NextResponse.json(
      {
        error: "No fue posible crear el terreno.",
      },
      {
        status: 500,
      },
    );
  }
}