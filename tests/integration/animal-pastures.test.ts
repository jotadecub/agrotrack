import { NextRequest } from "next/server";

import {
    createSession,
} from "../../src/lib/server/auth/session-service";

import {
    PUT as updateAnimalPastureRoute,
} from "../../src/app/api/animals/[id]/pasture/route";

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
import {
    createAnimal, updateAnimalPasture,
} from "../../src/lib/server/animals/service";
import {
    createPasture,
} from "../../src/lib/server/pastures/service";

describe("asignacion de animales a terrenos", () => {
    let databaseVerified = false;
    let adminId: string | undefined;
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

        const userId = randomUUID();

        await db.user.create({
            data: {
                id: userId,
                identification: `ADMIN-${userId}`,
                fullName: "Administrador de animales",
                email: `animal-pastures-${userId}@example.com`,
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

        const species = await db.species.create({
            data: {
                name: `Especie-${randomUUID()}`,
                isActive: true,
            },
        });

        speciesId = species.id;
    });

    afterEach(async () => {
        if (!databaseVerified || !adminId) {
            return;
        }

        const userId = adminId;

        await db.$transaction(async (tx) => {
            await tx.animalChangeLog.deleteMany({
                where: {
                    changedById: userId,
                },
            });

            await tx.animal.deleteMany({
                where: {
                    createdById: userId,
                },
            });

            await tx.pasture.deleteMany({
                where: {
                    createdById: userId,
                },
            });

            await tx.species.deleteMany({
                where: {
                    id: speciesId,
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

    function requiredSpeciesId(): number {
        if (!speciesId) {
            throw new Error("No se creó la especie de prueba.");
        }

        return speciesId;
    }

    async function createTestAnimal(): Promise<string> {
        const animal = await createAnimal(
            {
                code: `ANIMAL-${randomUUID()}`,
                name: "Animal de prueba",
                speciesId: requiredSpeciesId(),
                sex: "FEMALE",
                birthDate: new Date("2024-01-01T00:00:00.000Z"),
                weightKg: 120.5,
                motherId: null,
                fatherId: null,
                status: "ALIVE",
                breedId: null,
            },
            requiredAdminId(),
        );

        return animal.id;
    }

    async function createTestPasture(): Promise<string> {
        const pasture = await createPasture(
            {
                name: `Potrero-${randomUUID()}`,
                description: null,
                areaHectares: 10,
            },
            requiredAdminId(),
        );

        return pasture.id;
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

    async function requestPastureAssignment(
        animalId: string,
        currentPastureId: string | null,
        originOverride?: string | null,
    ): Promise<Response> {
        const allowedOrigin = process.env.AUTH_ALLOWED_ORIGINS
            ?.split(",")
            .map((value) => value.trim())
            .find((value) => value.length > 0);

        if (!allowedOrigin) {
            throw new Error(
                "AUTH_ALLOWED_ORIGINS debe estar definido para probar el endpoint de asignación.",
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
            new URL(`/api/animals/${animalId}/pasture`, allowedOrigin),
            {
                method: "PUT",
                headers,
                body: JSON.stringify({
                    currentPastureId,
                }),
            },
        );

        return updateAnimalPastureRoute(request, {
            params: Promise.resolve({
                id: animalId,
            }),
        });
    }

    it("asigna un terreno a un animal", async () => {
        const animalId = await createTestAnimal();
        const pastureId = await createTestPasture();

        const animal = await updateAnimalPasture(
            animalId,
            {
                currentPastureId: pastureId,
            },
            requiredAdminId(),
        );

        expect(animal.id).toBe(animalId);

        const stored = await db.animal.findFirst({
            where: {
                id: animalId,
            },
            select: {
                currentPastureId: true,
            },
        });

        expect(stored?.currentPastureId).toBe(pastureId);
    });

    it("cambia el terreno de un animal", async () => {
        const animalId = await createTestAnimal();
        const firstPastureId = await createTestPasture();
        const secondPastureId = await createTestPasture();

        await updateAnimalPasture(
            animalId,
            {
                currentPastureId: firstPastureId,
            },
            requiredAdminId(),
        );

        const animal = await updateAnimalPasture(
            animalId,
            {
                currentPastureId: secondPastureId,
            },
            requiredAdminId(),
        );

        expect(animal.id).toBe(animalId);

        const stored = await db.animal.findFirst({
            where: {
                id: animalId,
            },
            select: {
                currentPastureId: true,
            },
        });

        expect(stored?.currentPastureId).toBe(secondPastureId);
    });

    it("desasigna el terreno de un animal", async () => {
        const animalId = await createTestAnimal();
        const pastureId = await createTestPasture();

        await updateAnimalPasture(
            animalId,
            {
                currentPastureId: pastureId,
            },
            requiredAdminId(),
        );

        const animal = await updateAnimalPasture(
            animalId,
            {
                currentPastureId: null,
            },
            requiredAdminId(),
        );

        expect(animal.id).toBe(animalId);

        const stored = await db.animal.findFirst({
            where: {
                id: animalId,
            },
            select: {
                currentPastureId: true,
            },
        });

        expect(stored?.currentPastureId).toBeNull();
    });

    it("rechaza un terreno inexistente", async () => {
        const animalId = await createTestAnimal();

        await expect(
            updateAnimalPasture(
                animalId,
                {
                    currentPastureId: randomUUID(),
                },
                requiredAdminId(),
            ),
        ).rejects.toMatchObject({
            name: "PastureNotFoundError",
        });
    });

    it("rechaza un animal inexistente", async () => {
        const pastureId = await createTestPasture();

        await expect(
            updateAnimalPasture(
                randomUUID(),
                {
                    currentPastureId: pastureId,
                },
                requiredAdminId(),
            ),
        ).rejects.toMatchObject({
            name: "AnimalNotFoundError",
        });
    });

    it("registra el cambio de terreno en el historial", async () => {
        const animalId = await createTestAnimal();
        const firstPastureId = await createTestPasture();
        const secondPastureId = await createTestPasture();

        await updateAnimalPasture(
            animalId,
            {
                currentPastureId: firstPastureId,
            },
            requiredAdminId(),
        );

        await updateAnimalPasture(
            animalId,
            {
                currentPastureId: secondPastureId,
            },
            requiredAdminId(),
        );

        const logs = await db.animalChangeLog.findMany({
            where: {
                animalId,
                action: "PASTURE_CHANGED",
            },
            orderBy: {
                createdAt: "asc",
            },
        });

        expect(logs).toHaveLength(2);
        expect(logs[0]?.newData).toEqual({
            currentPastureId: firstPastureId,
        });
        expect(logs[1]?.newData).toEqual({
            currentPastureId: secondPastureId,
        });
    });

    it("rechaza un terreno inactivo", async () => {
        const animalId = await createTestAnimal();

        const pasture = await createTestPasture();

        await db.pasture.update({
            where: {
                id: pasture,
            },
            data: {
                isActive: false,
            },
        });

        await expect(
            updateAnimalPasture(
                animalId,
                {
                    currentPastureId: pasture,
                },
                requiredAdminId(),
            ),
        ).rejects.toMatchObject({
            name: "PastureNotFoundError",
        });
    });

    it("rechaza asignar un terreno a un animal inactivo", async () => {
        const animalId = await createTestAnimal();
        const pastureId = await createTestPasture();

        await db.animal.update({
            where: {
                id: animalId,
            },
            data: {
                isActive: false,
            },
        });

        const before = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        const beforeLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        await expect(
            updateAnimalPasture(
                animalId,
                {
                    currentPastureId: pastureId,
                },
                requiredAdminId(),
            ),
        ).rejects.toMatchObject({
            name: "AnimalNotFoundError",
        });

        const after = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        expect(after.currentPastureId).toBe(before.currentPastureId);
        expect(after.isActive).toBe(false);
        expect(after.updatedById).toBe(before.updatedById);
        expect(after.updatedAt).toEqual(before.updatedAt);

        const afterLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        expect(afterLogCount).toBe(beforeLogCount);
    });

    it("no modifica el animal ni duplica el historial al repetir el terreno actual", async () => {
        const animalId = await createTestAnimal();
        const pastureId = await createTestPasture();

        await updateAnimalPasture(
            animalId,
            {
                currentPastureId: pastureId,
            },
            requiredAdminId(),
        );

        const before = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        const beforeLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        const result = await updateAnimalPasture(
            animalId,
            {
                currentPastureId: pastureId,
            },
            requiredAdminId(),
        );

        expect(result.id).toBe(animalId);
        expect(result.currentPastureId).toBe(pastureId);

        const after = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        expect(after.currentPastureId).toBe(pastureId);
        expect(after.updatedById).toBe(before.updatedById);
        expect(after.updatedAt).toEqual(before.updatedAt);

        const afterLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        expect(afterLogCount).toBe(beforeLogCount);
    });

    it("PUT rechaza la asignación sin sesión y no cambia los datos", async () => {
        const animalId = await createTestAnimal();
        const pastureId = await createTestPasture();

        const before = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        const beforeLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        const response = await requestPastureAssignment(
            animalId,
            pastureId,
        );

        expect(response.status).toBe(401);

        expect(await response.json()).toEqual({
            error: "No hay una sesión activa.",
        });

        const after = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        expect(after.currentPastureId).toBe(before.currentPastureId);
        expect(after.updatedById).toBe(before.updatedById);
        expect(after.updatedAt).toEqual(before.updatedAt);

        const afterLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        expect(afterLogCount).toBe(beforeLogCount);
    });

    it("PUT impide que un lector asigne terrenos y conserva los datos", async () => {
        const animalId = await createTestAnimal();
        const pastureId = await createTestPasture();

        await authenticateRouteUser("READER");

        const before = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        const beforeLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        const response = await requestPastureAssignment(
            animalId,
            pastureId,
        );

        expect(response.status).toBe(403);

        expect(await response.json()).toEqual({
            error: "No tienes permiso para cambiar el terreno del animal.",
        });

        const after = await db.animal.findUniqueOrThrow({
            where: {
                id: animalId,
            },
        });

        expect(after.currentPastureId).toBe(before.currentPastureId);
        expect(after.updatedById).toBe(before.updatedById);
        expect(after.updatedAt).toEqual(before.updatedAt);

        const afterLogCount = await db.animalChangeLog.count({
            where: {
                animalId,
            },
        });

        expect(afterLogCount).toBe(beforeLogCount);
    });

    it.each(["ADMIN", "SUPERVISOR"] as const)(
        "PUT permite que %s asigne un terreno y registra el cambio",
        async (role) => {
            const animalId = await createTestAnimal();
            const pastureId = await createTestPasture();

            await authenticateRouteUser(role);

            const response = await requestPastureAssignment(
                animalId,
                pastureId,
            );

            expect(response.status).toBe(200);

            expect(await response.json()).toMatchObject({
                animal: {
                    id: animalId,
                    currentPastureId: pastureId,
                },
            });

            const stored = await db.animal.findUniqueOrThrow({
                where: {
                    id: animalId,
                },
            });

            expect(stored.currentPastureId).toBe(pastureId);
            expect(stored.updatedById).toBe(requiredAdminId());

            const logs = await db.animalChangeLog.findMany({
                where: {
                    animalId,
                    action: "PASTURE_CHANGED",
                },
            });

            expect(logs).toHaveLength(1);

            expect(logs[0]).toMatchObject({
                changedById: requiredAdminId(),
                previousData: {
                    currentPastureId: null,
                },
                newData: {
                    currentPastureId: pastureId,
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
        "PUT rechaza la asignación $label y conserva los datos",
        async ({ origin }) => {
            const animalId = await createTestAnimal();
            const currentPastureId = await createTestPasture();
            const nextPastureId = await createTestPasture();

            await updateAnimalPasture(
                animalId,
                {
                    currentPastureId,
                },
                requiredAdminId(),
            );

            await authenticateRouteUser("ADMIN");

            const before = await db.animal.findUniqueOrThrow({
                where: {
                    id: animalId,
                },
            });

            const beforeLogCount = await db.animalChangeLog.count({
                where: {
                    animalId,
                },
            });

            const response = await requestPastureAssignment(
                animalId,
                nextPastureId,
                origin,
            );

            expect(response.status).toBe(403);

            expect(await response.json()).toEqual({
                error: "Origen no autorizado para esta operación.",
            });

            const after = await db.animal.findUniqueOrThrow({
                where: {
                    id: animalId,
                },
            });

            expect(after.currentPastureId).toBe(currentPastureId);
            expect(after.currentPastureId).toBe(before.currentPastureId);
            expect(after.updatedById).toBe(before.updatedById);
            expect(after.updatedAt).toEqual(before.updatedAt);

            const afterLogCount = await db.animalChangeLog.count({
                where: {
                    animalId,
                },
            });

            expect(afterLogCount).toBe(beforeLogCount);
        },
    );

    it("PUT rechaza un identificador de animal inválido sin modificar datos", async () => {
        const pastureId = await createTestPasture();

        await authenticateRouteUser("ADMIN");

        const beforeAnimalCount = await db.animal.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        const beforeLogCount = await db.animalChangeLog.count({
            where: {
                changedById: requiredAdminId(),
            },
        });

        const response = await requestPastureAssignment(
            "identificador-invalido",
            pastureId,
        );

        expect(response.status).toBe(400);

        expect(await response.json()).toMatchObject({
            error: "Datos de asignacion invalidos.",
            details: {
                id: ["El identificador del animal no es válido."],
            },
        });

        const afterAnimalCount = await db.animal.count({
            where: {
                createdById: requiredAdminId(),
            },
        });

        const afterLogCount = await db.animalChangeLog.count({
            where: {
                changedById: requiredAdminId(),
            },
        });

        expect(afterAnimalCount).toBe(beforeAnimalCount);
        expect(afterLogCount).toBe(beforeLogCount);
    });

    it.each([
        {
            label: "sin currentPastureId",
            body: {},
        },
        {
            label: "con un UUID de terreno inválido",
            body: {
                currentPastureId: "terreno-invalido",
            },
        },
        {
            label: "con una cadena vacía como terreno",
            body: {
                currentPastureId: "",
            },
        },
        {
            label: "con campos adicionales",
            body: {
                currentPastureId: null,
                isActive: false,
            },
        },
    ])(
        "PUT rechaza el cuerpo $label y conserva los datos",
        async ({ body }) => {
            const animalId = await createTestAnimal();
            const pastureId = await createTestPasture();

            await updateAnimalPasture(
                animalId,
                {
                    currentPastureId: pastureId,
                },
                requiredAdminId(),
            );

            await authenticateRouteUser("ADMIN");

            const before = await db.animal.findUniqueOrThrow({
                where: {
                    id: animalId,
                },
            });

            const beforeLogCount = await db.animalChangeLog.count({
                where: {
                    animalId,
                },
            });

            const origin = process.env.AUTH_ALLOWED_ORIGINS
                ?.split(",")
                .map((value) => value.trim())
                .find((value) => value.length > 0);

            if (!origin) {
                throw new Error(
                    "AUTH_ALLOWED_ORIGINS debe estar definido para probar el endpoint de asignación.",
                );
            }

            const request = new NextRequest(
                new URL(`/api/animals/${animalId}/pasture`, origin),
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Origin: origin,
                    },
                    body: JSON.stringify(body),
                },
            );

            const response = await updateAnimalPastureRoute(request, {
                params: Promise.resolve({
                    id: animalId,
                }),
            });

            expect(response.status).toBe(400);

            expect(await response.json()).toMatchObject({
                error: "Datos de asignacion invalidos.",
            });

            const after = await db.animal.findUniqueOrThrow({
                where: {
                    id: animalId,
                },
            });

            expect(after.currentPastureId).toBe(pastureId);
            expect(after.isActive).toBe(before.isActive);
            expect(after.updatedById).toBe(before.updatedById);
            expect(after.updatedAt).toEqual(before.updatedAt);

            const afterLogCount = await db.animalChangeLog.count({
                where: {
                    animalId,
                },
            });

            expect(afterLogCount).toBe(beforeLogCount);
        },
    );
});