import "server-only";

import { errors } from "jose";
import { ZodError } from "zod";

import type { UserRole } from "../../../generated/prisma/enums";
import { db } from "../db";
import { SESSION_POLICY } from "./session-policy";
import { verifySessionToken } from "./token";

export type AuthenticatedSession = {
  sessionId: string;
  user: {
    id: string;
    fullName: string;
    role: UserRole;
    mustChangePassword: boolean;
  };
};

type ValidationOptions = {
  recordActivity?: boolean;
};

export async function validateAccessToken(
  token: string,
  { recordActivity = false }: ValidationOptions = {},
): Promise<AuthenticatedSession | null> {
  let verifiedToken;

  try {
    verifiedToken = await verifySessionToken(token);
  } catch (error: unknown) {
    if (
      error instanceof errors.JOSEError ||
      error instanceof ZodError
    ) {
      return null;
    }

    throw error;
  }

  const session = await db.session.findUnique({
    where: {
      id: verifiedToken.sessionId,
    },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      lastActivityAt: true,
      user: {
        select: {
          id: true,
          fullName: true,
          role: true,
          status: true,
          mustChangePassword: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  const now = new Date();
  const idleCutoff = new Date(
    now.getTime() - SESSION_POLICY.idleTimeoutSeconds * 1000,
  );

  if (
    session.userId !== verifiedToken.userId ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= now.getTime() ||
    session.lastActivityAt.getTime() <= idleCutoff.getTime() ||
    session.lastActivityAt.getTime() > now.getTime() ||
    session.user.status !== "ACTIVE" ||
    verifiedToken.expiresAt.getTime() > session.expiresAt.getTime()
  ) {
    return null;
  }

  if (recordActivity) {
    const result = await db.session.updateMany({
      where: {
        id: session.id,
        userId: verifiedToken.userId,
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
        lastActivityAt: now,
      },
    });

    if (result.count !== 1) {
      return null;
    }
  }

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      fullName: session.user.fullName,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
    },
  };
}