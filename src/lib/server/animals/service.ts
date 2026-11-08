import { Prisma } from "../../../generated/prisma/client";

import { db } from "../db";
import {
  AnimalConflictError,
  AnimalNotFoundError,
  AnimalValidationError,
} from "./errors";
import {
  CreateAnimalInput,
  ListAnimalsQuery,
} from "./validation";

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

function toAnimalListItem(
  animal: Prisma.AnimalGetPayload<{
    select: {
      id: true;
      code: true;
      name: true;
      sex: true;
      status: true;
      birthDate: true;
      weightKg: true;
      speciesId: true;
      breedId: true;
      isActive: true;
    };
  }>,
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
    const animal = await db.animal.create({
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
      },
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
    },
  });

  if (!animal) {
    throw new AnimalNotFoundError();
  }

  return toAnimalListItem(animal);
}