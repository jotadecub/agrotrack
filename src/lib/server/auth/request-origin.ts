import { getRequiredEnv } from "../env";

export class OriginNotAllowedError extends Error {
  constructor() {
    super("Origen no autorizado para esta operación.");

    this.name = "OriginNotAllowedError";
  }
}

export function assertSameOrigin(request: Request): void {
  const allowedOrigins = getRequiredEnv(
    "AUTH_ALLOWED_ORIGINS",
    "Orígenes autorizados",
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origin = request.headers.get("origin");

  if (!origin) {
    throw new OriginNotAllowedError();
  }

  if (!allowedOrigins.includes(origin)) {
    throw new OriginNotAllowedError();
  }
}