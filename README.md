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

### Usuarios

El esquema incluye usuarios con los roles ADMIN, SUPERVISOR y READER.

La identificación es única en toda la instalación y se almacena
como texto.

Las contraseñas deben almacenarse únicamente como hashes.
La migración no crea cuentas ni contraseñas predeterminadas.

La autenticación y el procedimiento de creación del primer
Administrador se implementarán en los siguientes bloques.

### Almacenamiento de contraseñas

El servidor utiliza Argon2id con:

- Memoria: 19 MiB.
- Iteraciones: 2.
- Paralelismo: 1.

La biblioteca genera una sal aleatoria para cada hash.

El módulo no guarda contraseñas ni consulta la base de datos.
La política de contraseñas se aplicará en los servicios de
creación y cambio de credenciales.

### Pruebas automáticas

Ejecutar todas las pruebas:

    npm test

Ejecutar en modo observación:

    npm run test:watch

Las pruebas de contraseñas utilizan Argon2 real y no requieren
conexión con PostgreSQL.

### Politica de contraseñas

Las contraseñas nuevas deben tener entre 15 y 128 caracteres.

No se permiten espacios, tabulaciones ni saltos de linea.
No se exigen mayusculas, numeros ni simbolos.
Se permiten caracteres Unicode.

La contraseña no se recorta ni se modifica automaticamente.

Esta politica debe validarse en el servidor antes de generar
el hash. La validacion del navegador sera solo una ayuda de UX.

### Inicializacion de la instalacion

Con las migraciones aplicadas:

    npm run setup:installation

El comando solicita los datos de la finca y del primer Administrador.
La contraseña se introduce de forma oculta y no se guarda en archivos.

Solo funciona cuando no existen fincas ni usuarios.
La creacion de ambos registros se realiza en una transaccion.

No es un comando para restablecer acceso ni reparar datos.

El Administrador se crea activo y debe cambiar su contraseña
en el primer acceso. El login se implementa en un bloque posterior.

No ejecutar automaticamente durante instalaciones de dependencias,
compilaciones o despliegues.