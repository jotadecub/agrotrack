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
  createAnimal,
  listAnimals,
  updateAnimal,
} from "../../src/lib/server/animals/service";

describe("animales", () => {
  let databaseVerified = false;
  let adminId: string | undefined;
  let readerId: string | undefined;
  let speciesId: number | undefined;

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
          fullName: "Administrador de prueba",
          email: "admin-animals@example.com",
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
          fullName: "Lector de prueba",
          email: "reader-animals@example.com",
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

    const species = await db.species.create({
      data: {
        name: `Bovino-${randomUUID()}`,
      },
    });

    speciesId = species.id;

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
      await tx.animal.deleteMany({
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

      await tx.breed.deleteMany({
        where: {
          speciesId,
        },
      });

      if (speciesId) {
        await tx.species.deleteMany({
          where: {
            id: speciesId,
          },
        });
      }

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
    speciesId = undefined;
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

  function requiredSpeciesId(): number {
    if (!speciesId) {
      throw new Error("No se creó la especie de prueba.");
    }

    return speciesId;
  }

  it("crea un animal con datos validos", async () => {
    const animal = await createAnimal(
      {
        code: `VACA-${randomUUID()}`,
        name: "Vaca de prueba",
        speciesId: requiredSpeciesId(),
        breedId: null,
        sex: "FEMALE",
        birthDate: null,
        weightKg: 420.5,
        motherId: null,
        fatherId: null,
        status: "ALIVE",
      },
      requiredAdminId(),
    );

    expect(animal.code).toMatch(/^VACA-/);
    expect(animal.name).toBe("Vaca de prueba");
    expect(animal.sex).toBe("FEMALE");
    expect(animal.status).toBe("ALIVE");
    expect(animal.isActive).toBe(true);
    expect(animal.weightKg).toBe("420.5");
  });

  it("rechaza un codigo duplicado", async () => {
    const code = `UNICO-${randomUUID()}`;

    await createAnimal(
      {
        code,
        name: null,
        speciesId: requiredSpeciesId(),
        breedId: null,
        sex: "MALE",
        birthDate: null,
        weightKg: null,
        motherId: null,
        fatherId: null,
        status: "ALIVE",
      },
      requiredAdminId(),
    );

    await expect(
      createAnimal(
        {
          code,
          name: null,
          speciesId: requiredSpeciesId(),
          breedId: null,
          sex: "MALE",
          birthDate: null,
          weightKg: null,
          motherId: null,
          fatherId: null,
          status: "ALIVE",
        },
        requiredAdminId(),
      ),
    ).rejects.toMatchObject({
      name: "AnimalConflictError",
    });
  });

  it("lista animales activos con paginacion", async () => {
    const speciesIdValue = requiredSpeciesId();

    await createAnimal(
      {
        code: `LISTA-${randomUUID()}`,
        name: "Animal uno",
        speciesId: speciesIdValue,
        breedId: null,
        sex: "FEMALE",
        birthDate: null,
        weightKg: null,
        motherId: null,
        fatherId: null,
        status: "ALIVE",
      },
      requiredAdminId(),
    );

    const result = await listAnimals({
      page: 1,
      pageSize: 20,
      search: undefined,
      speciesId: undefined,
      status: undefined,
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
  });

    it("actualiza el nombre y estado de un animal", async () => {
    const created = await createAnimal(
      {
        code: `ACTUALIZAR-${randomUUID()}`,
        name: "Nombre inicial",
        speciesId: requiredSpeciesId(),
        breedId: null,
        sex: "FEMALE",
        birthDate: null,
        weightKg: null,
        motherId: null,
        fatherId: null,
        status: "ALIVE",
      },
      requiredAdminId(),
    );

    const updated = await updateAnimal(
      created.id,
      {
        name: "Nombre actualizado",
        status: "SICK",
      },
      requiredAdminId(),
    );

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Nombre actualizado");
    expect(updated.status).toBe("SICK");
  });

  it("desactiva un animal sin eliminarlo", async () => {
    const created = await createAnimal(
      {
        code: `DESACTIVAR-${randomUUID()}`,
        name: null,
        speciesId: requiredSpeciesId(),
        breedId: null,
        sex: "MALE",
        birthDate: null,
        weightKg: null,
        motherId: null,
        fatherId: null,
        status: "ALIVE",
      },
      requiredAdminId(),
    );

    const updated = await updateAnimal(
      created.id,
      {
        isActive: false,
      },
      requiredAdminId(),
    );

    expect(updated.isActive).toBe(false);

    const listed = await listAnimals({
      page: 1,
      pageSize: 20,
      search: undefined,
      speciesId: undefined,
      status: undefined,
    });

    expect(
      listed.items.some((animal) => animal.id === created.id),
    ).toBe(false);
  });

  it("rechaza una madre que no es hembra", async () => {
    const mother = await createAnimal(
      {
        code: `MADRE-${randomUUID()}`,
        name: null,
        speciesId: requiredSpeciesId(),
        breedId: null,
        sex: "MALE",
        birthDate: null,
        weightKg: null,
        motherId: null,
        fatherId: null,
        status: "ALIVE",
      },
      requiredAdminId(),
    );

    const child = await createAnimal(
      {
        code: `CRIA-${randomUUID()}`,
        name: null,
        speciesId: requiredSpeciesId(),
        breedId: null,
        sex: "FEMALE",
        birthDate: null,
        weightKg: null,
        motherId: null,
        fatherId: null,
        status: "ALIVE",
      },
      requiredAdminId(),
    );

    await expect(
      updateAnimal(
        child.id,
        {
          motherId: mother.id,
        },
        requiredAdminId(),
      ),
    ).rejects.toMatchObject({
      name: "AnimalRelationshipError",
    });
  });
});