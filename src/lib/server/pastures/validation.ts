import { z } from "zod";

const optionalNullableText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalNullableArea = z.coerce
  .number()
  .positive("El área debe ser mayor a cero.")
  .max(1000000, "El área no puede superar 1000000 hectáreas.")
  .nullish()
  .transform((value) => (value === undefined ? null : value));

export const createPastureSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(150, "El nombre no puede superar 150 caracteres."),
    description: optionalNullableText,
    areaHectares: optionalNullableArea,
  })
  .strict();

export type CreatePastureInput = z.infer<typeof createPastureSchema>;

export const updatePastureSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "El nombre es obligatorio.")
      .max(150, "El nombre no puede superar 150 caracteres.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(500)
      .nullable()
      .optional(),
    areaHectares: z.coerce
      .number()
      .positive("El área debe ser mayor a cero.")
      .max(1000000, "El área no puede superar 1000000 hectáreas.")
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    {
      message: "Debes enviar al menos un campo para actualizar.",
    },
  );

export type UpdatePastureInput = {
  name?: string;
  description?: string | null;
  areaHectares?: number | null;
  isActive?: boolean;
};

export const listPasturesQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .min(1)
      .default(1),
    pageSize: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(20),
    search: z
      .string()
      .trim()
      .max(100)
      .nullish()
      .transform((value) =>
        value === "" || value === undefined ? undefined : value,
      ),
    isActive: z
      .enum(["true", "false"])
      .nullish()
      .transform((value) =>
        value === undefined ? undefined : value === "true",
      ),
  })
  .strict();

export type ListPasturesQuery = z.infer<typeof listPasturesQuerySchema>;