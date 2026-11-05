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

### Comprobar la conexión

Ejecutar:

    npm run db:check

La comprobación utiliza el cliente de Prisma del servidor,
consulta PostgreSQL y cuenta los registros de configuración
de la finca.

No crea ni modifica datos.

En una instalación recién migrada se esperan cero registros
de finca.

El comando utiliza la condición `react-server` para cargar
el módulo protegido con `server-only` fuera de Next.js.