import "dotenv/config";

import { confirm, input, password } from "@inquirer/prompts";
import { z } from "zod";

import { Prisma } from "../src/generated/prisma/client";
import { db } from "../src/lib/server/db";
import { hashPassword } from "../src/lib/server/auth/password";
import { validateNewPassword } from "../src/lib/validation/password";

const setupSchema = z.object({
  farmName: z.string().trim().min(1).max(150),
  fullName: z.string().trim().min(1).max(150),
  identification: z.string().trim().min(1).max(50),
  email: z.string().trim().max(254).pipe(z.email()),
});

class InstallationNotEmptyError extends Error {
  constructor() {
    super(
      "La instalación ya contiene una finca o usuarios. No se modificó información.",
    );
    this.name = "InstallationNotEmptyError";
  }
}

async function assertEmptyInstallation() {
  const farmCount = await db.farm.count();
  const userCount = await db.user.count();

  if (farmCount !== 0 || userCount !== 0) {
    throw new InstallationNotEmptyError();
  }
}

async function requestRequiredText(
  message: string,
  maxLength: number,
): Promise<string> {
  const value = await input({
    message,
    validate: (answer) => {
      const normalized = answer.trim();

      if (normalized.length === 0) {
        return "Este campo es obligatorio.";
      }

      if (normalized.length > maxLength) {
        return `Utiliza como máximo ${maxLength} caracteres.`;
      }

      return true;
    },
  });

  return value.trim();
}

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("INTERACTIVE_TERMINAL_REQUIRED");
  }

  await assertEmptyInstallation();

  console.info("Inicialización local de AgroTrack.");
  console.info(
    "Para la demostración utiliza nombres, identificación y correo ficticios.",
  );
  console.info("No introduzcas datos reales en una demostración pública.");

  const farmName = await requestRequiredText("Nombre de la finca:", 150);
  const fullName = await requestRequiredText(
    "Nombre completo del Administrador:",
    150,
  );
  const identification = await requestRequiredText(
    "Identificación del Administrador:",
    50,
  );

  const email = await input({
    message: "Correo del Administrador:",
    validate: (answer) => {
      const result = setupSchema.shape.email.safeParse(answer);

      return result.success
        ? true
        : "Introduce un correo válido de hasta 254 caracteres.";
    },
  });

  const data = setupSchema.parse({
    farmName,
    fullName,
    identification,
    email,
  });

  const adminPassword = await password({
    message: "Contraseña temporal del Administrador:",
    mask: "*",
    validate: (answer) => {
      const result = validateNewPassword(answer);

      return result.valid ? true : result.message;
    },
  });

  await password({
    message: "Repite la contraseña:",
    mask: "*",
    validate: (answer) =>
      answer === adminPassword
        ? true
        : "Las contraseñas no coinciden.",
  });

  const approved = await confirm({
    message:
      "¿Crear la finca y el primer Administrador en la base configurada en DATABASE_URL?",
    default: false,
  });

  if (!approved) {
    console.info("Operación cancelada. No se crearon registros.");
    return;
  }

  const passwordValidation = validateNewPassword(adminPassword);

  if (!passwordValidation.valid) {
    throw new Error("INVALID_PASSWORD");
  }

  const passwordHash = await hashPassword(adminPassword);

  await db.$transaction(
    async (tx) => {
      const farmCount = await tx.farm.count();
      const userCount = await tx.user.count();

      if (farmCount !== 0 || userCount !== 0) {
        throw new InstallationNotEmptyError();
      }

      await tx.farm.create({
        data: {
          id: 1,
          name: data.farmName,
        },
        select: {
          id: true,
        },
      });

      await tx.user.create({
        data: {
          identification: data.identification,
          fullName: data.fullName,
          email: data.email,
          passwordHash,
          role: "ADMIN",
          status: "ACTIVE",
          mustChangePassword: true,
        },
        select: {
          id: true,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 10_000,
    },
  );

  console.info("Inicialización completada.");
  console.info("Se crearon una finca y un Administrador activo.");
  console.info("La contraseña deberá cambiarse en el primer acceso.");
  console.info("El inicio de sesión todavía no está implementado.");
}

async function run() {
  try {
    await main();
  } catch (error: unknown) {
    if (error instanceof InstallationNotEmptyError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    if (
      error instanceof Error &&
      (error.name === "ExitPromptError" ||
        error.name === "AbortPromptError")
    ) {
      console.info("Operación cancelada.");
      process.exitCode = 1;
      return;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2034" || error.code === "P2002")
    ) {
      console.error(
        "La inicialización encontró un conflicto. Comprueba el estado de la base antes de repetirla.",
      );
      process.exitCode = 1;
      return;
    }

    console.error(
      "No se pudo completar la inicialización. Revisa la conexión, las migraciones y las dependencias.",
    );

    if (error instanceof Error) {
      console.error(`Tipo de error: ${error.name}`);
    }

    process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void run();