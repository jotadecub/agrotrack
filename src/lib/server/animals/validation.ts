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

const optionalNullableText = z
  .string()
  .trim()
  .max(150)
  .nullish()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalNullableId = z
  .string()
  .uuid()
  .nullish()
  .transform((value) => (value === "" || value === undefined ? null : value));

const optionalNullableNumber = z.coerce
  .number()
  .positive("El peso debe ser mayor a cero.")
  .max(10000, "El peso no puede superar 10000 kg.")
  .nullish()
  .transform((value) => (value === undefined ? null : value));

const optionalNullableDate = z.coerce
  .date()
  .nullish()
  .transform((value) => (value === undefined ? null : value));

const optionalNullableBreedId = z.coerce
  .number()
  .int()
  .positive()
  .nullish()
  .transform((value) => (value === 0 || value === undefined ? null : value));

export const createAnimalSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1, "El código es obligatorio.")
      .max(50, "El código no puede superar 50 caracteres."),
    name: optionalNullableText,
    speciesId: z.coerce
      .number()
      .int()
      .positive("La especie es obligatoria."),
    breedId: optionalNullableBreedId,
    sex: z.enum(animalSexValues).default("UNKNOWN"),
    birthDate: optionalNullableDate,
    weightKg: optionalNullableNumber,
    motherId: optionalNullableId,
    fatherId: optionalNullableId,
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
      .nullish()
      .transform((value) => (value === "" || value === undefined ? undefined : value)),
    speciesId: z.coerce
      .number()
      .int()
      .positive()
      .nullish()
      .transform((value) => (value === 0 || value === undefined ? undefined : value)),
    status: z.enum(animalStatusValues).nullish()
      .transform((value) => (value === undefined ? undefined : value)),
  })
  .strict();

export type ListAnimalsQuery = z.infer<typeof listAnimalsQuerySchema>;