## Base de datos local

El proyecto utiliza PostgreSQL y Prisma ORM 7.

### Configuración

1. Crear una base PostgreSQL exclusiva para desarrollo.
2. Copiar `.env.example` como `.env`.
3. Completar `DATABASE_URL` con las credenciales locales.
4. Ejecutar:

   npm ci
   npm run db:generate
   npm run db:migrate
   npm run db:status

El usuario local necesita crear bases para la shadow database
utilizada por Prisma Migrate durante el desarrollo.

No publicar `.env` ni utilizar estas credenciales en producción.

Las migraciones se versionan en Git.
El cliente generado de Prisma no se versiona.