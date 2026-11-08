import { Prisma } from "../../../generated/prisma/client";

import { db } from "../db";
import {
  AnimalConflictError,
  AnimalNotFoundError,
  AnimalValidationError,
  AnimalRelationshipError,
} from "./errors";
import {
  CreateAnimalInput,
  ListAnimalsQuery,
  UpdateAnimalInput,
  UpdateAnimalPastureInput,
} from "./validation";

import {
  PastureNotFoundError,
} from "../pastures/errors";

export type AnimalListItem = {
  id: string;
  code: string;
  name: string | null;
  sex: "FEMALE" | "MALE" | "UNKNOWN";
  status: "ALIVE" | "DEAD" | "SOLD" | "SICK" | "TRANSFERRED";
  birthDate: Date | null;
  weightKg: string | null;
  speciesId: number;
  breedId: number | null;
  isActive: boolean;
};

type AnimalChangeData = {
  name?: string | null;
  breedId?: number | null;
  sex?: "FEMALE" | "MALE" | "UNKNOWN";
  birthDate?: Date | null;
  weightKg?: string | null;
  motherId?: string | null;
  fatherId?: string | null;
  status?:
  | "ALIVE"
  | "DEAD"
  | "SOLD"
  | "SICK"
  | "TRANSFERRED";
  isActive?: boolean;
};

function toAnimalListItem(
  animal: {
    id: string;
    code: string;
    name: string | null;
    sex: "FEMALE" | "MALE" | "UNKNOWN";
    status: "ALIVE" | "DEAD" | "SOLD" | "SICK" | "TRANSFERRED";
    birthDate: Date | null;
    weightKg: Prisma.Decimal | null;
    speciesId: number;
    breedId: number | null;
    isActive: boolean;
    motherId: string | null;
    fatherId: string | null;
  },
): AnimalListItem {
  return {
    id: animal.id,
    code: animal.code,
    name: animal.name,
    sex: animal.sex,
    status: animal.status,
    birthDate: animal.birthDate,
    weightKg: animal.weightKg === null ? null : animal.weightKg.toString(),
    speciesId: animal.speciesId,
    breedId: animal.breedId,
    isActive: animal.isActive,
  };
}

