import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    session: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  };

  return {
    tx,
    transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
    signSessionToken: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("../db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("./token", () => ({
  signSessionToken: mocks.signSessionToken,
}));

import { refreshSession } from "./refresh-session";
import { hashRefreshToken } from "./refresh-token";

describe("refreshSession", () => {
  const now = new Date("2026-11-06T04:00:00.000Z");
  const sessionId = "f0c84166-b377-4bce-b498-d3980f03fbef";
  const userId = "a66c685e-45dc-4f14-bbe5-3b6e2b52f155";
  const refreshToken = "ab".repeat(32);

  function makeSession() {
    return {
      id: sessionId,
      userId,
      revokedAt: null as Date | null,
      expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
      lastActivityAt: new Date(now.getTime() - 60_000),
      user: {
        status: "ACTIVE",
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);

    mocks.tx.session.findUnique.mockResolvedValue(makeSession());
    mocks.tx.session.updateMany.mockResolvedValue({ count: 1 });
    mocks.signSessionToken.mockResolvedValue("new-access-token");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rota la credencial sin modificar actividad ni vencimiento absoluto", async () => {
    const original = makeSession();

    const result = await refreshSession(sessionId, refreshToken);

    expect(result).not.toBeNull();

    if (!result) {
      throw new Error("Se esperaba una renovación válida.");
    }

    expect(result.refreshToken).not.toBe(refreshToken);
    expect(result.expiresAt).toEqual(original.expiresAt);
    expect(result.accessTokenExpiresAt).toEqual(
      new Date(now.getTime() + 15 * 60 * 1000),
    );

    expect(mocks.tx.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: sessionId,
          refreshTokenHash: hashRefreshToken(refreshToken),
        },
      }),
    );

    expect(mocks.tx.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: sessionId,
          refreshTokenHash: hashRefreshToken(refreshToken),
          revokedAt: null,
        }),
        data: {
          refreshTokenHash: hashRefreshToken(result.refreshToken),
        },
      }),
    );

    expect(mocks.signSessionToken).toHaveBeenCalledWith({
      userId,
      sessionId,
      expiresAt: result.accessTokenExpiresAt,
    });
  });

  it("limita el JWT al vencimiento absoluto restante", async () => {
    const session = makeSession();
    session.expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

    mocks.tx.session.findUnique.mockResolvedValue(session);

    const result = await refreshSession(sessionId, refreshToken);

    expect(result?.accessTokenExpiresAt).toEqual(session.expiresAt);
  });

  it("rechaza entradas malformadas sin consultar la base", async () => {
    await expect(
      refreshSession("id-invalido", "credencial-invalida"),
    ).resolves.toBeNull();

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rechaza una sesion o credencial no encontrada", async () => {
    mocks.tx.session.findUnique.mockResolvedValue(null);

    await expect(
      refreshSession(sessionId, refreshToken),
    ).resolves.toBeNull();

    expect(mocks.tx.session.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    "revocada",
    "vencida",
    "inactiva",
    "usuario desactivado",
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
      case "usuario desactivado":
        session.user.status = "INACTIVE";
        break;
    }

    mocks.tx.session.findUnique.mockResolvedValue(session);

    await expect(
      refreshSession(sessionId, refreshToken),
    ).resolves.toBeNull();

    expect(mocks.tx.session.updateMany).not.toHaveBeenCalled();
  });

  it("rechaza si la escritura condicionada pierde el conflicto", async () => {
    mocks.tx.session.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      refreshSession(sessionId, refreshToken),
    ).resolves.toBeNull();

    expect(mocks.signSessionToken).not.toHaveBeenCalled();
  });

  it("propaga un fallo de firma", async () => {
    const failure = new Error("signing-unavailable");
    mocks.signSessionToken.mockRejectedValueOnce(failure);

    await expect(
      refreshSession(sessionId, refreshToken),
    ).rejects.toBe(failure);
  });
});