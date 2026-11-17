import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import { listDiseases } from "@/lib/server/health/diseases/service";
import {
    assertCanManageOperationalData,
    assertCanReadData,
    ForbiddenError,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import {
    DiseaseConflictError,
    DiseaseValidationError,
} from "@/lib/server/health/diseases/errors";
import { createDisease } from "@/lib/server/health/diseases/service";
import { createDiseaseSchema, listDiseasesQuerySchema } from "@/lib/server/health/diseases/validation";
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

        const query = listDiseasesQuerySchema.parse({
            page: searchParams.get("page") ?? undefined,
            pageSize: searchParams.get("pageSize") ?? undefined,
            search: searchParams.get("search") ?? undefined,
            isActive: searchParams.get("isActive") ?? undefined,
        });

        const result = await listDiseases(query);

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
                error: "No fue posible obtener las enfermedades.",
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

        const input = createDiseaseSchema.parse(body);

        const disease = await createDisease(
            input,
            authenticated.user.id,
        );

        return NextResponse.json(
            {
                disease,
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
                    error: "No tienes permiso para crear enfermedades.",
                },
                {
                    status: 403,
                },
            );
        }

        if (error instanceof ZodError) {
            return NextResponse.json(
                {
                    error: "Datos de enfermedad invalidos.",
                    details: error.flatten().fieldErrors,
                },
                {
                    status: 400,
                },
            );
        }

        if (error instanceof DiseaseValidationError) {
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

        if (error instanceof DiseaseConflictError) {
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
                error: "No fue posible crear la enfermedad.",
            },
            {
                status: 500,
            },
        );
    }
}