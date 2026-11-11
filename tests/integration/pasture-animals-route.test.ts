import { randomUUID } from "node:crypto";

import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const cookieState = vi.hoisted(() => ({
  accessToken: undefined as string | undefined,
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const cookieName =
        process.env.AUTH_COOKIE_NAME ?? "agrotrack_session";

      if (
        name !== cookieName ||
        cookieState.accessToken === undefined
      ) {
        return undefined;
      }

      return {
        name,
        value: cookieState.accessToken,
      };
    },
  }),
}));

import { GET } from "../../src/app/api/pastures/[id]/animals/route";
import { db } from "../../src/lib/server/db";
import { hashPassword } from "../../src/lib/server/auth/password";
import { createSession } from "../../src/lib/server/auth/session-service";
import { createPasture } from "../../src/lib/server/pastures/service";

describe("GET /api/pastures/[id]/animals", () => {
  let databaseVerified = false;
  let userId: string | undefined;
  let pastureId: string | undefined;

  beforeAll(async () => {
    const [connection] = await db.$queryRaw<
      Array<{
        database_name: string;
        user_name: string;
      }>
    >`
      SELECT
        current_database() AS database_name,
        current_user AS user_name
    `;

    if (
      connection?.database_name !== "agrotrack_test" ||
      connection.user_name !== "agrotrack_test"
    ) {
      throw new Error(
        "Pruebas canceladas: la conexión no corresponde a agrotrack_test.",
      );
    }

    databaseVerified = true;
  });

  beforeEach(async () => {
    cookieState.accessToken = undefined;

    if (!databaseVerified) {
      throw new Error("La base de pruebas no fue verificada.");
    }

    const id = randomUUID();

    await db.user.create({
      data: {
        id,
        identification: `TEST-${id}`,
        fullName: "Lector de animales por terreno",
        email: `pasture-animals-${id}@example.com`,
        passwordHash: await hashPassword(
          "contrasenaficticiadeintegracion",
        ),
        role: "READER",
        status: "ACTIVE",
        mustChangePassword: false,
      },
    });

    userId = id;

    const farm = await db.farm.findFirst({
      select: {
        id: true,
      },
    });

    if (!farm) {
      await db.farm.create({
        data: {
          id: 1,
          name: "Finca de prueba",
        },
      });
    }

    const pasture = await createPasture(
      {
        name: `Potrero endpoint-${randomUUID()}`,
        description: null,
        areaHectares: 10,
      },
      id,
    );

    pastureId = pasture.id;
  });

  afterEach(async () => {
    cookieState.accessToken = undefined;

    if (!databaseVerified) {
      return;
    }

    const currentUserId = userId;
    const currentPastureId = pastureId;

    await db.$transaction(async (tx) => {
      if (currentPastureId !== undefined) {
        await tx.pasture.deleteMany({
          where: {
            id: currentPastureId,
          },
        });
      }

      if (currentUserId !== undefined) {
        await tx.session.deleteMany({
          where: {
            userId: currentUserId,
          },
        });

        await tx.user.deleteMany({
          where: {
            id: currentUserId,
          },
        });
      }
    });

    userId = undefined;
    pastureId = undefined;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function requiredUserId(): string {
    if (userId === undefined) {
      throw new Error("No se creó el lector de prueba.");
    }

    return userId;
  }

  function requiredPastureId(): string {
    if (pastureId === undefined) {
      throw new Error("No se creó el terreno de prueba.");
    }

    return pastureId;
  }

  async function authenticateReader(): Promise<void> {
    const session = await createSession(requiredUserId());

    cookieState.accessToken = session.accessToken;
  }

  async function requestPastureAnimals(id: string) {
    const request = new NextRequest(
      `http://localhost/api/pastures/${id}/animals`,
    );

    return GET(request, {
      params: Promise.resolve({ id }),
    });
  }

  it("rechaza una solicitud sin sesión", async () => {
    const response = await requestPastureAnimals(
      requiredPastureId(),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: "No hay una sesión activa.",
    });
  });

  it("rechaza un identificador de terreno inválido", async () => {
    await authenticateReader();

    const response = await requestPastureAnimals(
      "identificador-invalido",
    );

    expect(response.status).toBe(400);
  });

  it("devuelve 404 si el terreno no existe", async () => {
    await authenticateReader();

    const response = await requestPastureAnimals(randomUUID());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "El terreno solicitado no existe.",
    });
  });

  it("permite a un lector consultar un terreno vacío", async () => {
    await authenticateReader();

    const response = await requestPastureAnimals(
      requiredPastureId(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});