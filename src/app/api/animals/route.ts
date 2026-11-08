import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { cookies } from "next/headers";

import {
  assertCanManageOperationalData,
  assertCanReadData,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import {
  AnimalConflictError,
  AnimalValidationError,
} from "@/lib/server/animals/errors";
import {
  createAnimal,
  listAnimals,
} from "@/lib/server/animals/service";
import {
  createAnimalSchema,
  listAnimalsQuerySchema,
} from "@/lib/server/animals/validation";

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

    const query = listAnimalsQuerySchema.parse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      speciesId: searchParams.get("speciesId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const result = await listAnimals(query);

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
        error: "No fue posible obtener los animales.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const input = createAnimalSchema.parse(body);

    const animal = await createAnimal(
      input,
      authenticated.user.id,
    );

    return NextResponse.json(
      {
        animal,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Datos de animal invalidos.",
          details: error.flatten().fieldErrors,
        },
        {
          status: 400,
        },
      );
    }

    if (error instanceof AnimalValidationError) {
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

    if (error instanceof AnimalConflictError) {
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
        error: "No fue posible crear el animal.",
      },
      {
        status: 500,
      },
    );
  }
}