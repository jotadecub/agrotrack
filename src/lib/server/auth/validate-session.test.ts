import { errors } from "jose";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  verifySessionToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("../db", () => ({
  db: {
    session: {
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("./token", () => ({
  verifySessionToken: mocks.verifySessionToken,
}));

import { validateAccessToken } from "./validate-session";

describe("validateAccessToken", () => {
  const now = new Date("2026-11-06T04:00:00.000Z");
  const userId = "a66c685e-45dc-4f14-bbe5-3b6e2b52f155";
  const sessionId = "f0c84166-b377-4bce-b498-d3980f03fbef";

  function makeSession() {
    return {
      id: sessionId,
      userId,
      revokedAt: null as Date | null,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      lastActivityAt: new Date(now.getTime() - 60_000),
      user: {
        id: userId,
        fullName: "Administrador Demo",
        role: "ADMIN",
        status: "ACTIVE",
        mustChangePassword: true,
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);

    mocks.verifySessionToken.mockResolvedValue({
      userId,
      sessionId,
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
    });

    mocks.findUnique.mockResolvedValue(makeSession());
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve el usuario actual sin registrar actividad por defecto", async () => {
    const result = await validateAccessToken("test-token");

    expect(result).toEqual({
      sessionId,
      user: {
        id: userId,
        fullName: "Administrador Demo",
        role: "ADMIN",
        mustChangePassword: true,
      },
    });

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("rechaza una sesion inexistente", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      validateAccessToken("test-token"),
    ).resolves.toBeNull();
  });

  it("rechaza un JWT invalido sin consultar PostgreSQL", async () => {
    mocks.verifySessionToken.mockRejectedValue(
      new errors.JWTInvalid("Token inválido"),
    );

    await expect(
      validateAccessToken("test-token"),
    ).resolves.toBeNull();

    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it("propaga fallos de base de datos", async () => {
    const failure = new Error("database-unavailable");
    mocks.findUnique.mockRejectedValue(failure);

    await expect(
      validateAccessToken("test-token"),
    ).rejects.toBe(failure);
  });

  it.each([
    "revocada",
    "vencida",
    "inactiva",
    "otro usuario",
    "usuario desactivado",
    "actividad futura",
  ])("rechaza una sesion: %s", async (scenario) => {
    const session = makeSession();

    switch (scenario) {
      case "revocada":
        session.revokedAt = new Date(now.getTime() - 1_000);
        break;
      case "vencida":
        session.expiresAt = new Date(now);
        break;
      case "inactiva":
        session.lastActivityAt = new Date(
          now.getTime() - 30 * 60 * 1000,
        );
        break;
      case "otro usuario":
        session.userId = "another-user";
        break;
      case "usuario desactivado":
        session.user.status = "INACTIVE";
        break;
      case "actividad futura":
        session.lastActivityAt = new Date(now.getTime() + 1_000);
        break;
    }

    mocks.findUnique.mockResolvedValue(session);

    await expect(
      validateAccessToken("test-token"),
    ).resolves.toBeNull();

    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("registra actividad cuando el servidor lo solicita", async () => {
    const result = await validateAccessToken("test-token", {
      recordActivity: true,
    });

    expect(result?.sessionId).toBe(sessionId);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
        lastActivityAt: {
          gt: new Date(now.getTime() - 30 * 60 * 1000),
          lte: now,
        },
        user: {
          is: {
            status: "ACTIVE",
          },
        },
      },
      data: {
        lastActivityAt: now,
      },
    });
  });

  it("rechaza si la actualizacion condicionada no modifica la sesion", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      validateAccessToken("test-token", {
        recordActivity: true,
      }),
    ).resolves.toBeNull();
  });
});