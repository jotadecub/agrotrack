import { NextRequest } from "next/server";

import {
    createSession,
} from "../../src/lib/server/auth/session-service";

import {
    GET as listDiseasesRoute,
    POST as createDiseaseRoute,
} from "../../src/app/api/health/diseases/route";

import {
    PATCH as updateDiseaseRoute,
} from "../../src/app/api/health/diseases/[id]/route";

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

    async function requestDiseaseList(
        searchParams: Record<string, string | undefined> = {},
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

        const url = new URL("/api/health/diseases", allowedOrigin);

        for (const [key, value] of Object.entries(searchParams)) {
            if (value !== undefined) {
                url.searchParams.set(key, value);
            }
        }

        const request = new NextRequest(url, {
            method: "GET",
        });

        return listDiseasesRoute(request);
    }

    async function requestDiseaseUpdate(
        diseaseId: string,
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
            new URL(`/api/health/diseases/${diseaseId}`, allowedOrigin),
            {
                method: "PATCH",
                headers,
                body: JSON.stringify(body),
            },
        );

        return updateDiseaseRoute(request, {
            params: Promise.resolve({
                id: diseaseId,
            }),
        });
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

    it("GET lista enfermedades para un administrador", async () => {
        const firstName = `Enfermedad lista A-${randomUUID()}`;
        const secondName = `Enfermedad lista B-${randomUUID()}`;

        await createDisease(
            {
                name: firstName,
            },
            requiredAdminId(),
        );

        await createDisease(
            {
                name: secondName,
                isActive: false,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("ADMIN");

        const response = await requestDiseaseList();

        expect(response.status).toBe(200);

        const responseBody = await response.json();

        expect(responseBody.page).toBe(1);
        expect(responseBody.pageSize).toBe(20);
        expect(responseBody.total).toBeGreaterThanOrEqual(2);

        const names = responseBody.items.map(
            (item: { name: string }) => item.name,
        );

        expect(names).toContain(firstName);
        expect(names).toContain(secondName);
    });

    it("GET filtra enfermedades por búsqueda", async () => {
        const matchingName = `Enfermedad buscable-${randomUUID()}`;
        const otherName = `Enfermedad diferente-${randomUUID()}`;

        await createDisease(
            {
                name: matchingName,
            },
            requiredAdminId(),
        );

        await createDisease(
            {
                name: otherName,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("ADMIN");

        const response = await requestDiseaseList({
            search: "buscable",
        });

        expect(response.status).toBe(200);

        const responseBody = await response.json();

        const names = responseBody.items.map(
            (item: { name: string }) => item.name,
        );

        expect(names).toContain(matchingName);
        expect(names).not.toContain(otherName);
    });

    it("GET filtra enfermedades por estado activo", async () => {
        const activeName = `Enfermedad activa filtro-${randomUUID()}`;
        const inactiveName = `Enfermedad inactiva filtro-${randomUUID()}`;

        await createDisease(
            {
                name: activeName,
                isActive: true,
            },
            requiredAdminId(),
        );

        await createDisease(
            {
                name: inactiveName,
                isActive: false,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("ADMIN");

        const response = await requestDiseaseList({
            isActive: "true",
        });

        expect(response.status).toBe(200);

        const responseBody = await response.json();

        const names = responseBody.items.map(
            (item: { name: string }) => item.name,
        );

        expect(names).toContain(activeName);
        expect(names).not.toContain(inactiveName);

        for (const item of responseBody.items) {
            expect(item.isActive).toBe(true);
        }
    });

    it("GET pagina los resultados", async () => {
        for (let index = 0; index < 3; index += 1) {
            await createDisease(
                {
                    name: `Enfermedad paginada ${index}-${randomUUID()}`,
                },
                requiredAdminId(),
            );
        }

        await authenticateRouteUser("ADMIN");

        const response = await requestDiseaseList({
            page: "1",
            pageSize: "2",
        });

        expect(response.status).toBe(200);

        const responseBody = await response.json();

        expect(responseBody.page).toBe(1);
        expect(responseBody.pageSize).toBe(2);
        expect(responseBody.items).toHaveLength(2);
        expect(responseBody.total).toBeGreaterThanOrEqual(3);
    });

    it.each(["ADMIN", "SUPERVISOR", "READER"] as const)(
        "GET permite que %s liste enfermedades",
        async (role) => {
            const name = `Enfermedad lectura ${role}-${randomUUID()}`;

            await createDisease(
                {
                    name,
                },
                requiredAdminId(),
            );

            await authenticateRouteUser(role);

            const response = await requestDiseaseList();

            expect(response.status).toBe(200);

            const responseBody = await response.json();

            const names = responseBody.items.map(
                (item: { name: string }) => item.name,
            );

            expect(names).toContain(name);
        },
    );

    it("GET rechaza la consulta sin sesión", async () => {
        const response = await requestDiseaseList();

        expect(response.status).toBe(401);

        expect(await response.json()).toEqual({
            error: "No hay una sesión activa.",
        });
    });

    it.each([
        {
            label: "con una página inválida",
            searchParams: {
                page: "0",
            },
        },
        {
            label: "con un tamaño de página inválido",
            searchParams: {
                pageSize: "0",
            },
        },
        {
            label: "con un tamaño de página excesivo",
            searchParams: {
                pageSize: "101",
            },
        },
        {
            label: "con un estado inválido",
            searchParams: {
                isActive: "tal vez",
            },
        },
    ])(
        "GET rechaza la consulta $label",
        async ({ searchParams }) => {
            await authenticateRouteUser("ADMIN");

            const response = await requestDiseaseList(searchParams);

            expect(response.status).toBe(400);

            expect(await response.json()).toMatchObject({
                error: "Parámetros de consulta invalidos.",
            });
        },
    );

    it("PATCH actualiza el nombre, la descripción y el estado", async () => {
        const disease = await createDisease(
            {
                name: `Enfermedad original-${randomUUID()}`,
                description: "Descripción original.",
                isActive: true,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("ADMIN");

        const newName = `Enfermedad actualizada-${randomUUID()}`;

        const response = await requestDiseaseUpdate(disease.id, {
            name: newName,
            description: "Descripción actualizada.",
            isActive: false,
        });

        expect(response.status).toBe(200);

        const responseBody = await response.json();

        expect(responseBody).toMatchObject({
            disease: {
                id: disease.id,
                name: newName,
                description: "Descripción actualizada.",
                isActive: false,
            },
        });

        const stored = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        expect(stored.name).toBe(newName);
        expect(stored.description).toBe("Descripción actualizada.");
        expect(stored.isActive).toBe(false);
        expect(stored.updatedById).toBe(requiredAdminId());
    });

    it("PATCH actualiza solo el estado activo", async () => {
        const disease = await createDisease(
            {
                name: `Enfermedad estado-${randomUUID()}`,
                description: "Descripción sin cambios.",
                isActive: true,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("ADMIN");

        const response = await requestDiseaseUpdate(disease.id, {
            isActive: false,
        });

        expect(response.status).toBe(200);

        const responseBody = await response.json();

        expect(responseBody).toMatchObject({
            disease: {
                id: disease.id,
                name: disease.name,
                description: "Descripción sin cambios.",
                isActive: false,
            },
        });
    });

    it("PATCH rechaza la actualización sin sesión y conserva los datos", async () => {
        const disease = await createDisease(
            {
                name: `Enfermedad sin sesion-${randomUUID()}`,
                isActive: true,
            },
            requiredAdminId(),
        );

        const before = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        const response = await requestDiseaseUpdate(disease.id, {
            name: `Enfermedad cambiada-${randomUUID()}`,
        });

        expect(response.status).toBe(401);

        expect(await response.json()).toEqual({
            error: "No hay una sesión activa.",
        });

        const after = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        expect(after.name).toBe(before.name);
        expect(after.isActive).toBe(true);
        expect(after.updatedById).toBe(before.updatedById);
        expect(after.updatedAt).toEqual(before.updatedAt);
    });

    it("PATCH impide que un lector actualice enfermedades y conserva los datos", async () => {
        const disease = await createDisease(
            {
                name: `Enfermedad lector-${randomUUID()}`,
                isActive: true,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("READER");

        const before = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        const response = await requestDiseaseUpdate(disease.id, {
            name: `Enfermedad cambiada por lector-${randomUUID()}`,
        });

        expect(response.status).toBe(403);

        expect(await response.json()).toEqual({
            error: "No tienes permiso para modificar enfermedades.",
        });

        const after = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        expect(after.name).toBe(before.name);
        expect(after.isActive).toBe(true);
        expect(after.updatedById).toBe(before.updatedById);
        expect(after.updatedAt).toEqual(before.updatedAt);
    });

    it.each(["ADMIN", "SUPERVISOR"] as const)(
        "PATCH permite que %s actualice una enfermedad",
        async (role) => {
            const disease = await createDisease(
                {
                    name: `Enfermedad actualizable ${role}-${randomUUID()}`,
                },
                requiredAdminId(),
            );

            await authenticateRouteUser(role);

            const newName = `Enfermedad actualizada ${role}-${randomUUID()}`;

            const response = await requestDiseaseUpdate(disease.id, {
                name: newName,
            });

            expect(response.status).toBe(200);

            const responseBody = await response.json();

            expect(responseBody).toMatchObject({
                disease: {
                    id: disease.id,
                    name: newName,
                },
            });

            const stored = await db.disease.findUniqueOrThrow({
                where: {
                    id: disease.id,
                },
            });

            expect(stored.name).toBe(newName);
            expect(stored.updatedById).toBe(requiredAdminId());
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
        "PATCH rechaza la actualización $label y conserva los datos",
        async ({ origin }) => {
            const disease = await createDisease(
                {
                    name: `Enfermedad origen-${randomUUID()}`,
                    isActive: true,
                },
                requiredAdminId(),
            );

            await authenticateRouteUser("ADMIN");

            const before = await db.disease.findUniqueOrThrow({
                where: {
                    id: disease.id,
                },
            });

            const response = await requestDiseaseUpdate(
                disease.id,
                {
                    name: `Enfermedad cambiada-${randomUUID()}`,
                },
                origin,
            );

            expect(response.status).toBe(403);

            expect(await response.json()).toEqual({
                error: "Origen no autorizado para esta operación.",
            });

            const after = await db.disease.findUniqueOrThrow({
                where: {
                    id: disease.id,
                },
            });

            expect(after.name).toBe(before.name);
            expect(after.isActive).toBe(true);
            expect(after.updatedById).toBe(before.updatedById);
            expect(after.updatedAt).toEqual(before.updatedAt);
        },
    );

    it("PATCH rechaza un identificador inválido sin modificar datos", async () => {
        await authenticateRouteUser("ADMIN");

        const beforeCount = await db.disease.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        const response = await requestDiseaseUpdate(
            "identificador-invalido",
            {
                name: `Enfermedad id invalido-${randomUUID()}`,
            },
        );

        expect(response.status).toBe(400);

        expect(await response.json()).toMatchObject({
            error: "Datos de enfermedad invalidos.",
            details: {
                id: ["El identificador de la enfermedad no es válido."],
            },
        });

        const afterCount = await db.disease.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        expect(afterCount).toBe(beforeCount);
    });

    it("PATCH rechaza una enfermedad inexistente", async () => {
        await authenticateRouteUser("ADMIN");

        const response = await requestDiseaseUpdate(randomUUID(), {
            name: `Enfermedad inexistente-${randomUUID()}`,
        });

        expect(response.status).toBe(404);

        expect(await response.json()).toEqual({
            error: "La enfermedad no existe.",
        });
    });

    it.each([
        {
            label: "sin campos para actualizar",
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
        "PATCH rechaza el cuerpo $label y conserva los datos",
        async ({ body }) => {
            const disease = await createDisease(
                {
                    name: `Enfermedad validacion-${randomUUID()}`,
                    description: "Descripción original.",
                    isActive: true,
                },
                requiredAdminId(),
            );

            await authenticateRouteUser("ADMIN");

            const before = await db.disease.findUniqueOrThrow({
                where: {
                    id: disease.id,
                },
            });

            const response = await requestDiseaseUpdate(disease.id, body);

            expect(response.status).toBe(400);

            expect(await response.json()).toMatchObject({
                error: "Datos de enfermedad invalidos.",
            });

            const after = await db.disease.findUniqueOrThrow({
                where: {
                    id: disease.id,
                },
            });

            expect(after.name).toBe(before.name);
            expect(after.description).toBe(before.description);
            expect(after.isActive).toBe(true);
            expect(after.updatedById).toBe(before.updatedById);
            expect(after.updatedAt).toEqual(before.updatedAt);
        },
    );

    it("PATCH rechaza un nombre duplicado con 409 y conserva los datos", async () => {
        const existingName = `Enfermedad existente-${randomUUID()}`;

        await createDisease(
            {
                name: existingName,
            },
            requiredAdminId(),
        );

        const disease = await createDisease(
            {
                name: `Enfermedad a duplicar-${randomUUID()}`,
            },
            requiredAdminId(),
        );

        await authenticateRouteUser("ADMIN");

        const before = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        const response = await requestDiseaseUpdate(disease.id, {
            name: existingName,
        });

        expect(response.status).toBe(409);

        expect(await response.json()).toEqual({
            error: "Ya existe una enfermedad con ese nombre.",
        });

        const after = await db.disease.findUniqueOrThrow({
            where: {
                id: disease.id,
            },
        });

        expect(after.name).toBe(before.name);
        expect(after.updatedById).toBe(before.updatedById);
        expect(after.updatedAt).toEqual(before.updatedAt);
    });
});