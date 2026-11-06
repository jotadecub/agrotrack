import { randomUUID } from "node:crypto";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import { signSessionToken, verifySessionToken } from "./token";

describe("session token", () => {
  const testSecret = "ab".repeat(32);

  beforeEach(() => {
    vi.stubEnv("AUTH_JWT_SECRET", testSecret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  function createInput() {
    return {
      userId: randomUUID(),
      sessionId: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    };
  }

  it("firma y verifica un token valido", async () => {
    const input = createInput();

    const token = await signSessionToken(input);
    const result = await verifySessionToken(token);

    expect(result.userId).toBe(input.userId);
    expect(result.sessionId).toBe(input.sessionId);
    expect(result.expiresAt.getTime()).toBe(
      Math.floor(input.expiresAt.getTime() / 1000) * 1000,
    );
  });

  it("rechaza un token con la firma alterada", async () => {
    const token = await signSessionToken(createInput());
    const parts = token.split(".");

    const signature = parts[2]!;
    parts[2] =
      (signature[0] === "a" ? "b" : "a") + signature.slice(1);

    await expect(
      verifySessionToken(parts.join(".")),
    ).rejects.toThrow();
  });

  it("rechaza un token firmado con otro secreto", async () => {
    const token = await signSessionToken(createInput());

    vi.stubEnv("AUTH_JWT_SECRET", "cd".repeat(32));

    await expect(verifySessionToken(token)).rejects.toThrow();
  });

  it("rechaza un token vencido", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    const token = await signSessionToken(createInput());

    vi.advanceTimersByTime(61_000);

    await expect(verifySessionToken(token)).rejects.toThrow();
  });

  it("rechaza la firma si falta el secreto", async () => {
    vi.stubEnv("AUTH_JWT_SECRET", "");

    await expect(
      signSessionToken(createInput()),
    ).rejects.toThrow("AUTH_JWT_SECRET");
  });

  it("rechaza un secreto con formato incorrecto", async () => {
    vi.stubEnv("AUTH_JWT_SECRET", "secreto-no-valido");

    await expect(
      signSessionToken(createInput()),
    ).rejects.toThrow("AUTH_JWT_SECRET");
  });

  it("rechaza identificadores que no son UUID", async () => {
    await expect(
      signSessionToken({
        ...createInput(),
        userId: "usuario-no-valido",
      }),
    ).rejects.toThrow();
  });

  it("no firma tokens con vencimiento pasado", async () => {
    await expect(
      signSessionToken({
        ...createInput(),
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ).rejects.toThrow("vencimiento");
  });
});