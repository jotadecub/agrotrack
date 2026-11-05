import { describe, expect, it } from "vitest";

import { validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("acepta una contraseña de 15 caracteres", () => {
    expect(validateNewPassword("a".repeat(15))).toEqual({
      valid: true,
    });
  });

  it("acepta una contraseña de 128 caracteres", () => {
    expect(validateNewPassword("a".repeat(128))).toEqual({
      valid: true,
    });
  });

  it("rechaza una contraseña de menos de 15 caracteres", () => {
    expect(validateNewPassword("a".repeat(14))).toMatchObject({
      valid: false,
      code: "TOO_SHORT",
    });
  });

  it("rechaza una contraseña de mas de 128 caracteres", () => {
    expect(validateNewPassword("a".repeat(129))).toMatchObject({
      valid: false,
      code: "TOO_LONG",
    });
  });

  it("rechaza una contraseña vacia", () => {
    expect(validateNewPassword("")).toMatchObject({
      valid: false,
      code: "TOO_SHORT",
    });
  });

  it("no exige mayusculas, numeros ni simbolos", () => {
    expect(validateNewPassword("unacontrasenalarga")).toEqual({
      valid: true,
    });
  });

  it("permite letras Unicode", () => {
    expect(validateNewPassword("ñ".repeat(15))).toEqual({
      valid: true,
    });
  });

  it("cuenta caracteres Unicode fuera del plano basico", () => {
    expect(
      validateNewPassword(String.fromCodePoint(0x10400).repeat(14)),
    ).toMatchObject({
      valid: false,
      code: "TOO_SHORT",
    });
  });

  it.each([
    ["espacio inicial", ` ${"a".repeat(15)}`],
    ["espacio final", `${"a".repeat(15)} `],
    ["espacio intermedio", `${"a".repeat(8)} ${"b".repeat(8)}`],
    ["tabulacion", `${"a".repeat(15)}\t`],
    ["salto de linea", `${"a".repeat(15)}\n`],
    ["espacio no separable", `${"a".repeat(15)}\u00A0`],
  ])("rechaza %s sin modificar la entrada", (_name, password) => {
    expect(validateNewPassword(password)).toMatchObject({
      valid: false,
      code: "WHITESPACE",
    });
  });
});