import { Prisma } from "../../../../generated/prisma/client";

import { db } from "../../db";

import {
  DiseaseConflictError,
  DiseaseValidationError,
} from "./errors";

import {
  CreateDiseaseInput,
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