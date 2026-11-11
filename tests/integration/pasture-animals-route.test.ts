import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
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

const cookieState = vi.hoisted(() => ({
    accessToken: undefined as string | undefined,
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => {
            const cookieName =
                process.env.AUTH_COOKIE_NAME ?? "agrotrack_session";

            if (
                name !== cookieName ||
                cookieState.accessToken === undefined
            ) {
                return undefined;
            }

            return {
                name,
                value: cookieState.accessToken,
            };
        },
    }),
}));

import { GET } from "../../src/app/api/pastures/[id]/animals/route";
import { POST as createPastureRoute } from "../../src/app/api/pastures/route";
import { PATCH as updatePastureRoute } from "../../src/app/api/pastures/[id]/route";
import { db } from "../../src/lib/server/db";
import { hashPassword } from "../../src/lib/server/auth/password";
import { createSession } from "../../src/lib/server/auth/session-service";
import { createPasture } from "../../src/lib/server/pastures/service";

describe("GET /api/pastures/[id]/animals", () => {
    let databaseVerified = false;
    let userId: string | undefined;
    let pastureId: string | undefined;
    let speciesId: number | undefined;

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

        const id = randomUUID();

        await db.user.create({
            data: {
                id,
                identification: `TEST-${id}`,
                fullName: "Lector de animales por terreno",
                email: `pasture-animals-${id}@example.com`,
                passwordHash: await hashPassword(
                    "contrasenaficticiadeintegracion",
                ),
                role: "READER",
                status: "ACTIVE",
                mustChangePassword: false,
            },
        });

        userId = id;

        const farm = await db.farm.findFirst({
            select: {
                id: true,
            },
        });

        if (!farm) {
            await db.farm.create({
                data: {
                    id: 1,
                    name: "Finca de prueba",
                },
            });
        }

        const pasture = await createPasture(
            {
                name: `Potrero endpoint-${randomUUID()}`,
                description: null,
                areaHectares: 10,
            },
            id,
        );

        pastureId = pasture.id;
    });

    afterEach(async () => {
        cookieState.accessToken = undefined;

        if (!databaseVerified) {
            return;
        }

        const currentUserId = userId;
        const currentSpeciesId = speciesId;

        await db.$transaction(async (tx) => {
            if (currentUserId !== undefined) {
                await tx.animalChangeLog.deleteMany({
                    where: {
                        changedById: currentUserId,
                    },
                });

                await tx.animal.deleteMany({
                    where: {
                        createdById: currentUserId,
                    },
                });

                await tx.pasture.deleteMany({
                    where: {
                        createdById: currentUserId,
                    },
                });
            }

            if (currentSpeciesId !== undefined) {
                await tx.species.deleteMany({
                    where: {
                        id: currentSpeciesId,
                    },
                });
            }

            if (currentUserId !== undefined) {
                await tx.session.deleteMany({
                    where: {
                        userId: currentUserId,
                    },
                });

                await tx.user.deleteMany({
                    where: {
                        id: currentUserId,
                    },
                });
            }
        });

        userId = undefined;
        pastureId = undefined;
        speciesId = undefined;
    });

    afterAll(async () => {
        await db.$disconnect();
    });

    function requiredUserId(): string {
        if (userId === undefined) {
            throw new Error("No se creó el lector de prueba.");
        }

        return userId;
    }

    function requiredPastureId(): string {
        if (pastureId === undefined) {
            throw new Error("No se creó el terreno de prueba.");
        }

        return pastureId;
    }

    function requiredAllowedOrigin(): string {
        const origin = process.env.AUTH_ALLOWED_ORIGINS
            ?.split(",")
            .map((value) => value.trim())
            .find((value) => value.length > 0);

        if (!origin) {
            throw new Error(
                "AUTH_ALLOWED_ORIGINS debe contener al menos un origen para las pruebas de escritura de terrenos.",
            );
        }

        return origin;
    }

    async function createAnimalFixture(
        assignedPastureId: string,
        isActive = true,
    ): Promise<string> {
        if (speciesId === undefined) {
            const species = await db.species.create({
                data: {
                    name: `Especie endpoint-${randomUUID()}`,
                    isActive: true,
                },
            });

            speciesId = species.id;
        }

        const pasture = await db.pasture.findUniqueOrThrow({
            where: {
                id: assignedPastureId,
            },
            select: {
                farmId: true,
            },
        });

        const animal = await db.animal.create({
            data: {
                farmId: pasture.farmId,
                code: `TEST-${randomUUID()}`,
                name: "Animal de prueba del endpoint",
                speciesId,
                breedId: null,
                sex: "FEMALE",
                birthDate: new Date("2024-01-01T00:00:00.000Z"),
                weightKg: 120.5,
                motherId: null,
                fatherId: null,
                status: "ALIVE",
                isActive,
                currentPastureId: assignedPastureId,
                createdById: requiredUserId(),
            },
            select: {
                id: true,
            },
        });

        return animal.id;
    }

    async function authenticateReader(): Promise<void> {
        const session = await createSession(requiredUserId());

        cookieState.accessToken = session.accessToken;
    }

    async function authenticateWithRole(
        role: "ADMIN" | "SUPERVISOR",
    ): Promise<void> {
        const id = requiredUserId();

        await db.user.update({
            where: {
                id,
            },
            data: {
                role,
            },
        });

        const session = await createSession(id);

        cookieState.accessToken = session.accessToken;
    }

    async function requestPastureAnimals(
        id: string,
        query: Record<string, string> = {},
    ) {
        const url = new URL(
            `http://localhost/api/pastures/${id}/animals`,
        );

        for (const [key, value] of Object.entries(query)) {
            url.searchParams.set(key, value);
        }

        const request = new NextRequest(url);

        return GET(request, {
            params: Promise.resolve({ id }),
        });
    }
    it("rechaza una solicitud sin sesión", async () => {
        const response = await requestPastureAnimals(
            requiredPastureId(),
        );

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({
            error: "No hay una sesión activa.",
        });
    });

    it("rechaza un identificador de terreno inválido", async () => {
        await authenticateReader();

        const response = await requestPastureAnimals(
            "identificador-invalido",
        );

        expect(response.status).toBe(400);
    });

    it("devuelve 404 si el terreno no existe", async () => {
        await authenticateReader();

        const response = await requestPastureAnimals(randomUUID());

        expect(response.status).toBe(404);
        expect(await response.json()).toEqual({
            error: "El terreno solicitado no existe.",
        });
    });

    it("permite a un lector consultar un terreno vacío", async () => {
        await authenticateReader();

        const response = await requestPastureAnimals(
            requiredPastureId(),
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            items: [],
            page: 1,
            pageSize: 20,
            total: 0,
        });

        expect(response.headers.get("Cache-Control")).toBe("no-store");
    });

    it("devuelve solo los animales del terreno solicitado", async () => {
        const requestedPastureId = requiredPastureId();

        const otherPasture = await createPasture(
            {
                name: `Otro potrero endpoint-${randomUUID()}`,
                description: null,
                areaHectares: 5,
            },
            requiredUserId(),
        );

        const expectedAnimalId = await createAnimalFixture(
            requestedPastureId,
        );

        await createAnimalFixture(otherPasture.id);

        await authenticateReader();

        const response = await requestPastureAnimals(
            requestedPastureId,
        );

        expect(response.status).toBe(200);

        const body = await response.json();

        expect(body.total).toBe(1);
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({
            id: expectedAnimalId,
            currentPastureId: requestedPastureId,
            isActive: true,
        });
    });

    it("excluye los animales desactivados del listado y del total", async () => {
        const currentPastureId = requiredPastureId();

        const activeAnimalId = await createAnimalFixture(
            currentPastureId,
        );

        await createAnimalFixture(currentPastureId, false);

        await authenticateReader();

        const response = await requestPastureAnimals(
            currentPastureId,
        );

        expect(response.status).toBe(200);

        const body = await response.json();

        expect(body.total).toBe(1);
        expect(body.items).toHaveLength(1);
        expect(body.items[0]).toMatchObject({
            id: activeAnimalId,
            currentPastureId,
            isActive: true,
        });
    });

    it("pagina los animales sin repetirlos y conserva el total", async () => {
        const currentPastureId = requiredPastureId();

        const firstAnimalId = await createAnimalFixture(
            currentPastureId,
        );

        const secondAnimalId = await createAnimalFixture(
            currentPastureId,
        );

        const thirdAnimalId = await createAnimalFixture(
            currentPastureId,
        );

        await authenticateReader();

        const firstResponse = await requestPastureAnimals(
            currentPastureId,
            {
                page: "1",
                pageSize: "2",
            },
        );

        const secondResponse = await requestPastureAnimals(
            currentPastureId,
            {
                page: "2",
                pageSize: "2",
            },
        );

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);

        const firstPage = await firstResponse.json();
        const secondPage = await secondResponse.json();

        expect(firstPage).toMatchObject({
            page: 1,
            pageSize: 2,
            total: 3,
        });

        expect(secondPage).toMatchObject({
            page: 2,
            pageSize: 2,
            total: 3,
        });

        expect(firstPage.items).toHaveLength(2);
        expect(secondPage.items).toHaveLength(1);

        const returnedIds = [
            ...firstPage.items.map((animal: { id: string }) => animal.id),
            ...secondPage.items.map((animal: { id: string }) => animal.id),
        ];

        expect(new Set(returnedIds).size).toBe(3);

        expect([...returnedIds].sort()).toEqual(
            [
                firstAnimalId,
                secondAnimalId,
                thirdAnimalId,
            ].sort(),
        );
    });

    it("no permite reemplazar el terreno de la ruta mediante pastureId", async () => {
        const requestedPastureId = requiredPastureId();

        const otherPasture = await createPasture(
            {
                name: `Potrero consulta-${randomUUID()}`,
                description: null,
                areaHectares: 5,
            },
            requiredUserId(),
        );

        const expectedAnimalId = await createAnimalFixture(
            requestedPastureId,
        );

        await createAnimalFixture(otherPasture.id);

        await authenticateReader();

        const response = await requestPastureAnimals(
            requestedPastureId,
            {
                pastureId: otherPasture.id,
            },
        );

        expect(response.status).toBe(200);

        const body = await response.json();

        expect(body.total).toBe(1);
        expect(body.items).toHaveLength(1);

        expect(body.items[0]).toMatchObject({
            id: expectedAnimalId,
            currentPastureId: requestedPastureId,
        });
    });

    it("impide que un lector cree terrenos y no guarda el registro", async () => {
        await authenticateReader();

        const name = `Terreno no autorizado-${randomUUID()}`;
        const origin = requiredAllowedOrigin();

        const request = new NextRequest(
            new URL("/api/pastures", origin),
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Origin: origin,
                },
                body: JSON.stringify({
                    name,
                    description: "Este terreno no debe crearse.",
                    areaHectares: 5,
                }),
            },
        );

        const response = await createPastureRoute(request);

        expect(response.status).toBe(403);

        expect(await response.json()).toEqual({
            error: "No tienes permiso para crear terrenos.",
        });

        const storedCount = await db.pasture.count({
            where: {
                name,
            },
        });

        expect(storedCount).toBe(0);
    });

    it("impide que un lector modifique terrenos y conserva los datos", async () => {
        const id = requiredPastureId();

        const before = await db.pasture.findUniqueOrThrow({
            where: {
                id,
            },
        });

        await authenticateReader();

        const origin = requiredAllowedOrigin();

        const request = new NextRequest(
            new URL(`/api/pastures/${id}`, origin),
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Origin: origin,
                },
                body: JSON.stringify({
                    name: `Cambio no autorizado-${randomUUID()}`,
                    description: "Esta modificación no debe guardarse.",
                    areaHectares: 99,
                    isActive: false,
                }),
            },
        );

        const response = await updatePastureRoute(request, {
            params: Promise.resolve({ id }),
        });

        expect(response.status).toBe(403);

        expect(await response.json()).toEqual({
            error: "No tienes permiso para modificar terrenos.",
        });

        const after = await db.pasture.findUniqueOrThrow({
            where: {
                id,
            },
        });

        expect({
            name: after.name,
            description: after.description,
            areaHectares: after.areaHectares?.toString() ?? null,
            isActive: after.isActive,
            updatedById: after.updatedById,
            updatedAt: after.updatedAt,
        }).toEqual({
            name: before.name,
            description: before.description,
            areaHectares: before.areaHectares?.toString() ?? null,
            isActive: before.isActive,
            updatedById: before.updatedById,
            updatedAt: before.updatedAt,
        });
    });

    it.each(["ADMIN", "SUPERVISOR"] as const)(
        "permite que %s cree un terreno",
        async (role) => {
            await authenticateWithRole(role);

            const name = `Terreno autorizado-${randomUUID()}`;
            const origin = requiredAllowedOrigin();

            const request = new NextRequest(
                new URL("/api/pastures", origin),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Origin: origin,
                    },
                    body: JSON.stringify({
                        name,
                        description: "Terreno creado desde el endpoint.",
                        areaHectares: 7.5,
                    }),
                },
            );

            const response = await createPastureRoute(request);

            expect(response.status).toBe(201);

            const body = await response.json();

            expect(body.pasture).toMatchObject({
                name,
                description: "Terreno creado desde el endpoint.",
                areaHectares: "7.5",
                isActive: true,
            });

            expect(body.pasture.id).toEqual(expect.any(String));

            const stored = await db.pasture.findUniqueOrThrow({
                where: {
                    id: body.pasture.id,
                },
            });

            expect(stored.name).toBe(name);
            expect(stored.description).toBe(
                "Terreno creado desde el endpoint.",
            );
            expect(stored.areaHectares?.toString()).toBe("7.5");
            expect(stored.isActive).toBe(true);
            expect(stored.createdById).toBe(requiredUserId());
        },
    );

    it.each(["ADMIN", "SUPERVISOR"] as const)(
        "permite que %s modifique un terreno",
        async (role) => {
            const id = requiredPastureId();

            await authenticateWithRole(role);

            const name = `Terreno actualizado-${randomUUID()}`;
            const origin = requiredAllowedOrigin();

            const request = new NextRequest(
                new URL(`/api/pastures/${id}`, origin),
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Origin: origin,
                    },
                    body: JSON.stringify({
                        name,
                        description: "Terreno modificado desde el endpoint.",
                        areaHectares: 8.25,
                    }),
                },
            );

            const response = await updatePastureRoute(request, {
                params: Promise.resolve({ id }),
            });

            expect(response.status).toBe(200);

            const body = await response.json();

            expect(body.pasture).toMatchObject({
                id,
                name,
                description: "Terreno modificado desde el endpoint.",
                areaHectares: "8.25",
                isActive: true,
            });

            const stored = await db.pasture.findUniqueOrThrow({
                where: {
                    id,
                },
            });

            expect(stored.name).toBe(name);
            expect(stored.description).toBe(
                "Terreno modificado desde el endpoint.",
            );
            expect(stored.areaHectares?.toString()).toBe("8.25");
            expect(stored.isActive).toBe(true);
            expect(stored.updatedById).toBe(requiredUserId());
        },
    );
});