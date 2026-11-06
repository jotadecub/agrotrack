export type UserRole = "ADMIN" | "SUPERVISOR" | "READER";

export class ForbiddenError extends Error {
  constructor() {
    super("No tienes permiso para realizar esta operación.");

    this.name = "ForbiddenError";
  }
}

export function canManageUsers(role: UserRole): boolean {
  return role === "ADMIN";
}

export function canManageOperationalData(role: UserRole): boolean {
  return role === "ADMIN" || role === "SUPERVISOR";
}

export function canReadData(role: UserRole): boolean {
  return (
    role === "ADMIN" ||
    role === "SUPERVISOR" ||
    role === "READER"
  );
}

export function assertCanManageUsers(
  role: UserRole,
): void {
  if (!canManageUsers(role)) {
    throw new ForbiddenError();
  }
}

export function assertCanManageOperationalData(
  role: UserRole,
): void {
  if (!canManageOperationalData(role)) {
    throw new ForbiddenError();
  }
}

export function assertCanReadData(role: UserRole): void {
  if (!canReadData(role)) {
    throw new ForbiddenError();
  }
}