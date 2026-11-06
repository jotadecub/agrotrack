import { hashPassword, verifyPassword } from "./password";
import { createSession } from "./session-service";
import { validateNewPassword } from "../../validation/password";
import { db } from "../db";

export class InvalidCurrentPasswordError extends Error {
  constructor() {
    super("La contraseña actual es incorrecta.");

    this.name = "InvalidCurrentPasswordError";
  }
}

export class PasswordChangeNotAllowedError extends Error {
  constructor() {
    super("Este usuario no tiene un cambio de contraseña pendiente.");

    this.name = "PasswordChangeNotAllowedError";
  }
}

export class UserUnavailableError extends Error {
  constructor() {
    super("El usuario no está disponible para cambiar su contraseña.");

    this.name = "UserUnavailableError";
  }
}

type ChangePasswordInput = {
  userId: string;
  currentPassword: string;
  newPassword: string;
};

export async function changePassword({
  userId,
  currentPassword,
  newPassword,
}: ChangePasswordInput) {
  const passwordValidation = validateNewPassword(newPassword);

    if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
    }

  const user = await db.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      passwordHash: true,
      status: true,
      mustChangePassword: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    throw new UserUnavailableError();
  }

  if (!user.mustChangePassword) {
    throw new PasswordChangeNotAllowedError();
  }

  const currentPasswordIsValid = await verifyPassword(
    currentPassword,
    user.passwordHash,
  );

  if (!currentPasswordIsValid) {
    throw new InvalidCurrentPasswordError();
  }

  const newPasswordHash = await hashPassword(newPassword);
  const changedAt = new Date();

  await db.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: userId,
        status: "ACTIVE",
        mustChangePassword: true,
      },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        passwordChangedAt: changedAt,
      },
    });

    if (updated.count !== 1) {
      throw new Error(
        "No se pudo confirmar el cambio de contraseña.",
      );
    }

    await tx.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: changedAt,
      },
    });
  });

  return createSession(userId);
}