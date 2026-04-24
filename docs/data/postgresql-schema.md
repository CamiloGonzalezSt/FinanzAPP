# Diseno de Datos - PostgreSQL

Este documento define las decisiones de modelado para la app financiera Chile-first.

## Principios
- Multi-tenant por usuario: toda entidad financiera cuelga de `user_id`.
- Monto en CLP como entero (`BIGINT`) para evitar errores de precision.
- Ledger unico para movimientos manuales y sincronizados.
- Dedupe fuerte por hash para impedir doble contabilizacion.

## Tablas principales
- `users`: perfil y preferencias regionales.
- `auth_identities`: login manual y Google.
- `email_connections`: vinculacion Gmail y estado de sincronizacion.
- `transactions`: libro contable unificado.
- `categories`: categorias sistema + custom.
- `budgets`: presupuesto mensual por categoria.
- `saving_goals` + `goal_contributions`: metas y aportes.
- `sync_runs`: trazabilidad operativa de cada sincronizacion.
- `audit_logs`: evidencia de eventos de seguridad y negocio.

## Regla de deduplicacion
`dedupe_hash` se calcula en backend con:
- tipo (`income`/`expense`);
- monto;
- fecha normalizada;
- remitente/merchant;
- referencia del correo si existe.

Se aplica `UNIQUE (user_id, dedupe_hash)` para garantizar idempotencia.

## Constraints criticos
- Montos positivos (`amount_clp > 0`).
- Mes valido en presupuestos (`1..12`).
- Password requerida para proveedor manual.
- `email_connections` limitada a proveedor Google en esta version.

## Indices clave
- Consultas de dashboard y reportes por fecha: `idx_transactions_user_date`.
- Filtros por tipo/categoria: `idx_transactions_user_type_date`, `idx_transactions_user_category_date`.
- Observabilidad de sync y auditoria: `idx_sync_runs_user_started`, `idx_audit_logs_user_created`.

## Siguiente paso tecnico
1. Migrar `schema.sql` a sistema de migraciones (Prisma/Knex/Drizzle).
2. Agregar seed inicial de categorias sistema (`Comida`, `Deuda`, `Cuentas`, etc.).
3. Crear vistas/materialized views para agregaciones mensuales.
