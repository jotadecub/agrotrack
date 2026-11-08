import { randomUUID } from "node:crypto";

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

vi.mock("server-only", () => ({}));

import { db } from "../../src/lib/server/db";
import { hashPassword } from "../../src/lib/server/auth/password";
import {
  createPasture,
  getPastureById,
  listPastures,
  updatePasture,
} from "../../src/lib/server/pastures/service";

describe("terrenos", () => {
  let databaseVerified = false;
  let adminId: string | undefined;
  let readerId: string | undefined;

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
    if (!databaseVerified) {
      throw new Error("La base de pruebas no fue verificada.");
    }

    const adminUserId = randomUUID();
    const readerUserId = randomUUID();

    await db.user.createMany({
      data: [
        {
          id: adminUserId,
          identification: `ADMIN-${adminUserId}`,
          fullName: "Administrador de terrenos",
          email: "admin-pastures@example.com",
          passwordHash: await hashPassword(
            "contrasenaficticiadeintegracion",
          ),
          role: "ADMIN",
          status: "ACTIVE",
          mustChangePassword: false,
        },
        {
          id: readerUserId,
          identification: `READER-${readerUserId}`,
          fullName: "Lector de terrenos",
          email: "reader-pastures@example.com",
          passwordHash: await hashPassword(
            "contrasenaficticiadeintegracion",
          ),
          role: "READER",
          status: "ACTIVE",
          mustChangePassword: false,
        },
      ],
    });

    adminId = adminUserId;
    readerId = readerUserId;

    const farm = await db.farm.findFirst();

    if (!farm) {
      await db.farm.create({
        data: {
          id: 1,
          name: "Finca de prueba",
        },
      });
    }
  });

  afterEach(async () => {
    if (!databaseVerified || !adminId || !readerId) {
      return;
    }

    const admin = adminId;
    const reader = readerId;

    await db.$transaction(async (tx) => {
      await tx.pasture.deleteMany({
        where: {
          OR: [
            {
              createdById: admin,
            },
            {
              createdById: reader,
            },
          ],
        },
      });

      await tx.session.deleteMany({
        where: {
          userId: {
            in: [admin, reader],
          },
        },
      });

      await tx.user.deleteMany({
        where: {
          id: {
            in: [admin, reader],
          },
        },
      });
    });

    adminId = undefined;
    readerId = undefined;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  function requiredAdminId(): string {
    if (!adminId) {
      throw new Error("No se creó el administrador de prueba.");
    }

    return adminId;
  }

  it("crea un terreno con datos validos", async () => {
    const pasture = await createPasture(
      {
        name: `Potrero-${randomUUID()}`,
        description: "Potrero de prueba",
        areaHectares: 12.5,
      },
      requiredAdminId(),
    );

    expect(pasture.name).toMatch(/^Potrero-/);
    expect(pasture.description).toBe("Potrero de prueba");
    expect(pasture.areaHectares).toBe("12.5");
    expect(pasture.isActive).toBe(true);
  });

  it("rechaza un nombre duplicado en la misma finca", async () => {
    const name = `Potrero unico-${randomUUID()}`;

    await createPasture(
      {
        name,
        description: null,
        areaHectares: null,
      },
      requiredAdminId(),
    );

    await expect(
      createPasture(
        {
          name,
          description: null,
          areaHectares: null,
        },
        requiredAdminId(),
      ),
    ).rejects.toMatchObject({
      name: "PastureConflictError",
    });
  });

  it("lista terrenos con paginacion", async () => {
    await createPasture(
      {
        name: `Potrero lista-${randomUUID()}`,
        description: null,
        areaHectares: 5,
      },
      requiredAdminId(),
    );

    const result = await listPastures({
      page: 1,
      pageSize: 20,
      search: undefined,
      isActive: undefined,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("obtiene un terreno por id", async () => {
    const created = await createPasture(
      {
        name: `Potrero detalle-${randomUUID()}`,
        description: "Detalle",
        areaHectares: 8,
      },
      requiredAdminId(),
    );

    const pasture = await getPastureById(created.id);

    expect(pasture.id).toBe(created.id);
    expect(pasture.description).toBe("Detalle");
  });

  it("rechaza un terreno inexistente", async () => {
    await expect(
      getPastureById(randomUUID()),
    ).rejects.toMatchObject({
      name: "PastureNotFoundError",
    });
  });

  it("actualiza el nombre y desactiva un terreno", async () => {
    const created = await createPasture(
      {
        name: `Potrero actualizar-${randomUUID()}`,
        description: null,
        areaHectares: null,
      },
      requiredAdminId(),
    );

    const updated = await updatePasture(
      created.id,
      {
        name: `Potrero actualizado-${randomUUID()}`,
        isActive: false,
      },
      requiredAdminId(),
    );

    expect(updated.isActive).toBe(false);
    expect(updated.name).toMatch(/^Potrero actualizado-/);
  });
});