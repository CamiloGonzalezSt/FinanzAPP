# App Financiera Movil

Implementacion base del plan maestro para una app financiera Chile-first (CLP), con stack React Native + Node.js + PostgreSQL + sincronizacion Gmail.

## Estructura
- `mobile-app/`: aplicacion React Native (iOS/Android).
- `backend-api/`: API Node.js modular.
- `sync-worker/`: procesamiento de correos y deduplicacion.
- `infra/`: infraestructura y despliegue.
- `docs/`: entregables funcionales y tecnicos.

## Documentos clave
- UX flows: `docs/product/ux-flows.md`
- Modelo de datos: `docs/data/schema.sql`
- API contract: `docs/api/openapi-v1.yaml`
- Parser: `docs/parsing/parser-architecture.md`
- Seguridad: `docs/security/security-privacy-baseline.md`
- Roadmap: `docs/roadmap/mvp-full-sprints.md`

## Fase 1 tecnica (scaffold real)
- Mobile scaffold: Expo + TypeScript con tabs base y pantallas iniciales.
- Backend scaffold: Express + TypeScript modular con rutas v1.

## Comandos utiles
- `npm run dev:mobile`
- `npm run dev:api`
- `npm run typecheck:api`
- `npm run --workspace mobile-app typecheck`

## Postgres local con Docker
- `npm run db:up`
- `npm run db:init`
- `npm run db:seed`
- `npm run db:down`
