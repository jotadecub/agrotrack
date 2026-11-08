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
import { createSession } from "../../src/lib/server/auth/session-service";
import { validateAccessToken } from "../../src/lib/server/auth/validate-session";

describe("sesion actual", () => {
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
        fullName: "Usuario de sesion",
        email: "me@example.com",
        passwordHash: await hashPassword(
          "contrasenaficticiadeintegracion",
        ),
        role: "READER",
        status: "ACTIVE",
        mustChangePassword: false,
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

  afterAll(async () => {
    await db.$disconnect();
  });

  function currentUserId(): string {
    if (!userId) {
      throw new Error("No se creó el usuario de prueba.");
    }

    return userId;
  }

  it("valida una sesion de lector y expone solo datos permitidos", async () => {
    const id = currentUserId();

    const created = await createSession(id);

    const authenticated = await validateAccessToken(
      created.accessToken,
      {
        recordActivity: true,
      },
    );

    expect(authenticated).not.toBeNull();

    if (!authenticated) {
      throw new Error("Se esperaba una sesión válida.");
    }

    expect(authenticated.user).toEqual({
      id,
      fullName: "Usuario de sesion",
      role: "READER",
      mustChangePassword: false,
      passwordChangedAt: null,
    });

    expect(authenticated.user).not.toHaveProperty("passwordHash");
    expect(authenticated.user).not.toHaveProperty("email");
  });
});