export async function createAnimal(
  input: CreateAnimalInput,
  createdById: string,
): Promise<AnimalListItem> {
  const farm = await db.farm.findFirst({
    select: {
      id: true,
    },
  });

  if (!farm) {
    throw new AnimalValidationError({
      farm: ["No existe una finca configurada."],
    });
  }

  const species = await db.species.findFirst({
    where: {
      id: input.speciesId,
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  if (!species) {
    throw new AnimalValidationError({
      speciesId: ["La especie seleccionada no existe o no esta activa."],
    });
  }

  if (input.breedId !== null && input.breedId !== undefined) {
    const breed = await db.breed.findFirst({
      where: {
        id: input.breedId,
        speciesId: input.speciesId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!breed) {
      throw new AnimalValidationError({
        breedId: [
          "La raza seleccionada no existe, no esta activa o no pertenece a la especie indicada.",
        ],
      });
    }
  }

  try {
    const animal = await db.$transaction(async (tx) => {
      const created = await tx.animal.create({
        data: {
          farmId: farm.id,
          code: input.code,
          name: input.name,
          speciesId: input.speciesId,
          breedId: input.breedId,
          sex: input.sex,
          birthDate: input.birthDate,
          weightKg:
            input.weightKg === null
              ? null
              : new Prisma.Decimal(input.weightKg),
          motherId: input.motherId,
          fatherId: input.fatherId,
          status: input.status,
          createdById,
        },
        select: {
          id: true,
          code: true,
          name: true,
          sex: true,
          status: true,
          birthDate: true,
          weightKg: true,
          speciesId: true,
          breedId: true,
          isActive: true,
          motherId: true,
          fatherId: true,
        },
      });

      await tx.animalChangeLog.create({
        data: {
          animalId: created.id,
          action: "CREATED",
          changedById: createdById,
          previousData: Prisma.JsonNull,
          newData: {
            name: created.name,
            breedId: created.breedId,
            sex: created.sex,
            birthDate: created.birthDate,
            weightKg:
              created.weightKg === null
                ? null
                : created.weightKg.toString(),
            motherId: created.motherId,
            fatherId: created.fatherId,
            status: created.status,
            isActive: created.isActive,
          },
        },
      });

      return created;
    });

    return toAnimalListItem(animal);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new AnimalConflictError();
    }

    throw error;
  }
}

export async function listAnimals(
  query: ListAnimalsQuery,
): Promise<{
  items: AnimalListItem[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const where: Prisma.AnimalWhereInput = {
    isActive: true,
  };

  if (query.speciesId) {
    where.speciesId = query.speciesId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      {
        code: {
          contains: query.search,
          mode: "insensitive",
        },
      },
      {
        name: {
          contains: query.search,
          mode: "insensitive",
        },
      },
    ];
  }

  const [animals, total] = await Promise.all([
    db.animal.findMany({
      where,
      orderBy: [
        {
          createdAt: "desc",
        },
      ],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        sex: true,
        status: true,
        birthDate: true,
        weightKg: true,
        speciesId: true,
        breedId: true,
        isActive: true,
        motherId: true,
        fatherId: true,
      },
    }),
    db.animal.count({
      where,
    }),
  ]);

  return {
    items: animals.map(toAnimalListItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function getAnimalById(
  id: string,
): Promise<AnimalListItem> {
  const animal = await db.animal.findFirst({
    where: {
      id,
      isActive: true,
    },
    select: {
      id: true,
      code: true,
      name: true,
      sex: true,
      status: true,
      birthDate: true,
      weightKg: true,
      speciesId: true,
      breedId: true,
      isActive: true,
      motherId: true,
      fatherId: true,
    },
  });

  if (!animal) {
    throw new AnimalNotFoundError();
  }

  return toAnimalListItem(animal);
}

export async function updateAnimal(
  id: string,
  input: UpdateAnimalInput,
  updatedById: string,
): Promise<AnimalListItem> {
  const existing = await db.animal.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
      code: true,
      speciesId: true,
      isActive: true,
    },
  });

  if (!existing) {
    throw new AnimalNotFoundError();
  }

  if (input.breedId !== undefined) {
    if (input.breedId === null) {
      // La raza puede eliminarse.
    } else {
      const breed = await db.breed.findFirst({
        where: {
          id: input.breedId,
          speciesId: existing.speciesId,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!breed) {
        throw new AnimalValidationError({
          breedId: [
            "La raza seleccionada no existe, no esta activa o no pertenece a la especie del animal.",
          ],
        });
      }
    }
  }

  const parentIds = [
    input.motherId,
    input.fatherId,
  ].filter((value): value is string => value !== undefined && value !== null);

  if (parentIds.includes(id)) {
    throw new AnimalRelationshipError(
      "Un animal no puede ser su propio progenitor.",
    );
  }

  if (input.motherId !== undefined && input.motherId !== null) {
    const mother = await db.animal.findFirst({
      where: {
        id: input.motherId,
        isActive: true,
      },
      select: {
        id: true,
        sex: true,
      },
    });

    if (!mother) {
      throw new AnimalRelationshipError(
        "La madre seleccionada no existe o no esta activa.",
      );
    }

    if (mother.sex !== "FEMALE") {
      throw new AnimalRelationshipError(
        "La madre seleccionada debe ser hembra.",
      );
    }
  }

  if (input.fatherId !== undefined && input.fatherId !== null) {
    const father = await db.animal.findFirst({
      where: {
        id: input.fatherId,
        isActive: true,
      },
      select: {
        id: true,
        sex: true,
      },
    });

    if (!father) {
      throw new AnimalRelationshipError(
        "El padre seleccionado no existe o no esta activo.",
      );
    }

    if (father.sex !== "MALE") {
      throw new AnimalRelationshipError(
        "El padre seleccionado debe ser macho.",
      );
    }
  }

  try {
    const animal = await db.$transaction(async (tx) => {
      const current = await tx.animal.findUniqueOrThrow({
        where: {
          id,
        },
        select: {
          name: true,
          breedId: true,
          sex: true,
          birthDate: true,
          weightKg: true,
          motherId: true,
          fatherId: true,
          status: true,
          isActive: true,
        },
      });

      const previousData: AnimalChangeData = {
        name: current.name,
        breedId: current.breedId,
        sex: current.sex,
        birthDate: current.birthDate,
        weightKg:
          current.weightKg === null
            ? null
            : current.weightKg.toString(),
        motherId: current.motherId,
        fatherId: current.fatherId,
        status: current.status,
        isActive: current.isActive,
      };

      const updated = await tx.animal.update({
        where: {
          id,
        },
        data: {
          name: input.name,
          breedId: input.breedId,
          sex: input.sex,
          birthDate: input.birthDate,
          weightKg:
            input.weightKg === undefined
              ? undefined
              : input.weightKg === null
                ? null
                : new Prisma.Decimal(input.weightKg),
          motherId: input.motherId,
          fatherId: input.fatherId,
          status: input.status,
          isActive: input.isActive,
          updatedById,
        },
        select: {
          id: true,
          code: true,
          name: true,
          sex: true,
          status: true,
          birthDate: true,
          weightKg: true,
          speciesId: true,
          breedId: true,
          isActive: true,
          motherId: true,
          fatherId: true,
        },
      });

      const newData: AnimalChangeData = {
        name: updated.name,
        breedId: updated.breedId,
        sex: updated.sex,
        birthDate: updated.birthDate,
        weightKg:
          updated.weightKg === null
            ? null
            : updated.weightKg.toString(),
        motherId: updated.motherId,
        fatherId: updated.fatherId,
        status: updated.status,
        isActive: updated.isActive,
      };

      const wasActive = current.isActive;
      const isActive = updated.isActive;

      await tx.animalChangeLog.create({
        data: {
          animalId: updated.id,
          action: wasActive && !isActive ? "DEACTIVATED" : "UPDATED",
          changedById: updatedById,
          previousData,
          newData,
        },
      });

      return updated;
    });

    return toAnimalListItem(animal);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new AnimalNotFoundError();
    }

    throw error;
  }
}

export async function updateAnimalPasture(
  animalId: string,
  input: UpdateAnimalPastureInput,
  updatedById: string,
): Promise<AnimalListItem> {
  return db.$transaction(
    async (tx) => {
      const animal = await tx.animal.findFirst({
        where: {
          id: animalId,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          sex: true,
          status: true,
          birthDate: true,
          weightKg: true,
          speciesId: true,
          breedId: true,
          motherId: true,
          fatherId: true,
          currentPastureId: true,
          isActive: true,
        },
      });

      if (!animal) {
        throw new AnimalNotFoundError();
      }

      const previousPastureId = animal.currentPastureId;
      const nextPastureId = input.currentPastureId;

      if (previousPastureId === nextPastureId) {
        return toAnimalListItem(animal);
      }

      if (nextPastureId) {
        const pasture = await tx.pasture.findFirst({
          where: {
            id: nextPastureId,
            isActive: true,
          },
          select: {
            id: true,
          },
        });

        if (!pasture) {
          throw new PastureNotFoundError();
        }
      }

      const updatedAnimal = await tx.animal.update({
        where: {
          id: animalId,
        },
        data: {
          currentPastureId: nextPastureId,
          updatedById,
        },
        select: {
          id: true,
          code: true,
          name: true,
          sex: true,
          status: true,
          birthDate: true,
          weightKg: true,
          speciesId: true,
          breedId: true,
          motherId: true,
          fatherId: true,
          currentPastureId: true,
          isActive: true,
        },
      });

      await tx.animalChangeLog.create({
        data: {
          animalId,
          action: "PASTURE_CHANGED",
          changedById: updatedById,
          previousData: {
            currentPastureId: previousPastureId,
          },
          newData: {
            currentPastureId: nextPastureId,
          },
        },
      });

      return toAnimalListItem(updatedAnimal);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}