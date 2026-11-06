import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  generateRefreshToken,
  hashRefreshToken,
} from "./refresh-token";

describe("refresh token", () => {
  it("genera una credencial hexadecimal de 32 bytes", () => {
    expect(generateRefreshToken()).toMatch(/^[a-f0-9]{64}$/);
  });

  it("genera credenciales distintas", () => {
    expect(generateRefreshToken()).not.toBe(generateRefreshToken());
  });

  it("genera un hash hexadecimal de 64 caracteres", () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("genera el mismo hash para la misma credencial", () => {
    const token = generateRefreshToken();

    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
  });

  it("genera hashes distintos para credenciales diferentes", () => {
    expect(hashRefreshToken("ab".repeat(32))).not.toBe(
      hashRefreshToken("cd".repeat(32)),
    );
  });

  it("rechaza una credencial con formato incorrecto", () => {
    expect(() => hashRefreshToken("credencial-invalida")).toThrow(
      "Formato de credencial",
    );
  });
});