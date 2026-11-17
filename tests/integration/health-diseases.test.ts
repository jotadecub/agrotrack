import { NextRequest } from "next/server";

import {
    createSession,
} from "../../src/lib/server/auth/session-service";

import {
    POST as createDiseaseRoute,
} from "../../src/app/api/health/diseases/route";

import { randomUUID } from "node:crypto";

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

vi.mock("server-only", () => ({}));

const cookieState = vi.hoisted(() => ({
    accessToken: undefined as string | undefined,
}));

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => {
            const cookieName =
                process.env.AUTH_COOKIE_NAME ?? "agrotrack_session";

            if (name !== cookieName || !cookieState.accessToken) {
                return undefined;
            }

            return {
                name,
                value: cookieState.accessToken,
            };
        },
    }),
}));

import { db } from "../../src/lib/server/db";
import { hashPassword } from "../../src/lib/server/auth/password";
import { createDisease } from "../../src/lib/server/health/diseases/service";

describe("creacion de enfermedades", () => {
    let databaseVerified = false;
    let adminId: string | undefined;

    beforeAll(async () => {
        const [connection] = await db.$queryRaw<
            Array<{
                database_name: string;
                user_name: string;
            }>
        >`
      SELECT
        current_database() AS database_name,
        current_user AS user_name
    `;

        if (
            connection?.database_name !== "agrotrack_test" ||
            connection.user_name !== "agrotrack_test"
        ) {
            throw new Error(
                "Pruebas canceladas: la conexión no corresponde a agrotrack_test.",
            );
        }

        databaseVerified = true;
    });

    beforeEach(async () => {
        cookieState.accessToken = undefined;

        if (!databaseVerified) {
            throw new Error("La base de pruebas no fue verificada.");
        }

        const userId = randomUUID();

        await db.user.create({
            data: {
                id: userId,
                identification: `ADMIN-${userId}`,
                fullName: "Administrador de enfermedades",
                email: `health-diseases-${userId}@example.com`,
                passwordHash: await hashPassword(
                    "contrasenaficticiadeintegracion",
                ),
                role: "ADMIN",
                status: "ACTIVE",
                mustChangePassword: false,
            },
        });

        adminId = userId;

        const farm = await db.farm.findFirst();

        if (!farm) {
            await db.farm.create({
                data: {
                    id: 1,
                    name: "Finca de prueba",
                },
            });
        }
    });

    afterEach(async () => {
        if (!databaseVerified || !adminId) {
            return;
        }

        const userId = adminId;

        await db.$transaction(async (tx) => {
            await tx.disease.deleteMany({
                where: {
                    createdById: userId,
                },
            });

            await tx.session.deleteMany({
                where: {
                    userId,
                },
            });

            await tx.user.deleteMany({
                where: {
                    id: userId,
                },
            });
        });

        adminId = undefined;
    });

    afterAll(async () => {
        await db.$disconnect();
    });

    function requiredAdminId(): string {
        if (!adminId) {
            throw new Error("No se creó el administrador de prueba.");
        }

        return adminId;
    }

    async function authenticateRouteUser(
        role: "ADMIN" | "SUPERVISOR" | "READER",
    ): Promise<void> {
        const userId = requiredAdminId();

        await db.user.update({
            where: {
                id: userId,
            },
            data: {
                role,
            },
        });

        const session = await createSession(userId);

        cookieState.accessToken = session.accessToken;
    }

    async function requestDiseaseCreation(
        body: unknown,
        originOverride?: string | null,
    ): Promise<Response> {
        const allowedOrigin = process.env.AUTH_ALLOWED_ORIGINS
            ?.split(",")
            .map((value) => value.trim())
            .find((value) => value.length > 0);

        if (!allowedOrigin) {
            throw new Error(
                "AUTH_ALLOWED_ORIGINS debe estar definido para probar el endpoint de enfermedades.",
            );
        }

        const origin =
            originOverride === undefined
                ? allowedOrigin
                : originOverride;

        const headers = new Headers({
            "Content-Type": "application/json",
        });

        if (origin !== null) {
            headers.set("Origin", origin);
        }

        const request = new NextRequest(
            new URL("/api/health/diseases", allowedOrigin),
            {
                method: "POST",
                headers,
                body: JSON.stringify(body),
            },
        );

        return createDiseaseRoute(request);
    }

    it("crea una enfermedad activa con descripción", async () => {
        const disease = await createDisease(
            {
                name: `Mastitis-${randomUUID()}`,
                description: "Infección de la glándula mamaria.",
                isActive: true,
            },
            requiredAdminId(),
        );

        expect(disease.isActive).toBe(true);
        expect(disease.description).toBe(
            "Infección de la glándula mamaria.",
        );

        const stored = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        expect(stored.createdById).toBe(requiredAdminId());
        expect(stored.farmId).toBe(1);
    });

    it("crea una enfermedad sin descripción y la activa por defecto", async () => {
        const disease = await createDisease(
            {
                name: `Dermatitis-${randomUUID()}`,
            },
            requiredAdminId(),
        );

        expect(disease.isActive).toBe(true);
        expect(disease.description).toBeNull();

        const stored = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        expect(stored.description).toBeNull();
        expect(stored.isActive).toBe(true);
    });

    it("crea una enfermedad inactiva cuando se solicita", async () => {
        const disease = await createDisease(
            {
                name: `Enfermedad inactiva-${randomUUID()}`,
                description: null,
                isActive: false,
            },
            requiredAdminId(),
        );

        expect(disease.isActive).toBe(false);

        const stored = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        expect(stored.isActive).toBe(false);
    });

    it("rechaza un nombre duplicado en la misma finca", async () => {
        const name = `Enfermedad duplicada-${randomUUID()}`;

        await createDisease(
            {
                name,
            },
            requiredAdminId(),
        );

        await expect(
            createDisease(
                {
                    name,
                },
                requiredAdminId(),
            ),
        ).rejects.toMatchObject({
            name: "DiseaseConflictError",
        });
    });

    it("POST crea una enfermedad y responde 201", async () => {
        await authenticateRouteUser("ADMIN");

        const name = `Enfermedad creada por endpoint-${randomUUID()}`;

        const response = await requestDiseaseCreation({
            name,
            description: "Enfermedad creada desde el endpoint.",
            isActive: true,
        });

        expect(response.status).toBe(201);

        const responseBody = await response.json();

        expect(responseBody).toMatchObject({
            disease: {
                name,
                description: "Enfermedad creada desde el endpoint.",
                isActive: true,
            },
        });

        const stored = await db.disease.findUniqueOrThrow({
            where: {
                id: responseBody.disease.id,
            },
        });

        expect(stored.name).toBe(name);
        expect(stored.createdById).toBe(requiredAdminId());
    });

    it("POST rechaza la creación sin sesión y no crea datos", async () => {
        const beforeCount = await db.disease.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        const response = await requestDiseaseCreation({
            name: `Enfermedad sin sesion-${randomUUID()}`,
        });

        expect(response.status).toBe(401);

        expect(await response.json()).toEqual({
            error: "No hay una sesión activa.",
        });

        const afterCount = await db.disease.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        expect(afterCount).toBe(beforeCount);
    });

    it("POST impide que un lector cree enfermedades y conserva los datos", async () => {
        await authenticateRouteUser("READER");

        const beforeCount = await db.disease.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        const response = await requestDiseaseCreation({
            name: `Enfermedad lector-${randomUUID()}`,
        });

        expect(response.status).toBe(403);

        expect(await response.json()).toEqual({
            error: "No tienes permiso para crear enfermedades.",
        });

        const afterCount = await db.disease.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        expect(afterCount).toBe(beforeCount);
    });

    it.each(["ADMIN", "SUPERVISOR"] as const)(
        "POST permite que %s cree una enfermedad",
        async (role) => {
            await authenticateRouteUser(role);

            const name = `Enfermedad ${role}-${randomUUID()}`;

            const response = await requestDiseaseCreation({
                name,
            });

            expect(response.status).toBe(201);

            const responseBody = await response.json();

            expect(responseBody).toMatchObject({
                disease: {
                    name,
                    isActive: true,
                },
            });
        },
    );

    it.each([
        {
            label: "sin encabezado Origin",
            origin: null,
        },
        {
            label: "con un origen no autorizado",
            origin: "https://origen-no-autorizado.invalid",
        },
    ])(
        "POST rechaza la creación $label y no crea datos",
        async ({ origin }) => {
            await authenticateRouteUser("ADMIN");

            const beforeCount = await db.disease.count({
                where: {
                    createdById: requiredAdminId(),
                },
            });

            const response = await requestDiseaseCreation(
                {
                    name: `Enfermedad origen invalido-${randomUUID()}`,
                },
                origin,
            );

            expect(response.status).toBe(403);

            expect(await response.json()).toEqual({
                error: "Origen no autorizado para esta operación.",
            });

            const afterCount = await db.disease.count({
                where: {
                    createdById: requiredAdminId(),
                },
            });

            expect(afterCount).toBe(beforeCount);
        },
    );

    it.each([
        {
            label: "sin nombre",
            body: {},
        },
        {
            label: "con un nombre vacío",
            body: {
                name: "",
            },
        },
        {
            label: "con un nombre demasiado largo",
            body: {
                name: "a".repeat(121),
            },
        },
        {
            label: "con una descripción demasiado larga",
            body: {
                name: `Enfermedad descripcion larga-${randomUUID()}`,
                description: "a".repeat(1001),
            },
        },
        {
            label: "con campos adicionales",
            body: {
                name: `Enfermedad campos adicionales-${randomUUID()}`,
                farmId: 2,
            },
        },
    ])(
        "POST rechaza el cuerpo $label y no crea datos",
        async ({ body }) => {
            await authenticateRouteUser("ADMIN");

            const beforeCount = await db.disease.count({
                where: {
                    createdById: requiredAdminId(),
                },
            });

            const response = await requestDiseaseCreation(body);

            expect(response.status).toBe(400);

            expect(await response.json()).toMatchObject({
                error: "Datos de enfermedad invalidos.",
            });

            const afterCount = await db.disease.count({
                where: {
                    createdById: requiredAdminId(),
                },
            });

            expect(afterCount).toBe(beforeCount);
        },
    );

    it("POST rechaza un nombre duplicado con 409 y no crea otro registro", async () => {
        const name = `Enfermedad duplicada endpoint-${randomUUID()}`;

        await createDisease(
            {
                name,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("ADMIN");

        const beforeCount = await db.disease.count({
            where: {
                name,
            },
        });

        const response = await requestDiseaseCreation({
            name,
        });

        expect(response.status).toBe(409);

        expect(await response.json()).toEqual({
            error: "Ya existe una enfermedad con ese nombre.",
        });

        const afterCount = await db.disease.count({
            where: {
                name,
            },
        });

        expect(afterCount).toBe(beforeCount);
    });
});