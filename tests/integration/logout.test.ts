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
import { logoutSession } from "../../src/lib/server/auth/logout";
import { validateAccessToken } from "../../src/lib/server/auth/validate-session";

describe("cierre de sesion", () => {
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
        fullName: "Usuario de cierre",
        email: "logout@example.com",
        passwordHash: await hashPassword(
          "contrasenaficticiadeintegracion",
        ),
        role: "ADMIN",
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

  it("revoca solo la sesion indicada", async () => {
    const id = currentUserId();

    const first = await createSession(id);
    const second = await createSession(id);

    await logoutSession(first.sessionId, id);

    await expect(
      validateAccessToken(first.accessToken),
    ).resolves.toBeNull();

    await expect(
      validateAccessToken(second.accessToken),
    ).resolves.not.toBeNull();

    const activeSessions = await db.session.count({
      where: {
        userId: id,
        revokedAt: null,
      },
    });

    expect(activeSessions).toBe(1);
  });

  it("no falla al cerrar una sesion ya revocada", async () => {
    const created = await createSession(currentUserId());

    await logoutSession(created.sessionId, currentUserId());

    await expect(
      logoutSession(created.sessionId, currentUserId()),
    ).resolves.toBeUndefined();
  });
});