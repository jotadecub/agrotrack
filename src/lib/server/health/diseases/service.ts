import { Prisma } from "../../../../generated/prisma/client";

import { db } from "../../db";

import {
  DiseaseConflictError,
  DiseaseValidationError,
  DiseaseNotFoundError,
} from "./errors";

import {
  CreateDiseaseInput,
  ListDiseasesQuery,
  UpdateDiseaseInput,
} from "./validation";

export type DiseaseListItem = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
};

function toDiseaseListItem(disease: {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}): DiseaseListItem {
  return {
    id: disease.id,
    name: disease.name,
    description: disease.description,
    isActive: disease.isActive,
  };
}

export async function createDisease(
  input: CreateDiseaseInput,
  createdById: string,
): Promise<DiseaseListItem> {
  const farm = await db.farm.findFirst({
    select: {
      id: true,
    },
  });

  if (!farm) {
    throw new DiseaseValidationError({
      farm: ["No existe una finca configurada."],
    });
  }

  try {
    const disease = await db.disease.create({
      data: {
        farmId: farm.id,
        name: input.name,
        description:
          input.description === undefined ? null : input.description,
        isActive: input.isActive ?? true,
        createdById,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
      },
    });

    return toDiseaseListItem(disease);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DiseaseConflictError();
    }

    throw error;
  }
}

export async function listDiseases(
  query: ListDiseasesQuery,
): Promise<{
  items: DiseaseListItem[];
  page: number;
  pageSize: number;
  total: number;
}> {
  const where: Prisma.DiseaseWhereInput = {};

  if (query.isActive !== undefined) {
    where.isActive = query.isActive;
  }

  if (query.search) {
    where.name = {
      contains: query.search,
      mode: "insensitive",
    };
  }

  const [diseases, total] = await Promise.all([
    db.disease.findMany({
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
        isActive: true,
      },
    }),
    db.disease.count({
      where,
    }),
  ]);

  return {
    items: diseases,
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function updateDisease(
  id: string,
  input: UpdateDiseaseInput,
  updatedById: string,
): Promise<DiseaseListItem> {
  const existingDisease = await db.disease.findFirst({
    where: {
      id,
    },
    select: {
      id: true,
    },
  });

  if (!existingDisease) {
    throw new DiseaseNotFoundError();
  }

  try {
    const disease = await db.disease.update({
      where: {
        id,
      },
      data: {
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        updatedById,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
      },
    });

    return disease;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DiseaseConflictError();
    }

    throw error;
  }
}