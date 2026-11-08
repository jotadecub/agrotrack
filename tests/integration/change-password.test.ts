import { randomUUID } from "node:crypto";

import {
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
import { hashPassword, verifyPassword } from "../../src/lib/server/auth/password";
import {
    changePassword,
    InvalidCurrentPasswordError,
    PasswordChangeNotAllowedError,
} from "../../src/lib/server/auth/change-password";

describe("cambio obligatorio de contrasena", () => {
    let databaseVerified = false;
    let userId: string | undefined;
    let currentPasswordHash: string;

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

        const id = randomUUID();
        currentPasswordHash = await hashPassword(
            "contrasenaficticiadeintegracion",
        );

        await db.user.create({
            data: {
                id,
                identification: `TEST-${id}`,
                fullName: "Usuario de cambio",
                email: "change@example.com",
                passwordHash: currentPasswordHash,
                role: "ADMIN",
                status: "ACTIVE",
                mustChangePassword: true,
            },
        });

        userId = id;
    });

    afterEach(async () => {
        if (!databaseVerified || !userId) {
            return;
        }

        const id = userId;

        await db.$transaction(async (tx) => {
            await tx.session.deleteMany({
                where: { userId: id },
            });

            await tx.user.deleteMany({
                where: { id },
            });
        });

        userId = undefined;
    });

    function currentUserId(): string {
        if (!userId) {
            throw new Error("No se creó el usuario de prueba.");
        }

        return userId;
    }

    it("cambia la contrasena y crea una nueva sesion", async () => {
        const id = currentUserId();

        const result = await changePassword({
            userId: id,
            currentPassword: "contrasenaficticiadeintegracion",
            newPassword: "NuevaContrasenaSegura2026",
        });

        const user = await db.user.findUniqueOrThrow({
            where: { id },
        });

        expect(user.mustChangePassword).toBe(false);
        expect(user.passwordChangedAt).not.toBeNull();
        expect(
            await verifyPassword(
                "NuevaContrasenaSegura2026",
                user.passwordHash,
            ),
        ).toBe(true);

        expect(result.accessToken).toBeTruthy();
        expect(result.refreshToken).toBeTruthy();

        const activeSessions = await db.session.count({
            where: {
                userId: id,
                revokedAt: null,
            },
        });

        expect(activeSessions).toBe(1);
    });

    it("rechaza la contrasena actual incorrecta", async () => {
        await expect(
            changePassword({
                userId: currentUserId(),
                currentPassword: "ContrasenaIncorrecta2026",
                newPassword: "NuevaContrasenaSegura2026",
            }),
        ).rejects.toBeInstanceOf(InvalidCurrentPasswordError);
    });

    it("rechaza un usuario sin cambio pendiente", async () => {
        const id = currentUserId();

        await db.user.update({
            where: { id },
            data: {
                mustChangePassword: false,
            },
        });

        await expect(
            changePassword({
                userId: id,
                currentPassword: "contrasenaficticiadeintegracion",
                newPassword: "NuevaContrasenaSegura2026",
            }),
        ).rejects.toBeInstanceOf(PasswordChangeNotAllowedError);
    });

    it("rechaza una nueva contrasena invalida", async () => {
        await expect(
            changePassword({
                userId: currentUserId(),
                currentPassword: "contrasenaficticiadeintegracion",
                newPassword: "corta",
            }),
        ).rejects.toThrow(
            "La contraseña debe tener al menos 15 caracteres.",
        );
    });
});