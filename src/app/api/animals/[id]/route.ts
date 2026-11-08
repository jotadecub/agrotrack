import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import {
  assertCanManageOperationalData,
  assertCanReadData,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import {
  AnimalNotFoundError,
  AnimalRelationshipError,
  AnimalValidationError,
} from "@/lib/server/animals/errors";
import {
  getAnimalById,
  updateAnimal,
} from "@/lib/server/animals/service";
import { updateAnimalSchema, UpdateAnimalInput } from "@/lib/server/animals/validation";

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

    const animal = await getAnimalById(id);

    return NextResponse.json(
      {
        animal,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
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

    return NextResponse.json(
      {
        error: "No fue posible obtener el animal.",
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

    const parsed = updateAnimalSchema.parse(body);

    const input: UpdateAnimalInput = {
        name: parsed.name,
        breedId: parsed.breedId,
        sex: parsed.sex,
        birthDate: parsed.birthDate,
        weightKg: parsed.weightKg,
        motherId: parsed.motherId,
        fatherId: parsed.fatherId,
        status: parsed.status,
        isActive: parsed.isActive,
    };

    const animal = await updateAnimal(
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

    if (error instanceof AnimalRelationshipError) {
      return NextResponse.json(
        {
          error: error.message,
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

    return NextResponse.json(
      {
        error: "No fue posible actualizar el animal.",
      },
      {
        status: 500,
      },
    );
  }
}