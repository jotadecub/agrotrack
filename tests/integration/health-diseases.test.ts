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
});