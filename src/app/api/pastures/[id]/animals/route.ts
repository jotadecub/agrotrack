import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  assertCanReadData,
  ForbiddenError,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import { listAnimals } from "@/lib/server/animals/service";
import { listAnimalsQuerySchema } from "@/lib/server/animals/validation";
import { PastureNotFoundError } from "@/lib/server/pastures/errors";
import { getPastureById } from "@/lib/server/pastures/service";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "agrotrack_session";

const routeParamsSchema = z.object({
  id: z.string().uuid("El identificador del terreno no es válido."),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
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

    const { id } = routeParamsSchema.parse(await context.params);
    const searchParams = request.nextUrl.searchParams;

    const query = listAnimalsQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      speciesId: searchParams.get("speciesId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      pastureId: id,
    });

    await getPastureById(id);

    const result = await listAnimals(query);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Parámetros de consulta inválidos.",
          details: error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json(
        {
          error: "No tienes permiso para consultar esta información.",
        },
        {
          status: 403,
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

    console.error(
      "Error al consultar los animales del terreno:",
      error,
    );

    return NextResponse.json(
      {
        error: "No fue posible obtener los animales del terreno.",
      },
      {
        status: 500,
      },
    );
  }
}