import { describe, expect, it } from "vitest";

import {
  assertCanManageOperationalData,
  assertCanManageUsers,
  assertCanReadData,
  canManageOperationalData,
  canManageUsers,
  canReadData,
  ForbiddenError,
} from "./authorization";

describe("autorizacion por rol", () => {
  it("permite gestionar usuarios solo al administrador", () => {
    expect(canManageUsers("ADMIN")).toBe(true);
    expect(canManageUsers("SUPERVISOR")).toBe(false);
    expect(canManageUsers("READER")).toBe(false);

    expect(() =>
      assertCanManageUsers("SUPERVISOR"),
    ).toThrow(ForbiddenError);

    expect(() =>
      assertCanManageUsers("READER"),
    ).toThrow(ForbiddenError);
  });

  it("permite operaciones operativas a administrador y supervisor", () => {
    expect(canManageOperationalData("ADMIN")).toBe(true);
    expect(canManageOperationalData("SUPERVISOR")).toBe(true);
    expect(canManageOperationalData("READER")).toBe(false);

    expect(() =>
      assertCanManageOperationalData("READER"),
    ).toThrow(ForbiddenError);
  });

  it("permite consulta a los tres roles", () => {
    expect(canReadData("ADMIN")).toBe(true);
    expect(canReadData("SUPERVISOR")).toBe(true);
    expect(canReadData("READER")).toBe(true);

    expect(() =>
      assertCanReadData("ADMIN"),
    ).not.toThrow();

    expect(() =>
      assertCanReadData("SUPERVISOR"),
    ).not.toThrow();

    expect(() =>
      assertCanReadData("READER"),
    ).not.toThrow();
  });
});