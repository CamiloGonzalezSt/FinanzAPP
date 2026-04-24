# Roadmap de Entregas - MVP Full

Duracion sugerida: 8 sprints de 2 semanas (16 semanas).

## Sprint 1 - Fundaciones
- Configuracion monorepo y estandares TypeScript.
- CI basica (lint, test, build).
- Base backend Node + Postgres + migraciones.
- Skeleton React Native (tabs + tema dark premium).
- **Criterio de salida**: pipeline verde y apps Android/iOS compilando.

## Sprint 2 - Auth completo
- Registro/login manual.
- Google Sign-In.
- JWT + refresh rotatorio.
- Pantallas onboarding/login.
- **Criterio de salida**: login end-to-end en dispositivo real.

## Sprint 3 - Conexion Gmail y Sync v1
- OAuth Gmail con `gmail.readonly`.
- Tabla `email_connections` + flujo conectar/desconectar.
- Worker de sincronizacion manual.
- Bitacora `sync_runs`.
- **Criterio de salida**: primer sync funcional con datos reales de prueba.

## Sprint 4 - Parsing y Ledger
- Motor de reglas por formato.
- Dedupe hash idempotente.
- Persistencia en `transactions`.
- Lista de movimientos con filtros basicos.
- **Criterio de salida**: >85% correos de set de prueba parseados sin error.

## Sprint 5 - Dashboard y carga manual
- KPIs inicio (ingresos, egresos, ahorro, sobre-gasto%).
- Graficos simples de tendencia/composicion.
- Alta manual de ingreso/egreso por categoria.
- **Criterio de salida**: dashboard consistente con datos del ledger.

## Sprint 6 - Metas y Presupuestos
- CRUD de metas de ahorro + aportes.
- Presupuestos mensuales por categoria.
- Semaforos de avance por presupuesto.
- **Criterio de salida**: metas/presupuestos funcionales con validaciones completas.

## Sprint 7 - Reportes y exportacion
- Comparativo mes vs mes.
- Export CSV.
- Ajustes UX dark premium y estados vacios/errores.
- **Criterio de salida**: reporte mensual exportable y validado por QA.

## Sprint 8 - Hardening y release
- Notificaciones inteligentes.
- Observabilidad y alertas.
- QA E2E Android+iOS.
- Seguridad final, legales y checklist tiendas.
- **Criterio de salida**: release candidate aprobado para App Store/Play Store.

## Hitos de QA transversales
- Unit tests backend por modulo de negocio.
- Integracion API + DB + worker en staging.
- E2E mobile en cada sprint desde Sprint 4.
- Test de regresion previo a cierre de Sprint 8.
