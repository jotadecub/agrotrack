import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "agrotrack";
const JWT_AUDIENCE = "agrotrack-web";

const identifiersSchema = z.object({
  userId: z.uuid(),
  sessionId: z.uuid(),
});

const claimsSchema = z.object({
  sub: z.uuid(),
  jti: z.uuid(),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

type TokenInput = {
  userId: string;
  sessionId: string;
  expiresAt: Date;
};

export type VerifiedSessionToken = {
  userId: string;
  sessionId: string;
  expiresAt: Date;
};

function getSigningKey(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;

  if (!secret || !/^[a-fA-F0-9]{64}$/.test(secret)) {
    throw new Error(
      "AUTH_JWT_SECRET debe contener exactamente 64 caracteres hexadecimales.",
    );
  }

  return Buffer.from(secret, "hex");
}

export async function signSessionToken({
  userId,
  sessionId,
  expiresAt,
}: TokenInput): Promise<string> {
  identifiersSchema.parse({ userId, sessionId });

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiration = Math.floor(expiresAt.getTime() / 1000);

  if (!Number.isFinite(expiration) || expiration <= issuedAt) {
    throw new Error("El vencimiento del token debe estar en el futuro.");
  }

  return new SignJWT({})
    .setProtectedHeader({
      alg: JWT_ALGORITHM,
      typ: "JWT",
    })
    .setSubject(userId)
    .setJti(sessionId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiration)
    .sign(getSigningKey());
}

export async function verifySessionToken(
  token: string,
): Promise<VerifiedSessionToken> {
  const { payload } = await jwtVerify(token, getSigningKey(), {
    algorithms: [JWT_ALGORITHM],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    typ: "JWT",
    requiredClaims: ["sub", "jti", "iat", "exp"],
  });

  const claims = claimsSchema.parse(payload);
  const now = Math.floor(Date.now() / 1000);

  if (claims.exp <= claims.iat || claims.iat > now) {
    throw new Error("Las fechas del token no son válidas.");
  }

  return {
    userId: claims.sub,
    sessionId: claims.jti,
    expiresAt: new Date(claims.exp * 1000),
  };
}