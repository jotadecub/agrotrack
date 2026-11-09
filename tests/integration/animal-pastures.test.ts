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
});