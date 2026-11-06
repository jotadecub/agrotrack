import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { parse } from "dotenv";

export function loadTestDatabaseUrl(): string {
  const filePath = resolve(process.cwd(), ".env.test");
  const variables = parse(readFileSync(filePath));
  const connectionString = variables.TEST_DATABASE_URL;

  if (!connectionString) {
    throw new Error("Falta TEST_DATABASE_URL en .env.test.");
  }

  let url: URL;

  try {
    url = new URL(connectionString);
  } catch {
    throw new Error("TEST_DATABASE_URL no tiene un formato válido.");
  }

  const allowedProtocols = ["postgresql:", "postgres:"];
  const allowedHosts = ["localhost", "127.0.0.1"];

  if (
    !allowedProtocols.includes(url.protocol) ||
    !allowedHosts.includes(url.hostname) ||
    url.port !== "5432" ||
    url.pathname !== "/agrotrack_test" ||
    url.username !== "agrotrack_test" ||
    url.searchParams.get("schema") !== "public"
  ) {
    throw new Error(
      "Destino rechazado: las pruebas locales requieren agrotrack_test, usuario agrotrack_test, esquema public y localhost:5432.",
    );
  }

  return connectionString;
}