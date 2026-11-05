import "dotenv/config";

import { db } from "../src/lib/server/db";

async function main() {
  try {
    await db.$queryRaw`SELECT 1`;

    const farmCount = await db.farm.count();

    console.info("Conexión con PostgreSQL: correcta.");
    console.info(`Registros de finca: ${farmCount}.`);

    if (farmCount === 0) {
      console.info(
        "La configuración de la finca todavía no ha sido creada. Es esperado en esta etapa.",
      );
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  const errorName =
    error instanceof Error ? error.name : "Error desconocido";

  console.error(`Falló la comprobación de base de datos: ${errorName}.`);
  console.error(
    "Revisa el servicio PostgreSQL, DATABASE_URL y las migraciones.",
  );

  process.exitCode = 1;
});