import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "../../../generated/prisma/client";
import { db } from "../db";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "./refresh-token";
import { SESSION_POLICY } from "./session-policy";
import { signSessionToken } from "./token";

export class SessionUserUnavailableError extends Error {
  constructor() {
    super("No se puede crear una sesión para este usuario.");
    this.name = "SessionUserUnavailableError";
  }
}

export type CreatedSession = {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  expiresAt: Date;
};

export async function createSession(
  userId: string,
): Promise<CreatedSession> {
  const sessionId = randomUUID();
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);

  return db.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!user || user.status !== "ACTIVE") {
        throw new SessionUserUnavailableError();
      }

      const now = new Date();

      const expiresAt = new Date(
        now.getTime() +
          SESSION_POLICY.absoluteLifetimeSeconds * 1000,
      );

      const accessTokenExpiresAt = new Date(
        Math.floor(
          (now.getTime() +
            SESSION_POLICY.accessTokenLifetimeSeconds * 1000) /
            1000,
        ) * 1000,
      );

      await tx.session.create({
        data: {
          id: sessionId,
          userId: user.id,
          refreshTokenHash,
          createdAt: now,
          lastActivityAt: now,
          expiresAt,
        },
        select: {
          id: true,
        },
      });

      const accessToken = await signSessionToken({
        userId: user.id,
        sessionId,
        expiresAt: accessTokenExpiresAt,
      });

      return {
        sessionId,
        accessToken,
        refreshToken,
        accessTokenExpiresAt,
        expiresAt,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  );
}

export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  await db.session.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function revokeAllUserSessions(
  userId: string,
): Promise<void> {
  await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}