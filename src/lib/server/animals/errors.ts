export class AnimalValidationError extends Error {
  readonly details: Record<string, string[]>;

  constructor(details: Record<string, string[]>) {
    super("Datos de animal invalidos.");

    this.name = "AnimalValidationError";
    this.details = details;
  }
}

export class AnimalConflictError extends Error {
  constructor(message = "Ya existe un animal con ese codigo.") {
    super(message);

    this.name = "AnimalConflictError";
  }
}

export class AnimalNotFoundError extends Error {
  constructor(message = "El animal solicitado no existe.") {
    super(message);

    this.name = "AnimalNotFoundError";
  }
}