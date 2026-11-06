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
import { hashPassword } from "../../src/lib/server/auth/password";
import { verifyPassword } from "../../src/lib/server/auth/password";

describe("login con PostgreSQL real", () => {
  let databaseVerified = false;
  let userId: string | undefined;

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

    await db.user.create({
      data: {
        id,
        identification: `TEST-${id}`,
        fullName: "Usuario de login",
        email: "login@example.com",
        passwordHash: await hashPassword(
          "contrasenaficticiadeintegracion",
        ),
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

  it("verifica una contraseña correcta", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: currentUserId() },
    });

    expect(
      await verifyPassword(
        "contrasenaficticiadeintegracion",
        user.passwordHash,
      ),
    ).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const user = await db.user.findUniqueOrThrow({
      where: { id: currentUserId() },
    });

    expect(
      await verifyPassword(
        "contrasenaIncorrecta",
        user.passwordHash,
      ),
    ).toBe(false);
  });

  function currentUserId(): string {
    if (!userId) {
      throw new Error("No se creó el usuario de prueba.");
    }

    return userId;
  }
});