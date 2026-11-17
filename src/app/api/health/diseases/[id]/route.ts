import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { cookies } from "next/headers";

import {
    assertCanReadData,
    assertCanManageOperationalData,
    ForbiddenError,
} from "@/lib/server/auth/authorization";
import { validateAccessToken } from "@/lib/server/auth/validate-session";
import {
    DiseaseConflictError,
    DiseaseNotFoundError,
    DiseaseValidationError,
} from "@/lib/server/health/diseases/errors";
import {
    updateDisease,
    deleteDisease,
    getDiseaseById,
} from "@/lib/server/health/diseases/service";
import {
    updateDiseaseSchema,
    UpdateDiseaseInput,
} from "@/lib/server/health/diseases/validation";
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

export async function GET(
    _request: NextRequest,
    context: RouteContext,
) {
    try {
        const { id } = await context.params;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(id)) {
            return NextResponse.json(
                {
                    error: "Datos de enfermedad invalidos.",
                    details: {
                        id: ["El identificador de la enfermedad no es válido."],
                    },
                },
                {
                    status: 400,
                },
            );
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

        const disease = await getDiseaseById(id);

        return NextResponse.json(
            {
                disease,
            },
            {
                status: 200,
            },
        );
    } catch (error) {
        if (error instanceof DiseaseNotFoundError) {
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
                error: "No fue posible obtener la enfermedad.",
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
        assertSameOrigin(request);

        const { id } = await context.params;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(id)) {
            return NextResponse.json(
                {
                    error: "Datos de enfermedad invalidos.",
                    details: {
                        id: ["El identificador de la enfermedad no es válido."],
                    },
                },
                {
                    status: 400,
                },
            );
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

        const parsed = updateDiseaseSchema.parse(body);

        const input: UpdateDiseaseInput = {
            name: parsed.name,
            description: parsed.description,
            isActive: parsed.isActive,
        };

        const disease = await updateDisease(
            id,
            input,
            authenticated.user.id,
        );

        return NextResponse.json(
            {
                disease,
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
                    error: "No tienes permiso para modificar enfermedades.",
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

        if (error instanceof DiseaseNotFoundError) {
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
                error: "No fue posible actualizar la enfermedad.",
            },
            {
                status: 500,
            },
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    context: RouteContext,
) {
    try {
        const { id } = await context.params;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(id)) {
            return NextResponse.json(
                {
                    error: "Datos de enfermedad invalidos.",
                    details: {
                        id: ["El identificador de la enfermedad no es válido."],
                    },
                },
                {
                    status: 400,
                },
            );
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

        const disease = await deleteDisease(
            id,
            authenticated.user.id,
        );

        return NextResponse.json(
            {
                disease,
            },
            {
                status: 200,
            },
        );
    } catch (error) {
        if (error instanceof ForbiddenError) {
            return NextResponse.json(
                {
                    error: "No tienes permiso para eliminar enfermedades.",
                },
                {
                    status: 403,
                },
            );
        }

        if (error instanceof DiseaseNotFoundError) {
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
                error: "No fue posible eliminar la enfermedad.",
            },
            {
                status: 500,
            },
        );
    }
}