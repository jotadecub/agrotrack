import "server-only";

export const SESSION_POLICY = {
  accessTokenLifetimeSeconds: 15 * 60,
  idleTimeoutSeconds: 30 * 60,
  absoluteLifetimeSeconds: 8 * 60 * 60,
} as const;