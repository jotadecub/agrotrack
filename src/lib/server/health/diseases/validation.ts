import { z } from "zod";

const diseaseNameSchema = z
  .string()
  .trim()
  .min(1, "El nombre es obligatorio.")
  .max(120, "El nombre no puede superar 120 caracteres.");

const diseaseDescriptionSchema = z
  .string()
  .trim()
  .max(1000, "La descripción no puede superar 1000 caracteres.")
  .nullable()
  .optional();

export const createDiseaseSchema = z
  .object({
    name: diseaseNameSchema,
    description: diseaseDescriptionSchema,
    isActive: z.boolean().optional(),
  })
  .strict();

export const updateDiseaseSchema = z
  .object({
    name: diseaseNameSchema.optional(),
    description: diseaseDescriptionSchema,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.name !== undefined ||
      data.description !== undefined ||
      data.isActive !== undefined,
    {
      message: "Debes proporcionar al menos un campo para actualizar.",
    },
  );

export type CreateDiseaseInput = z.infer<typeof createDiseaseSchema>;
export type UpdateDiseaseInput = z.infer<typeof updateDiseaseSchema>;