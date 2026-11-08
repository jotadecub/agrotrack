import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { assertCanReadData } from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import { AnimalNotFoundError } from "@/lib/server/animals/errors";
import { db } from "@/lib/server/db";

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

    const animal = await db.animal.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
      },
    });

    if (!animal) {
      throw new AnimalNotFoundError();
    }

    const history = await db.animalChangeLog.findMany({
      where: {
        animalId: id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
      select: {
        id: true,
        action: true,
        previousData: true,
        newData: true,
        createdAt: true,
        changedBy: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        history,
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
        error: "No fue posible obtener el historial del animal.",
      },
      {
        status: 500,
      },
    );
  }
}