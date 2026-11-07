# CentralBV Backend

[![Build NestJS APP](https://github.com/rodripavon97/centralBV_back/actions/workflows/ci.yml/badge.svg)](https://github.com/rodripavon97/centralBV_back/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/rodripavon97/centralBV_back/branch/develop/graph/badge.svg?token=LBHU24T6H1)](https://codecov.io/gh/rodripavon97/centralBV_back)

API backend para **CentralBV** (gestión de bomberos voluntarios), construida con [NestJS](https://nestjs.com) y [Supabase](https://supabase.com).

> Documentación técnica detallada (arquitectura real, módulos, rutas/roles, desvíos): `.opencode/skills/estructura-proyecto/SKILL.md`. Reglas operativas para agentes: `AGENTS.md`.

## Stack

- **Runtime/paquetes**: Node.js (README indica 20+; `package.json` tipa `@types/node` ^24), [pnpm](https://pnpm.io)
- **Framework**: NestJS 12, Express
- **Lenguaje**: TypeScript **strict**, ESM (`"type": "module"`), `nodenext`; imports internos con extensión `.js`
- **Datos/Auth (cloud)**: Supabase (`@supabase/supabase-js`), cliente anon + admin (`SupabaseService`); RLS/políticas se gestionan en Supabase
- **API**: Swagger en `/api/docs` (Bearer), `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`), `HttpExceptionFilter` global, CORS habilitado
- **Seguridad**: Passport JWT, `RolesGuard` + `@Roles`, `ThrottlerGuard` global (100/min por IP por defecto) + límites específicos en endpoints sensibles, cifrado AES-256-GCM (`ENCRYPTION_KEY`) para reenvío controlado de contraseña
- **Otros**: `class-validator`/`class-transformer`, Mailer/nodemailer, `jspdf` (PDF de constancias)
- **Calidad**: Vitest + `@nestjs/testing` + Supertest, cobertura v8, oxlint (type-aware), Prettier

## Requisitos

- Node.js 20+
- pnpm
- Proyecto/configuración en Supabase (URL, claves, Auth, políticas según entorno)
- Variables de entorno configuradas (ver sección siguiente)

## Setup

1. Instalar dependencias:

```bash
pnpm install
```

2. Configurar variables de entorno (`.env`). El README histórico referencia `.env.example`; si no existe en tu copia local, créalo/verifícalo contra la configuración real del despliegue. **No versiones secretos**.

```bash
cp .env.example .env
```

## Variables de entorno (referenciadas en código)

| Variable | Uso | Notas |
|---|---|---|
| `PORT` | Puerto HTTP (`src/main.ts`) | Default `3000` |
| `TRUST_PROXY` | `trust proxy` si es `true` | Necesario detrás de proxy/CDN para rate limit por IP real |
| `SUPABASE_URL` | Supabase | Requerida (`getOrThrow`) |
| `SUPABASE_ANON_KEY` | Cliente anon / health | Requerida |
| `SUPABASE_SERVICE_ROLE_KEY` | Cliente admin (backend) | Requerida; **no exponer** en frontend |
| `JWT_SECRET` | JWT (estrategia/módulo auth) | Sensible. La estrategia tiene un fallback hardcodeado; verificar consistencia de configuración en todos los entornos |
| `PASSWORD_RESET_REDIRECT_URL` | Link de recuperación | Debe estar permitido en Supabase Auth → URL Configuration |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` | SMTP (`mail.module.ts`) | Envío de correos (p. ej. bienvenida) |
| `ENCRYPTION_KEY` | `EncryptionService` | Hex 64 chars (32 bytes) para AES-256-GCM; obligatoria al instanciar el servicio |

> Pueden existir otras variables según el entorno; confirmar contra la configuración real.

## Ejecución

```bash
# desarrollo (watch)
pnpm run start:dev

# build + producción
pnpm run build
pnpm run start:prod
```

- API: `http://localhost:3000` (o `PORT`)
- Swagger: `http://localhost:3000/api/docs`

## Scripts (`package.json`)

| Script | Propósito |
|---|---|
| `pnpm install` | Dependencias |
| `pnpm run start` / `start:dev` / `start:debug` | Ejecutar Nest |
| `pnpm run build` | Compilar (`nest build`) |
| `pnpm run start:prod` | `node dist/main` |
| `pnpm run lint` | `oxlint --type-aware src/ test/` |
| `pnpm run format` | Prettier `src/**/*.ts test/**/*.ts` |
| `pnpm test` | `vitest run` |
| `pnpm run test:watch` / `test:cov` / `test:debug` | Variantes Vitest |
| `pnpm run test:e2e` | Vitest con `vitest.config.e2e.ts` (no se observó carpeta `test/` poblada en el árbol fuente) |

## Arquitectura (resumen real)

- **Composición**: `src/main.ts` (bootstrap, CORS, pipes/filtros globales, Swagger) + `src/app.module.ts` (Config global, Throttler, módulos: `Supabase`, `Health`, `Auth`, `Users`, `Roles`, `Seed`, `CertificateRequest`, `Fleet`).
- **Ubicación de módulos**: `src/<feature>/` (no `src/modules/`).
- **Patrón en módulos de dominio** (`users`, `certificates`, `fleet`): `domain/` (entidades/enums/contratos + tokens DI `*_REPOSITORY`), `repositories/` (infra Supabase), `dtos/`, `__tests__/`, controllers/services. Otros módulos (`auth`, `roles`, `health`, `mail`, `seed`, `supabase`, `common`) son más simples.
- **Acceso a datos**: preferentemente vía repositorios + `SupabaseService.getAdminClient()` y `throwMappedSupabaseError`. **Desvío observado**: consultas directas `.from(...)` en algunos servicios (`users.service.ts`, `roles.service.ts`, `seed.service.ts`).
- **DTOs**: `class-validator`/`class-transformer` + Swagger; sin `BaseDto` común; factories estáticas puntuales (`fromDto`/`fromUser`/`fromRow`).

### Estructura de `src/` (alto nivel)

```text
src/
  app.module.ts, main.ts
  auth/            strategies, dtos, response, controller/service/module
  certificates/    domain, dtos, repositories, pdf, controller/service/module
  common/          decorators, filters, guards, pipes, security, utils
  db/              users.sql, fleet.sql, certificates.sql (referencia)
  fleet/           domain, dtos, repositories, fleet + vehicle-catalog controllers/services
  health/          controller/module, supabase-health.indicator
  mail/            builders, templates, service/module
  roles/           dtos, controller/service (roles.modules.ts)
  seed/            service/module
  supabase/        service/module, supabase-error
  users/           domain, dtos, interface, repositories, controller/service/module
```

## Módulos y API (observado)

| Área | Base/rutas | Acceso (resumen) | Notas |
|---|---|---|---|
| Auth | `/auth/login`, `/auth/forgot-password`, `/auth/reset-password` | Públicos; forgot/reset con throttling | Recuperación vía Supabase + reglas en `README`/servicio |
| Users | `/users` | `ADMIN` | ABM/listado/detalle, edición, reenvío bienvenida, roles, sync email Auth |
| Roles | `/roles/assign`, `/roles/all-roles` | `ADMIN` | Gestión/listado de roles |
| Certificados | `/solicitudes`, `/solicitudes/completadas`, `/solicitudes/:id/*` | `ADMINISTRATIVO`/`ADMIN` (según controlador) | Ciclo PENDIENTE→REALIZADA→FIRMADA→RETIRADA o CANCELADA; PDF (REALIZADA/FIRMADA/RETIRADA) |
| Flota | `/flota/vehiculos` (+ revisiones/resumen/baja) | Lecturas autenticados; crear/editar `AUTOMOTORES`; baja `ADMIN`; registrar revisión según implementación (autenticado) | Catálogos y revisiones; RPC transaccional `registrar_revision_vehiculo` (SQL) |
| Catálogos flota | `/flota/catalogos/tipos|marcas|modelos` | Lecturas autenticados; mutaciones `AUTOMOTORES` | Soft-deactivate |
| Health | `/api/health`, `/api/health/ready` | Público | Liveness/readiness (Terminus + Supabase) |

**Roles en código/seed**: `ADMIN` (super rol, bypass en `RolesGuard`), `ADMINISTRATIVO`, `COMUN`, `AUTOMOTORES`. Esto difiere de nomenclaturas externas; usar el código como fuente de verdad.

## Password recovery

`POST /auth/forgot-password` generates a single-use Supabase recovery link and emails it to the user. The link points to `PASSWORD_RESET_REDIRECT_URL`; the frontend then sends the access token to `POST /auth/reset-password`.

The link validity is **not** controlled by the API. Configure it in the Supabase dashboard:

1. **Authentication → Providers → Email → Email OTP Expiration**: set `7200` seconds (2 hours).
2. **Authentication → URL Configuration → Redirect URLs**: add the exact URL used in `PASSWORD_RESET_REDIRECT_URL` (for example `http://localhost:5173/update-password`). Without it, Supabase falls back to the Site URL.
3. **Authentication → Rate Limits**: adjust the email/OTP limits if needed.

Notes:

- Supabase issues a new recovery token on every request and invalidates the previous one, so only the latest link works.
- Once used, the token cannot be reused; `POST /auth/reset-password` then returns a "link expired or already used" error.
- Keep the "expires in 2 hours" text in `src/mail/templates/welcome-email.template.ts` in sync if you change the Supabase setting.

Security hardening:

- Rate limits: `forgot-password` allows 3 requests/min per IP and `reset-password` 5/min (global default: 100/min). Set `TRUST_PROXY=true` when the API runs behind a proxy/CDN so the real client IP is used.
- `reset-password` only accepts access tokens whose `amr` claim comes from an email link (`recovery`, `otp` or `magiclink`). A token from a normal password login is rejected.
- Before changing the password, all of the user's sessions are revoked with `auth.admin.signOut(recoveryToken, 'global')` (the recovery token is a valid user JWT). Supabase also revokes every session when an admin updates a password, so this is a best-effort extra guarantee.

## Testing

- **Vitest** (`globals: true`, `**/*.spec.ts`), specs principalmente en `src/**/__tests__/`.
- Cobertura v8 (`vitest.config.ts`) excluye módulos, `main.ts`, `seed`, enums e interfaces de repositorio en `domain/`.
- E2E: existe `vitest.config.e2e.ts`; no se observó carpeta `test/` con specs.

```bash
pnpm test
pnpm run test:cov
pnpm run test:e2e
```

## Base de datos (referencia)

`src/db/users.sql`, `src/db/fleet.sql`, `src/db/certificates.sql` contienen SQL idempotente de referencia (tablas/enums/vistas/constraints/RLS/RPC relevantes). La fuente operativa es Supabase (migraciones/estado aplicado); verificar antes de asumir el esquema.

## Notas y desviaciones conocidas

- Nomenclatura de carpetas: `repositories/` y `dtos/` (plural) en módulos con patrón de dominio; no hay `src/modules/`.
- `src/roles/roles.modules.ts` (nombre no estándar).
- Sin `BaseDto` común; no todos los DTOs implementan `static from*`.
- Acceso directo a Supabase en algunos servicios (ver arriba) — refactors solo si se autorizan.
- No se detectaron `Dockerfile*`/`.env*` versionados en raíz por glob; la documentación de endpoints por endpoint en README no es sistemática.

## Licencia

UNLICENSED (privado), según `package.json`.
