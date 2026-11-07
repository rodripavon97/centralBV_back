---
name: estructura-proyecto
description: Conoce y documenta la estructura real del backend NestJS, sus módulos, capas, convenciones, integración con Supabase y comandos de ejecución.
compatibility: opencode
---

# Skill: Estructura del proyecto — Gestoría de Bomberos (`centralBV_Back`)

## 1. Objetivo

Contexto arquitectónico **sincronizado con el código real** (`C:\Users\Rome\Documents\centralBV_Back`). Antes de cualquier cambio: inspeccionar el repo, no asumir completitud de módulos, no inventar carpetas/funcionalidades.

Permite al agente:
- Comprender la organización y responsabilidades por módulo/capa.
- Ubicar nuevas funcionalidades respetando convenciones existentes.
- Mantener separación de responsabilidades (SRP) y evitar arquitecturas innecesarias.
- Identificar oportunidades de refactorización **sin** ejecutarlas masivamente sin autorización.

## 2. Stack tecnológico (verificado)

- **Node.js** (README: 20+; `package.json` tipa `@types/node` ^24), **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`).
- **NestJS 12**, **TypeScript strict** (`tsconfig.json`: `strict: true`, `strictPropertyInitialization: false`, `module`/`moduleResolution: nodenext`, `target: ES2023`, `emitDecoratorMetadata`), ESM (`package.json` `"type": "module"`), imports internos con extensión `.js`.
- **Supabase Cloud** + `@supabase/supabase-js` (cliente anon + admin vía `SupabaseService`). **RLS** es responsabilidad de configuración/plataforma Supabase (SQL en `src/db/*` muestra RLS/revocaciones en flota; acceso backend previsto con service role). No asumir que Nest reemplaza autorización en BD.
- **HTTP/API**: Express, CORS, `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), `HttpExceptionFilter` global, Swagger en `/api/docs` (Bearer).
- **Auth/seguridad**: Passport JWT, `ThrottlerGuard` global (default 100/min), `RolesGuard` + `@Roles`, cifrado AES-256-GCM (`ENCRYPTION_KEY`) para password de reenvío.
- **Otros**: `class-validator`/`class-transformer`, Mailer/nodemailer, `jspdf` (PDF constancias), Vitest, oxlint (type-aware), Prettier.
- No asumir dependencias extra sin verificar `package.json`.

## 3. Estructura general (real)

```text
src/
  app.module.ts, main.ts
  auth/            __tests__, dtos, response, strategies, auth.{controller,module,service}.ts
  certificates/    __tests__, domain, dtos, pdf (+ assets), repositories, certificate-request.{controller,module,service}.ts
  common/          __tests__, decorators, filters, guards, pipes, security, utils
  db/              users.sql, fleet.sql, certificates.sql
  fleet/           __tests__, domain, dtos, repositories, fleet.{controller,module,service}.ts,
                   vehicle-catalog.controller.ts, vehicle-catalog.service.ts
  health/          __tests__, health.controller.ts, health.module.ts, supabase-health.indicator.ts
  mail/            __tests__, builders, templates, mail.{module,service}.ts
  roles/           __tests__, dtos, roles.controller.ts, roles.modules.ts (*nombre no estándar*), roles.service.ts
  seed/            seed.module.ts, seed.service.ts
  supabase/        __tests__, supabase.module.ts, supabase.service.ts, supabase-error.ts
  users/           __tests__, domain, dtos, interface, repositories, users.{controller,module,service}.ts
Dockerfile, docker-compose.yml, .dockerignore
.env.example, .env.production.example
vitest.config.ts, vitest.config.e2e.ts, tsconfig*.json, README.md, AGENTS.md, .opencode/
```
- Módulos bajo **`src/<feature>/`** (no `src/modules/`). `dist/`, `coverage/` son artefactos generados.
- No se observó carpeta `test/` con specs (existe `vitest.config.e2e.ts`).
- **Docker**: existe `Dockerfile` (multi-stage, `node:24-alpine`, `pnpm`/corepack, copia `pnpm-workspace.yaml`, `pnpm build` → `dist`, runner `node dist/main.js`, usuario `node`) y `docker-compose.yml` (servicio `api`, build local, `env_file` `.env` opcional, variables interpoladas, `NODE_ENV` sobrescribible — default `production` —, healthcheck `GET /api/health`). `.dockerignore` excluye `node_modules`, `dist`, `.env*` y permite `!.env.example`.
- **Entornos**: plantillas versionables `.env.example` y `.env.production.example`. `.gitignore` ignora `.env` y `.env.production` (entre otros); los archivos con secretos reales no se versionan. `.env`/`.env.production` pueden existir localmente.

## 4. Composición de la aplicación

- **`src/main.ts`**: `NestFactory` (Express), `enableCors()`, `trust proxy` si `TRUST_PROXY=true` (necesario para rate limit detrás de proxy/CDN), `ValidationPipe` + `HttpExceptionFilter` globales, Swagger (`CentralBV API`, `/api/docs`). Escucha en `0.0.0.0` en `Number(process.env.PORT) || 3000` (compatible con *port mapping* de Docker) y emite log de arranque `[bootstrap] env=... listening=...` además del log de Swagger.
- **`src/app.module.ts`**: `ConfigModule.forRoot({ isGlobal: true, envFilePath: NODE_ENV==='production' ? ['.env.production','.env'] : ['.env'] })` (las variables ya presentes en `process.env`, p. ej. inyectadas por Docker Compose, se respetan), `ThrottlerModule.forRoot([{ default, ttl 60_000, limit 100 }])`, módulos `Supabase`, `Health`, `Auth`, `Users`, `Roles`, `Seed`, `CertificateRequestModule`, `Fleet`. `APP_GUARD` = `ThrottlerGuard`.

## 5. Variables de entorno (referenciadas en código/README)

| Variable | Uso observado | Notas |
|---|---|---|
| `NODE_ENV` | Selección de `envFilePath` en `ConfigModule` (`app.module.ts`); default de imagen/compose Docker `production` (sobrescribible) | Afecta carga de `.env.production`/`.env`. |
| `PORT` | Puerto HTTP (`main.ts`, mapeo en `docker-compose.yml`) | Default 3000. |
| `TRUST_PROXY` | `app.set('trust proxy', 1)` si `true` | Rate limit con IP real. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | `SupabaseService` (y health usa URL/anon) | `getOrThrow` en Supabase. |
| `JWT_SECRET` | Estrategia JWT (`strategies/jwt.strategy.ts`) con fallback hardcodeado; módulo auth lo usa vía config en factory (verificar consistencia) | **Sensible**; no versionar. |
| `PASSWORD_RESET_REDIRECT_URL` | `auth.service.ts` | Link de recuperación; URL debe estar permitida en Supabase. |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | `mail.module.ts` | Configuración SMTP. |
| `ENCRYPTION_KEY` | `EncryptionService` | Hex 64 chars (32 bytes) para AES-256-GCM; obligatoria al instanciar el servicio. |

Plantillas: `.env.example` (general) y `.env.production.example` (producción/Docker). No inventar claves adicionales; confirmar contra `.env`/`.env.production` reales o variables inyectadas por la plataforma/Compose. No versionar secretos.

## 6. Roles y autorización (estado real)

- Roles presentes en **seed/controladores**: `ADMIN`, `ADMINISTRATIVO`, `COMUN`, `AUTOMOTORES` (`src/seed/seed.service.ts`).
- `RolesGuard` (`src/common/guards/roles.guard.ts`): si no hay metadata de roles, permite; si la hay, permite con `ADMIN` (**super rol**) o con cualquier rol requerido. Sin rol suficiente → `ForbiddenException`.
- Decorador: `@Roles(...roles)` (`common/decorators/roles.decorator.ts`).
- **Matriz observada (alto nivel)**:
  - `auth/*`: login/forgot/reset públicos con throttling específico.
  - `users/*`, `roles/*`: `ADMIN`.
  - `solicitudes/*` (certificates): clase `@Roles('ADMINISTRATIVO')` + métodos con `@Roles('ADMINISTRATIVO','ADMIN')`.
  - `flota/vehiculos`: lecturas para autenticados; crear/editar `AUTOMOTORES`; baja definitiva `ADMIN`; registrar revisión y consultas de revisiones según implementación (firmas en controller: `POST :id/revisiones` sin `@Roles` explícito en método, hereda guards JWT+RolesGuard de clase sin rol requerido → cualquier usuario autenticado).
  - `flota/catalogos/*`: lecturas autenticados; mutaciones `AUTOMOTORES`.
  - `api/health`, `api/health/ready`: públicos (Terminus).
- **Diferencia**: el enunciado externo mencionó `bombero/cabo/oficial/admin`; tratar el código/seed como fuente de verdad.

## 7. Organización modular y responsabilidades (NestJS)

| Módulo | Responsabilidad | Rutas/base (observado) | Estructura real |
|---|---|---|---|
| `auth` | Login y recuperación/reset de contraseña vía Supabase Auth + JWT propio | `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` | `strategies/`, `dtos/`, `response/`, controller/service/module, `__tests__`. |
| `users` | ABM/listado/detalle, edición, reenvío bienvenida; roles del usuario; sync email con Supabase Auth; password cifrada (`ENCRYPTION_KEY`) para reenvío | `/users` | `domain/` (`User`, `USER_REPOSITORY`), `repositories/`, `dtos/`, `interface/`, `__tests__`. **Desvío**: consultas directas `.from(...)` en service (roles/`usuario_rol`/`password_cifrada`). |
| `roles` | Asignar rol, listar roles (admin) | `/roles/assign`, `/roles/all-roles` | `dtos/`, controller/service, `roles.modules.ts` (nombre no estándar), `__tests__`. |
| `certificates` | Solicitudes de constancia: alta, edición pendiente, cancelación, realización→PDF, firma, abono, entrega, listado activas/completadas, detalle, PDF | `/solicitudes`, `/solicitudes/completadas`, `/solicitudes/:id/*` | `domain/` (entidad/enums/`CERTIFICATE_REQUEST_REPOSITORY`), `repositories/`, `dtos/`, `pdf/` (builder/mapper/service + assets), service/controller/module, `__tests__`. |
| `fleet` | Vehículos de emergencia: listado/resumen/detalle, alta, edición, baja definitiva (ADMIN), revisiones (historial/última/detalle/registrar) | `/flota/vehiculos` | `domain/` amplio (entidades, enums, license-plate/denomination/revision-status, 3 contratos repo), `repositories/` (emergency-vehicle, revision, vehicle-catalog), `dtos/`, `fleet` + `vehicle-catalog` controllers/services, `__tests__`. |
| `fleet` (catálogos) | Tipos/marcas/modelos: listar (auth) y CRUD parcial con desactivar (AUTOMOTORES) | `/flota/catalogos/tipos|marcas|modelos` | Comparte módulo/DI con fleet. |
| `health` | Liveness/readiness | `/api/health`, `/api/health/ready` | Terminus + `SupabaseHealthIndicator`. |
| `mail` | Construcción y envío de correos (bienvenida, etc.) | N/A (infra) | `builders/`, `templates/`, `mail.module/service`, `__tests__`. |
| `seed` | Carga inicial (roles, usuarios demo, catálogos/datos según implementación) | N/A | `seed.module/service`; excluido parcialmente de cobertura. |
| `supabase` | Clientes Supabase y mapeo de errores | N/A | `supabase.service.ts` (anon/admin), `supabase-error.ts`. |
| `common` | Guards, decoradores, filtro HTTP, pipes, utils, cifrado | N/A | `roles.guard`, `@Roles`, `HttpExceptionFilter`, `parse-id.pipe`, `pagination/date/field-error`, `EncryptionService`. |
| `db` | SQL idempotente de referencia/esquema | N/A | `users.sql`, `fleet.sql`, `certificates.sql`. |

## 8. Modelo de datos (referencia desde `src/db/*.sql` y uso en código)

> Resumen orientativo; la fuente de verdad operativa es Supabase + migraciones/SQL aplicados. Verificar antes de asumir columnas/constraints.

- **Usuarios/Roles** (`users.sql`): `roles`, `usuarios` (incl. `password_cifrada`, `google_sub`, `activo`), `usuario_rol` (N:M). Indices en `usuarios.activo`, `usuario_rol.rol_id`.
- **Constancias/Solicitudes** (`certificates.sql`): enums `tipo_constancia` (app: vivienda/vehicular), `destino_constancia`, `estado_constancia` (`PENDIENTE→REALIZADA→FIRMADA→RETIRADA` o `CANCELADA`), `estado_arancel`, `metodo_pago`. Tablas `damnificados`, `constancias` (número `SOL-*` vía secuencia, FKs, constraints de negocio: póliza según destino, retiro con arancel abonado/exento, cancelación con motivo, reglas EXENTO/ABONADO). Vista `solicitudes_listado` (security invoker) para listado. RLS habilitado (acceso backend por service role, patrón indicado).
- **Flota** (`fleet.sql`): enum `estado_vehiculo_emergencia` (`OPERATIVO`, `MANTENIMIENTO`, `OBSERVACIONES`, `FUERA_SERVICIO`, `BAJA_DEFINITIVA`). Catálogos `tipos/marcas/modelos_vehiculo` (soft-delete `activo`), `vehiculos_emergencia` (patente única normalizada/canónica, denominación normalizada/única entre activos vía `denominacion_clave`, motivo baja). Vista `vehiculos_emergencia_listado`. Tabla `revisiones_vehiculo` (JSONB `items`, `revisado_por`). Función/RPC `registrar_revision_vehiculo(...)` **transaccional** con `FOR UPDATE` y validaciones (baja definitiva, mantenimiento requiere comentario, estado nuevo válido) — alineado a `fleet` domain/repository. RLS/revokes a anon/authenticated; grants a `service_role`.

## 9. Criterios arquitectónicos (aplicar sobre lo existente)

- **Modularidad**: agrupar por módulo, evitar dependencias/ciclos innecesarios.
- **SRP/SOLID pragmático**: controladores = HTTP/validación/delegación; servicios = casos de uso; repositorios = acceso a datos. Evitar lógica de negocio en controllers, servicios “Dios”, acceso a Supabase disperso sin encapsular, duplicación y métodos extensos.
- **Capas (cuando aportan valor)**: en `users/certificates/fleet` se observa `domain/` (entidades/enums/contratos repo + tokens), `repositories/` (infra Supabase), `dtos/`, services/controllers. **No imponer** todas las carpetas a todos los módulos; respetar estructura existente y justificar nuevas capas.
- **DI por abstracción**: `USER_REPOSITORY`, `CERTIFICATE_REQUEST_REPOSITORY`, `VEHICLE_CATALOG_REPOSITORY`, `EMERGENCY_VEHICLE_REPOSITORY`, `REVISION_REPOSITORY`.

## 10. Supabase

- Acceso centralizado en `src/supabase/supabase.service.ts` (`getClient()` anon, `getAdminClient()` service role). En flota/certificados/usuarios (patrón dominante) los repositorios usan admin client.
- **Preferir** consultas en `repositories/` y `throwMappedSupabaseError` (`supabase-error.ts`). Evitar Supabase directo en controllers.
- **Realidad/desvío**: accesos directos `.from(...)` en algunos servicios (`users.service.ts`, `roles.service.ts`, `seed.service.ts`). Tratar como deuda/patrón puntual; no refactor masivo sin autorización.
- No exponer credenciales/service_role; respetar RLS y configuración de Auth (OTP/redirect URLs/rate limits en dashboard, ver `README.md`).

## 11. DTOs y validaciones

- DTOs separados de dominio; `class-validator`/`class-transformer` + Swagger (`@ApiProperty`). Validación global estricta (`forbidNonWhitelisted`).
- Transformaciones (`@Transform` trim/null), enums con `@IsIn`, regex/formatos (fechas/horas/DNI/patentes según módulo), `@ValidateNested`/`@Type` para objetos anidados (certificados).
- Factories estáticas puntuales: `fromDto`, `fromUser`, `fromRow`. **No existe `BaseDto` común**. Reutilizar patrones del módulo.

## 12. Testing

- **Unitarios**: Vitest + `@nestjs/testing`, `src/**/__tests__/*.spec.ts` (controllers, services, repos, DTOs, guards, pipes, utils, seguridad, mail, health, supabase, módulos de dominio).
- **Cobertura** (`vitest.config.ts`, v8): excluye specs, `*.module.ts`, `roles.modules.ts`, `main.ts`, `seed/**`, `*.enums.ts`, `src/**/domain/**/*.repository.ts`.
- **E2E**: `vitest.config.e2e.ts`; no se observó carpeta `test/` con specs. No asumir cobertura unitaria+e2e por endpoint.
- No modificar pruebas para ocultar bugs.

## 13. Convenciones de código

- Nombres/organización Nest existentes, tipado strict, `async/await`, excepciones Nest, formato/lint del proyecto.
- ESM nodenext: imports con extensión `.js`. Naming: `domain/`, `repositories/` (plural), `dtos/` (plural), `__tests__/`.
- Excepciones observadas: `roles.modules.ts`.

## 14. Ejecución del proyecto (`package.json`) y Docker

| Script / método | Comando/propósito |
|---|---|
| Install | `pnpm install` |
| Dev | `pnpm run start` / `start:dev` (watch) / `start:debug` |
| Build/Prod | `pnpm run build` (`nest build`), `pnpm run start:prod` (`node dist/main`) |
| Lint/Format | `pnpm run lint` (`oxlint --type-aware src/ test/`), `pnpm run format` (Prettier `src/**/*.ts test/**/*.ts`) |
| Tests | `pnpm test` (`vitest run`), `test:watch`, `test:cov`, `test:debug`, `test:e2e` (`vitest.config.e2e.ts`) |
| Docker (Compose) | `docker compose up --build` (requiere variables en `.env` o inyectadas). `NODE_ENV` sobrescribible (default `production` en compose/imagen); para pruebas sin flujo de producción: `NODE_ENV=development`. No levanta Supabase local. |

Servidor: `http://localhost:3000` (o `PORT`), docs: `http://localhost:3000/api/docs`, liveness: `/api/health`, readiness: `/api/health/ready`.

## 15. Procedimiento para modificar el proyecto

1. Analizar módulo/estructura actual y buscar implementaciones similares.
2. Identificar dependencias, responsabilidades, contratos HTTP/DB y archivos afectados.
3. Proponer cambios mínimos; implementar respetando convenciones y guards/roles existentes.
4. Ejecutar pruebas relevantes (`pnpm test` / archivo afectado) y revisar regresiones.
5. Documentar diferencias si el patrón real no coincide con un lineamiento externo.

## 16. Restricciones

- No reorganizar módulos ni migrar a “Clean Architecture” total por iniciativa propia. No crear capas vacías ni duplicar servicios/repositorios.
- No agregar dependencias ni cambiar configs sensibles (env, RLS, auth Supabase, CI) o contratos HTTP sin justificación y evaluación de impacto.
- No inventar endpoints/funcionalidades. No “arreglar” tests ocultando errores.

## 17. Actualización de esta skill

Cuando cambie la arquitectura o se agreguen módulos/endpoints: inspeccionar, actualizar árbol, rutas/roles, modelo de datos referenciado, vars de entorno y convenciones; eliminar lo obsoleto. **Describir el estado real, no una arquitectura idealizada.**