import "server-only";

import { z } from "zod";

import { Prisma } from "../../../generated/prisma/client";
import { db } from "../db";
import {
  generateRefreshToken,
  hashRefreshToken,
} from "./refresh-token";
import type { CreatedSession } from "./session-service";
import { SESSION_POLICY } from "./session-policy";
import { signSessionToken } from "./token";

const refreshInputSchema = z.object({
  sessionId: z.uuid(),
  refreshToken: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function refreshSession(
  sessionId: string,
  refreshToken: string,
): Promise<CreatedSession | null> {
  const input = refreshInputSchema.safeParse({
    sessionId,
    refreshToken,
  });

  if (!input.success) {
    return null;
  }

  const currentHash = hashRefreshToken(input.data.refreshToken);

  try {
    return await db.$transaction(
      async (tx) => {
        const session = await tx.session.findUnique({
          where: {
            id: input.data.sessionId,
            refreshTokenHash: currentHash,
          },
          select: {
            id: true,
            userId: true,
            revokedAt: true,
            expiresAt: true,
            lastActivityAt: true,
            user: {
              select: {
                status: true,
              },
            },
          },
        });

        if (!session) {
          return null;
        }

        const now = new Date();
        const idleCutoff = new Date(
          now.getTime() -
            SESSION_POLICY.idleTimeoutSeconds * 1000,
        );

        if (
          session.revokedAt !== null ||
          session.expiresAt.getTime() <= now.getTime() ||
          session.lastActivityAt.getTime() <= idleCutoff.getTime() ||
          session.lastActivityAt.getTime() > now.getTime() ||
          session.user.status !== "ACTIVE"
        ) {
          return null;
        }

        const tokenExpirationSeconds = Math.floor(
          Math.min(
            session.expiresAt.getTime(),
            now.getTime() +
              SESSION_POLICY.accessTokenLifetimeSeconds * 1000,
          ) / 1000,
        );

        if (tokenExpirationSeconds <= Math.floor(now.getTime() / 1000)) {
          return null;
        }

        const accessTokenExpiresAt = new Date(
          tokenExpirationSeconds * 1000,
        );

        const nextRefreshToken = generateRefreshToken();
        const nextHash = hashRefreshToken(nextRefreshToken);

        const updated = await tx.session.updateMany({
          where: {
            id: session.id,
            userId: session.userId,
            refreshTokenHash: currentHash,
            revokedAt: null,
            expiresAt: {
              gt: now,
            },
            lastActivityAt: {
              gt: idleCutoff,
              lte: now,
            },
            user: {
              is: {
                status: "ACTIVE",
              },
            },
          },
          data: {
            refreshTokenHash: nextHash,
          },
        });

        if (updated.count !== 1) {
          return null;
        }

        const accessToken = await signSessionToken({
          userId: session.userId,
          sessionId: session.id,
          expiresAt: accessTokenExpiresAt,
        });

        return {
          sessionId: session.id,
          accessToken,
          refreshToken: nextRefreshToken,
          accessTokenExpiresAt,
          expiresAt: session.expiresAt,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 10_000,
      },
    );
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return null;
    }

    throw error;
  }
}