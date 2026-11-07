# AGENTS.md — Gestoría de Bomberos (`centralBV_Back`)

Guía operativa para agentes que trabajan en este repositorio. Basada en la **estructura y convenciones reales** observadas en el código; no asume carpetas, clases ni funcionalidades inexistentes.

## Contexto del proyecto

- **Dominio**: API backend para gestión de bomberos voluntarios (CentralBV).
- **Stack**: NestJS 12 + TypeScript (strict), Node.js (README indica 20+; `package.json` tipa `@types/node` ^24), pnpm, ESM (`"type": "module"`).
- **Persistencia/Auth**: Supabase Cloud vía `@supabase/supabase-js`; acceso encapsulado en `SupabaseService` (`src/supabase/`).
- **Seguridad de datos**: se usa cliente admin de Supabase y mapeo de errores (`throwMappedSupabaseError`); la seguridad a nivel de fila (RLS) es una responsabilidad de Supabase (configuración en la plataforma/SQL) — no modificar políticas sensibles sin autorización.
- **Autenticación/Autorización HTTP**: JWT (`@nestjs/passport`/`passport-jwt`, módulo `auth`) + `RolesGuard`/decorador `@Roles`. Roles presentes en el código/seed: `ADMIN`, `ADMINISTRATIVO`, `COMUN`, `AUTOMOTORES` (ver `src/seed/seed.service.ts`, `src/common/guards/roles.guard.ts`, controladores). `ADMIN` actúa como rol con acceso transversal en el guard.

## Reglas generales

- **Respetar la arquitectura existente**. Antes de cambiar, identificar el patrón del módulo afectado (no todos siguen la misma forma; ver skill `estructura-proyecto`).
- **Aplicar SOLID y Clean Code**. Priorizar **Single Responsibility Principle** en controladores, servicios, repositorios y DTOs.
- **Evitar duplicación** y **métodos excesivamente largos**. Extraer lógica reutilizable (p. ej. a `src/common/utils/`, builders, helpers del módulo) cuando mejore claridad sin sobre-abstraer.
- **No introducir múltiples responsabilidades en una clase**. Los controladores orquestan HTTP/validación/delegación; los servicios concentran casos de uso; los repositorios encapsulan acceso a datos.
- **No agregar dependencias** sin justificación clara y alineada al stack.
- **No modificar configuraciones sensibles** (variables de entorno, credenciales, políticas RLS/SQL en Supabase, CI/CD, configuración de auth) sin autorización explícita.
- **No inventar funcionalidades**, endpoints, tablas, carpetas ni contratos que no existan o no hayan sido solicitados.
- **Mantener TypeScript strict** (`tsconfig.json`: `strict: true`, `moduleResolution: nodenext`). Preservar imports ESM con extensión `.js` en código fuente TypeScript, coherente con el proyecto.
- **Respetar convenciones existentes** de nombres, estructura de pruebas (`__tests__/*.spec.ts`), DTOs con `class-validator`/`class-transformer` y Swagger cuando aplique.
- **Mostrar los cambios realizados y explicar las decisiones** (qué se cambió, por qué, impacto/riesgos).

## Forma de trabajo recomendada

1. Analizar el módulo/capa afectado y sus dependencias antes de editar.
2. Hacer cambios mínimos y localizados; evitar refactorizaciones masivas no solicitadas.
3. Ejecutar pruebas relevantes (`pnpm test`, o archivos/config específicos) cuando el cambio afecte comportamiento.
4. Si una regla del usuario entra en conflicto con la implementación real, **documentar la diferencia** y pedir confirmación antes de “alinear” código existente.

## Comandos útiles (según `package.json`)

- `pnpm install` — dependencias.
- `pnpm run start:dev` — desarrollo (watch).
- `pnpm run build` / `pnpm run start:prod` — producción.
- `pnpm test` / `pnpm run test:cov` — Vitest (cobertura v8).
- `pnpm run lint` — `oxlint --type-aware src/ test/`.
- `pnpm run format` — Prettier (`src/**/*.ts`, `test/**/*.ts`).
