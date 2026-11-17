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

export const listDiseasesQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1, "La página debe ser mayor o igual a 1.")
      .default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1, "El tamaño de página debe ser mayor o igual a 1.")
      .max(100, "El tamaño de página no puede superar 100.")
      .default(20),
    search: z
      .string()
      .trim()
      .max(120, "La búsqueda no puede superar 120 caracteres.")
      .optional(),
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

export type ListDiseasesQuery = z.infer<typeof listDiseasesQuerySchema>;

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