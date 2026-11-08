export class PastureValidationError extends Error {
  readonly details: Record<string, string[]>;

  constructor(details: Record<string, string[]>) {
    super("Datos de terreno invalidos.");

    this.name = "PastureValidationError";
    this.details = details;
  }
}

export class PastureConflictError extends Error {
  constructor(message = "Ya existe un terreno con ese nombre.") {
    super(message);

    this.name = "PastureConflictError";
  }
}

export class PastureNotFoundError extends Error {
  constructor(message = "El terreno solicitado no existe.") {
    super(message);

    this.name = "PastureNotFoundError";
  }
}