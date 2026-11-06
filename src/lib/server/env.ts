export class MissingEnvironmentVariableError extends Error {
  constructor(name: string, description: string) {
    super(`Falta la variable de entorno ${name}: ${description}.`);

    this.name = "MissingEnvironmentVariableError";
  }
}

export function getRequiredEnv(
  name: string,
  description: string,
): string {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    throw new MissingEnvironmentVariableError(name, description);
  }

  return value;
}