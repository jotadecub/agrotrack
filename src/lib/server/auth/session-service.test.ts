import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    user: {
      findUnique: vi.fn(),
    },
    session: {
      create: vi.fn(),
    },
  };

  return {
    tx,
    transaction: vi.fn(
      async (callback: (transaction: typeof tx) => Promise<unknown>) =>
        callback(tx),
    ),
    updateMany: vi.fn(),
    signSessionToken: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));

vi.mock("../db", () => ({
  db: {
    $transaction: mocks.transaction,
    session: {
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("./token", () => ({
  signSessionToken: mocks.signSessionToken,
}));

import {
  createSession,
  revokeAllUserSessions,
  revokeSession,
  SessionUserUnavailableError,
} from "./session-service";
import { hashRefreshToken } from "./refresh-token";

describe("session service", () => {
  const userId = "a66c685e-45dc-4f14-bbe5-3b6e2b52f155";

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.tx.user.findUnique.mockResolvedValue({
      id: userId,
      status: "ACTIVE",
    });

    mocks.tx.session.create.mockResolvedValue({
      id: "created-session",
    });

    mocks.signSessionToken.mockResolvedValue("test-access-token");
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("crea una sesion y almacena solo el hash de renovacion", async () => {
    const result = await createSession(userId);

    expect(mocks.tx.session.create).toHaveBeenCalledWith({
      data: {
        id: result.sessionId,
        userId,
        refreshTokenHash: hashRefreshToken(result.refreshToken),
        createdAt: expect.any(Date),
        lastActivityAt: expect.any(Date),
        expiresAt: result.expiresAt,
      },
      select: {
        id: true,
      },
    });

    expect(mocks.signSessionToken).toHaveBeenCalledWith({
      userId,
      sessionId: result.sessionId,
      expiresAt: result.accessTokenExpiresAt,
    });

    expect(result.accessToken).toBe("test-access-token");

    expect(
      result.expiresAt.getTime() -
        result.accessTokenExpiresAt.getTime(),
    ).toBeGreaterThan(7 * 60 * 60 * 1000);

    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: "Serializable",
      }),
    );
  });

  it.each([
    ["inexistente", null],
    ["inactivo", { id: userId, status: "INACTIVE" }],
  ])("rechaza un usuario %s", async (_label, user) => {
    mocks.tx.user.findUnique.mockResolvedValue(user);

    await expect(createSession(userId)).rejects.toBeInstanceOf(
      SessionUserUnavailableError,
    );

    expect(mocks.tx.session.create).not.toHaveBeenCalled();
    expect(mocks.signSessionToken).not.toHaveBeenCalled();
  });

  it("revoca solo la sesion del usuario indicado", async () => {
    const sessionId = "f0c84166-b377-4bce-b498-d3980f03fbef";

    await revokeSession(sessionId, userId);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });

  it("revoca todas las sesiones no revocadas de un usuario", async () => {
    await revokeAllUserSessions(userId);

    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
      },
    });
  });
});