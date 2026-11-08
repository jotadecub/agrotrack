import { z } from "zod";

export const animalSexValues = [
  "FEMALE",
  "MALE",
  "UNKNOWN",
] as const;

export const animalStatusValues = [
  "ALIVE",
  "DEAD",
  "SOLD",
  "SICK",
  "TRANSFERRED",
] as const;

const optionalTrimmedString = z
  .string()
  .trim()
  .max(150)
  .optional()
  .transform((value) => (value === "" ? undefined : value));

export const createAnimalSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "El código es obligatorio.")
      .max(50, "El código no puede superar 50 caracteres."),
    name: optionalTrimmedString,
    speciesId: z.coerce
      .number()
      .int()
      .positive("La especie es obligatoria."),
    breedId: z.coerce
      .number()
      .int()
      .positive()
      .optional()
      .nullable()
      .transform((value) => (value === 0 ? null : value)),
    sex: z.enum(animalSexValues).default("UNKNOWN"),
    birthDate: z.coerce
      .date()
      .optional()
      .nullable()
      .transform((value) => (value ? value : null)),
    weightKg: z.coerce
      .number()
      .positive("El peso debe ser mayor a cero.")
      .max(10000, "El peso no puede superar 10000 kg.")
      .optional()
      .nullable()
      .transform((value) => (value === 0 ? null : value)),
    motherId: z.string().uuid().optional().nullable(),
    fatherId: z.string().uuid().optional().nullable(),
    status: z.enum(animalStatusValues).default("ALIVE"),
  })
  .strict();

export type CreateAnimalInput = z.infer<typeof createAnimalSchema>;

export const listAnimalsQuerySchema = z
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
      .optional(),
    speciesId: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
    status: z.enum(animalStatusValues).optional(),
  })
  .strict();

export type ListAnimalsQuery = z.infer<typeof listAnimalsQuerySchema>;