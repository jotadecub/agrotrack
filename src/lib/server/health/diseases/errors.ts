export class DiseaseValidationError extends Error {
  readonly details: Record<string, string[]>;

  constructor(details: Record<string, string[]>) {
    super("Datos de enfermedad inválidos.");
    this.name = "DiseaseValidationError";
    this.details = details;
  }
}

export class DiseaseConflictError extends Error {
  constructor() {
    super("Ya existe una enfermedad con ese nombre.");
    this.name = "DiseaseConflictError";
  }
}

export class DiseaseNotFoundError extends Error {
  constructor() {
    super("La enfermedad no existe.");
    this.name = "DiseaseNotFoundError";
  }
}