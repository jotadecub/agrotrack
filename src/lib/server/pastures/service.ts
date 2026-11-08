import { Prisma } from "../../../generated/prisma/client";

import { db } from "../db";
import {
  PastureConflictError,
  PastureNotFoundError,
  PastureValidationError,
} from "./errors";
import {
  CreatePastureInput,
  ListPasturesQuery,
  UpdatePastureInput,
} from "./validation";

export type PastureListItem = {
  id: string;
  name: string;
  description: string | null;
  areaHectares: string | null;
  isActive: boolean;
};

function toPastureListItem(pasture: {
  id: string;
  name: string;
  description: string | null;
  areaHectares: Prisma.Decimal | null;
  isActive: boolean;
}): PastureListItem {
  return {
    id: pasture.id,
    name: pasture.name,
    description: pasture.description,
    areaHectares:
      pasture.areaHectares === null
        ? null
        : pasture.areaHectares.toString(),
    isActive: pasture.isActive,
  };
}

export async function createPasture(
  input: CreatePastureInput,
  createdById: string,
): Promise<PastureListItem> {
  const farm = await db.farm.findFirst({
    select: {
      id: true,
    },
  });

  if (!farm) {
    throw new PastureValidationError({
      farm: ["No existe una finca configurada."],
    });
  }

  try {
    const pasture = await db.pasture.create({
      data: {
        farmId: farm.id,
        name: input.name,
        description: input.description,
        areaHectares:
          input.areaHectares === null
            ? null
            : new Prisma.Decimal(input.areaHectares),
        createdById,
      },
      select: {
        id: true,
        name: true,
        description: true,
        areaHectares: true,
        isActive: true,
      },
    });

    return toPastureListItem(pasture);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PastureConflictError();
    }

    throw error;
  }
}

export async function listPastures(
  query: ListPasturesQuery,
): Promise<{
  items: PastureListItem[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const where: Prisma.PastureWhereInput = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.search) {
    where.name = {
      contains: query.search,
      mode: "insensitive",
    };
  }

  const [pastures, total] = await Promise.all([
    db.pasture.findMany({
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
        name: true,
        description: true,
        areaHectares: true,
        isActive: true,
      },
    }),
    db.pasture.count({
      where,
    }),
  ]);

  return {
    items: pastures.map(toPastureListItem),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function getPastureById(
  id: string,
): Promise<PastureListItem> {
  const pasture = await db.pasture.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
      name: true,
      description: true,
      areaHectares: true,
      isActive: true,
    },
  });

  if (!pasture) {
    throw new PastureNotFoundError();
  }

  return toPastureListItem(pasture);
}

export async function updatePasture(
  id: string,
  input: UpdatePastureInput,
  updatedById: string,
): Promise<PastureListItem> {
  try {
    const pasture = await db.pasture.update({
      where: {
        id,
      },
      data: {
        name: input.name,
        description: input.description,
        areaHectares:
          input.areaHectares === undefined
            ? undefined
            : input.areaHectares === null
              ? null
              : new Prisma.Decimal(input.areaHectares),
        isActive: input.isActive,
        updatedById,
      },
      select: {
        id: true,
        name: true,
        description: true,
        areaHectares: true,
        isActive: true,
      },
    });

    return toPastureListItem(pasture);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new PastureConflictError();
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new PastureNotFoundError();
    }

    throw error;
  }
}