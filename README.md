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

### Sesiones

El esquema incluye sesiones asociadas a usuarios mediante
la tabla auth_session.

Cada sesion tiene fecha de creacion, vencimiento y revocacion
opcional.

No se almacenan contraseñas ni JWT completos en esta tabla.

La emision de tokens, validacion de sesiones y cierre de sesion
se implementan en bloques posteriores.

### Tokens de autenticacion

Los tokens se firman y verifican mediante jose con HS256.

AUTH_JWT_SECRET debe contener 32 bytes aleatorios representados
como 64 caracteres hexadecimales. Cada instalacion debe utilizar
un secreto diferente.

El token contiene identificadores internos y fechas.
No contiene contraseñas, datos personales ni permisos.

La verificacion criptografica no sustituye la consulta de
la sesion y el estado actual del usuario en PostgreSQL.

La duracion y renovacion de sesiones se configuran en el servicio
de autenticacion, no en este modulo.

### Politica de sesiones

- JWT de acceso: 15 minutos.
- Inactividad maxima: 30 minutos.
- Duracion absoluta: 8 horas.

La renovacion no amplia la duracion absoluta.
Las renovaciones automaticas no cuentan como actividad.

La credencial de renovacion se genera con 32 bytes aleatorios.
La base de datos conserva unicamente su hash SHA-256.

En este bloque se incorporan el esquema y las utilidades.
El servicio que aplica la politica y los endpoints se
implementan posteriormente.

### Servicio de sesiones

El servicio interno permite:

- Crear sesiones para usuarios activos.
- Emitir el JWT inicial.
- Guardar el hash de la credencial de renovacion.
- Revocar una sesion o todas las de un usuario.

La creacion utiliza una transaccion Serializable.

Este servicio no comprueba contraseñas ni autoriza endpoints.
Sus credenciales no deben devolverse como JSON al navegador.

Las pruebas unitarias sustituyen PostgreSQL y la firma de JWT.
Las pruebas de transacciones reales y concurrencia estan pendientes.

La validacion de sesiones, el control de inactividad y la
renovacion se implementan en bloques posteriores.

### Validacion de acceso

La validacion comprueba el JWT, su correspondencia con la sesion,
la revocacion, el vencimiento absoluto, la inactividad y el
estado actual del usuario.

El rol y la obligacion de cambiar contraseña se leen de PostgreSQL.

Por defecto no actualiza la actividad.
Las peticiones que correspondan deben solicitarlo desde codigo
del servidor; las renovaciones no deben hacerlo.

Los fallos de infraestructura se propagan y no conceden acceso.

La autorizacion por rol, el cambio obligatorio de contraseña
y las cookies se implementan en bloques posteriores.

Las pruebas de este servicio son unitarias con dependencias
simuladas; no sustituyen pruebas de integracion.

### Renovacion de sesiones

La renovacion requiere el ID de sesion y su credencial actual.

En una transaccion se sustituye el hash de renovacion y se
firma un JWT nuevo.

La renovacion:
- No modifica lastActivityAt.
- No amplia expiresAt.
- No emite un JWT que supere el vencimiento absoluto.
- Rechaza sesiones revocadas, inactivas o vencidas.
- Rechaza usuarios desactivados.

La credencial anterior deja de coincidir con el hash guardado.

Pendiente antes de integrar en la web:
- Cookies y proteccion CSRF/origen.
- Coordinacion de renovaciones entre peticiones y pestañas.
- Comportamiento si se pierde la respuesta tras confirmar la rotacion.
- Evaluacion de deteccion de reutilizacion de credenciales antiguas.
- Pruebas reales de concurrencia y rollback en PostgreSQL.

Las pruebas unitarias utilizan dependencias simuladas.

### Base local para pruebas de integracion

Las pruebas utilizaran una base separada:

- Base: agrotrack_test.
- Usuario: agrotrack_test.
- Configuracion privada: .env.test.

Aplicar las migraciones existentes:

    npm run db:test:migrate

Consultar su estado:

    npm run db:test:status

La configuracion rechaza destinos distintos del entorno local
de pruebas esperado.

No ejecutar setup:installation contra esta base.
No utilizar agrotrack_dev para limpieza de datos de pruebas.

Los comandos anteriores preparan la base; todavia no ejecutan
pruebas de integracion.

### Pruebas de integracion

Preparar la base aislada:

    npm run db:test:migrate

Ejecutar:

    npm run test:integration

Las pruebas utilizan PostgreSQL, Prisma, Argon2 y JWT reales.
Solo se sustituye el marcador server-only.

Antes de crear datos se verifica el nombre de la base y el usuario.

Cada prueba elimina exclusivamente sus propios usuarios y sesiones.
No se utiliza TRUNCATE ni se reinicia la base.

Las pruebas cubren creacion, bloqueo de usuarios, revocacion,
inactividad, vencimiento absoluto, rotacion, un escenario de
concurrencia y rollback ante fallos de firma.

No prueban todavia cookies, endpoints, CSRF ni navegadores.

### Autenticacion web: primer bloque

Se agrego la capa inicial de cookies y proteccion de origen.

- Cookies HttpOnly y SameSite=Strict.
- Secure automatico en produccion.
- Verificacion de Origin en peticiones de escritura.
- Endpoint inicial de login.
- Limite local de cinco intentos por IP en 15 minutos.

El limite de intentos todavia esta en memoria y se reinicia
al reiniciar el servidor. Debe moverse a almacenamiento
persistente antes de produccion.

Las cookies no sustituyen la autorizacion por rol.

### Cambio obligatorio de contrasena

Se agrego `passwordChangedAt` como campo opcional.

Los usuarios nuevos tienen este valor nulo. El login devuelve
`mustChangePassword`, pero no expone `passwordChangedAt`.

El siguiente paso restringira las operaciones mientras el cambio
de contrasena este pendiente.

### Cambio obligatorio de contrasena

Se agrego el cambio de contrasena para usuarios con
`mustChangePassword = true`.

El servicio verifica la contrasena actual, aplica la politica
de contrasenas y actualiza el hash dentro de una transaccion.

Al cambiarla:

- Se marca el cambio como completado.
- Se registra `passwordChangedAt`.
- Se revocan todas las sesiones activas anteriores.
- Se crea una nueva sesion.

El endpoint requiere una sesion valida y verifica el origen.
No permite cambiar la contrasena de un usuario inactivo.

### Cierre de sesion

Se agrego el cierre de sesion por sesion individual.

El endpoint revoca la sesion identificada por el JWT de acceso,
elimina las cookies y responde de forma uniforme.

No revoca otras sesiones del mismo usuario. Esa accion requerira
una operacion explicita y autorizada en el futuro.