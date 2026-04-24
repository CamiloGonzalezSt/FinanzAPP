# Backend API Scaffold

API Node.js + TypeScript alineada al contrato `docs/api/openapi-v1.yaml`.

## Scripts
- `npm run dev`: desarrollo con recarga.
- `npm run typecheck`: validacion TypeScript.
- `npm run build`: compila a `dist/`.
- `npm start`: ejecuta build compilado.
- `npm run db:init`: aplica `docs/data/schema.sql` en la base.
- `npm run db:seed`: carga categorias y movimientos de demo.

## Modulos iniciales
- `auth`
- `sync`
- `transactions`
- `goals`
- `budgets`
- `reports`

## Inicio rapido
1. Copiar `.env.example` a `.env`.
2. Ejecutar `npm install`.
3. Levantar Postgres con `docker compose -f ../infra/docker-compose.yml up -d`.
4. Ejecutar `npm run db:init`.
5. Ejecutar `npm run db:seed`.
6. Ejecutar `npm run dev`.
