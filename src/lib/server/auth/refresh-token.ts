import "server-only";

import { createHash, randomBytes } from "node:crypto";

const REFRESH_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashRefreshToken(token: string): string {
  if (!REFRESH_TOKEN_PATTERN.test(token)) {
    throw new Error("Formato de credencial de renovación inválido.");
  }

  return createHash("sha256").update(token, "utf8").digest("hex");
}