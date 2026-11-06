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
import { refreshSession } from "../../src/lib/server/auth/refresh-session";
import {
  createSession,
  revokeAllUserSessions,
  SessionUserUnavailableError,
} from "../../src/lib/server/auth/session-service";
import { validateAccessToken } from "../../src/lib/server/auth/validate-session";
import { verifySessionToken } from "../../src/lib/server/auth/token";

describe("sesiones con PostgreSQL real", () => {
  let databaseVerified = false;
  let userId: string | undefined;
  let passwordHash: string;

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

    passwordHash = await hashPassword(
      "contrasenaficticiadeintegracion",
    );
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
        fullName: "Usuario de integración",
        email: "integration@example.com",
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });

    userId = id;
  });

  afterEach(async () => {
    vi.unstubAllEnvs();

    if (!databaseVerified || !userId) {
      return;
    }

    const id = userId;

    await db.$transaction(async (tx) => {
      await tx.session.deleteMany({
        where: {
          userId: id,
        },
      });

      await tx.user.deleteMany({
        where: {
          id,
        },
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

  it("crea una sesion real y valida su JWT y usuario", async () => {
    const id = currentUserId();
    const created = await createSession(id);

    const token = await verifySessionToken(created.accessToken);
    const authenticated = await validateAccessToken(
      created.accessToken,
    );

    expect(token.userId).toBe(id);
    expect(token.sessionId).toBe(created.sessionId);

    expect(authenticated?.user).toEqual({
      id,
      fullName: "Usuario de integración",
      role: "ADMIN",
      mustChangePassword: true,
    });

    const stored = await db.session.findUniqueOrThrow({
      where: {
        id: created.sessionId,
      },
    });

    expect(stored.refreshTokenHash).not.toBe(created.refreshToken);
    expect(stored.revokedAt).toBeNull();

    expect(
      stored.expiresAt.getTime() - stored.createdAt.getTime(),
    ).toBe(8 * 60 * 60 * 1000);
  });

  it("bloquea un usuario desactivado y no crea nuevas sesiones", async () => {
    const id = currentUserId();
    const created = await createSession(id);

    await db.user.update({
      where: { id },
      data: { status: "INACTIVE" },
    });

    await expect(
      validateAccessToken(created.accessToken),
    ).resolves.toBeNull();

    await expect(createSession(id)).rejects.toBeInstanceOf(
      SessionUserUnavailableError,
    );

    expect(
      await db.session.count({
        where: { userId: id },
      }),
    ).toBe(1);
  });

  it("revoca todas las sesiones de un usuario", async () => {
    const id = currentUserId();
    const first = await createSession(id);
    const second = await createSession(id);

    await revokeAllUserSessions(id);

    await expect(
      validateAccessToken(first.accessToken),
    ).resolves.toBeNull();

    await expect(
      validateAccessToken(second.accessToken),
    ).resolves.toBeNull();

    expect(
      await db.session.count({
        where: {
          userId: id,
          revokedAt: null,
        },
      }),
    ).toBe(0);
  });

  it("rechaza una sesion por inactividad sin reactivarla", async () => {
    const created = await createSession(currentUserId());
    const now = Date.now();

    await db.session.update({
      where: { id: created.sessionId },
      data: {
        createdAt: new Date(now - 40 * 60 * 1000),
        lastActivityAt: new Date(now - 31 * 60 * 1000),
      },
    });

    await expect(
      validateAccessToken(created.accessToken, {
        recordActivity: true,
      }),
    ).resolves.toBeNull();

    await expect(
      refreshSession(created.sessionId, created.refreshToken),
    ).resolves.toBeNull();
  });

  it("rechaza una sesion cuyo vencimiento absoluto ya paso", async () => {
    const created = await createSession(currentUserId());
    const now = Date.now();

    await db.session.update({
      where: { id: created.sessionId },
      data: {
        createdAt: new Date(now - 3 * 60 * 1000),
        lastActivityAt: new Date(now - 2 * 60 * 1000),
        expiresAt: new Date(now - 60 * 1000),
      },
    });

    await expect(
      validateAccessToken(created.accessToken),
    ).resolves.toBeNull();

    await expect(
      refreshSession(created.sessionId, created.refreshToken),
    ).resolves.toBeNull();
  });

  it("rota la credencial sin ampliar la sesion ni registrar actividad", async () => {
    const created = await createSession(currentUserId());

    const before = await db.session.findUniqueOrThrow({
      where: { id: created.sessionId },
    });

    const renewed = await refreshSession(
      created.sessionId,
      created.refreshToken,
    );

    expect(renewed).not.toBeNull();

    if (!renewed) {
      throw new Error("Se esperaba una renovación válida.");
    }

    expect(renewed.refreshToken).not.toBe(created.refreshToken);

    const after = await db.session.findUniqueOrThrow({
      where: { id: created.sessionId },
    });

    expect(after.expiresAt).toEqual(before.expiresAt);
    expect(after.lastActivityAt).toEqual(before.lastActivityAt);
    expect(after.refreshTokenHash).not.toBe(before.refreshTokenHash);

    await expect(
      refreshSession(created.sessionId, created.refreshToken),
    ).resolves.toBeNull();

    await expect(
      validateAccessToken(renewed.accessToken),
    ).resolves.not.toBeNull();
  });

  it("permite una sola renovacion con la misma credencial", async () => {
    const created = await createSession(currentUserId());

    const results = await Promise.all([
      refreshSession(created.sessionId, created.refreshToken),
      refreshSession(created.sessionId, created.refreshToken),
    ]);

    const successful = results.filter((result) => result !== null);

    expect(successful).toHaveLength(1);

    const winner = successful[0];

    if (!winner) {
      throw new Error("Falta el resultado de la renovación.");
    }

    const next = await refreshSession(
      winner.sessionId,
      winner.refreshToken,
    );

    expect(next).not.toBeNull();
  });

  it("revierte la creacion si falla la firma del JWT", async () => {
    const id = currentUserId();

    vi.stubEnv("AUTH_JWT_SECRET", "");

    await expect(createSession(id)).rejects.toThrow(
      "AUTH_JWT_SECRET",
    );

    expect(
      await db.session.count({
        where: { userId: id },
      }),
    ).toBe(0);
  });

  it("revierte la rotacion si falla la firma del nuevo JWT", async () => {
    const created = await createSession(currentUserId());

    const before = await db.session.findUniqueOrThrow({
      where: { id: created.sessionId },
    });

    vi.stubEnv("AUTH_JWT_SECRET", "");

    await expect(
      refreshSession(created.sessionId, created.refreshToken),
    ).rejects.toThrow("AUTH_JWT_SECRET");

    const after = await db.session.findUniqueOrThrow({
      where: { id: created.sessionId },
    });

    expect(after.refreshTokenHash).toBe(before.refreshTokenHash);
    expect(after.lastActivityAt).toEqual(before.lastActivityAt);
    expect(after.expiresAt).toEqual(before.expiresAt);
  });
});