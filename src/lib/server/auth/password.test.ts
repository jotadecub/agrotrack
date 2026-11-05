import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  const password = "Una frase ficticia para pruebas 2026";

  it("genera un hash Argon2id con los parametros definidos", async () => {
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    expect(passwordHash).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/,
    );
  });

  it("acepta la contraseña correcta", async () => {
    const passwordHash = await hashPassword(password);

    await expect(
      verifyPassword(password, passwordHash),
    ).resolves.toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const passwordHash = await hashPassword(password);

    await expect(
      verifyPassword("Otra frase ficticia diferente", passwordHash),
    ).resolves.toBe(false);
  });

  it("genera hashes distintos para la misma contraseña", async () => {
    const firstHash = await hashPassword(password);
    const secondHash = await hashPassword(password);

    expect(firstHash).not.toBe(secondHash);

    await expect(verifyPassword(password, firstHash)).resolves.toBe(true);
    await expect(verifyPassword(password, secondHash)).resolves.toBe(true);
  });

  it("conserva espacios y caracteres Unicode", async () => {
    const exactPassword = "  Contraseña con ñ y 🌿  ";
    const passwordHash = await hashPassword(exactPassword);

    await expect(
      verifyPassword(exactPassword, passwordHash),
    ).resolves.toBe(true);

    await expect(
      verifyPassword(exactPassword.trim(), passwordHash),
    ).resolves.toBe(false);
  });

  it("propaga un error cuando el hash almacenado es invalido", async () => {
    await expect(
      verifyPassword(password, "hash-invalido"),
    ).rejects.toThrow();
  });
});