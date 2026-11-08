import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchWithSessionRefresh,
  refreshSessionOnce,
} from "./session-refresh";

describe("renovacion coordinada de sesion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("realiza una sola renovacion para peticiones concurrentes", async () => {
    const refreshSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url === "/api/auth/refresh") {
          return new Response(null, {
            status: 200,
          });
        }

        return new Response(null, {
          status: 401,
        });
      });

    const [first, second, third] = await Promise.all([
      fetchWithSessionRefresh("/api/example"),
      fetchWithSessionRefresh("/api/example"),
      fetchWithSessionRefresh("/api/example"),
    ]);

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(401);

    const refreshCalls = refreshSpy.mock.calls.filter(
      ([input]) => String(input) === "/api/auth/refresh",
    );

    expect(refreshCalls).toHaveLength(1);
  });

  it("reutiliza una renovacion en curso", async () => {
    const refreshSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        const url = String(input);

        if (url === "/api/auth/refresh") {
          return new Response(null, {
            status: 200,
          });
        }

        return new Response(null, {
          status: 401,
        });
      });

    const first = refreshSessionOnce();
    const second = refreshSessionOnce();

    const [firstResult, secondResult] = await Promise.all([
      first,
      second,
    ]);

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);

    const refreshCalls = refreshSpy.mock.calls.filter(
      ([input]) => String(input) === "/api/auth/refresh",
    );

    expect(refreshCalls).toHaveLength(1);
  });
});