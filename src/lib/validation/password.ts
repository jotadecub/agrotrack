export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export type PasswordValidationResult =
  | { valid: true }
  | {
      valid: false;
      code: "WHITESPACE" | "TOO_SHORT" | "TOO_LONG";
      message: string;
    };

export function validateNewPassword(
  password: string,
): PasswordValidationResult {
  if (/\s/u.test(password)) {
    return {
      valid: false,
      code: "WHITESPACE",
      message:
        "La contraseña no puede contener espacios, tabulaciones ni saltos de línea.",
    };
  }

  const length = Array.from(password).length;

  if (length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      code: "TOO_SHORT",
      message: `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    };
  }

  if (length > PASSWORD_MAX_LENGTH) {
    return {
      valid: false,
      code: "TOO_LONG",
      message: `La contraseña no puede superar los ${PASSWORD_MAX_LENGTH} caracteres.`,
    };
  }

  return { valid: true };
}