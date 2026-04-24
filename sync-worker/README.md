# Sync Worker - Gmail Ingestion

## Responsabilidades
- Ejecutar sincronizaciones manuales y automaticas.
- Consumir Gmail API incrementalmente.
- Parsear correos y crear transacciones idempotentes.
- Guardar resultados en `sync_runs`.

## Modulos internos recomendados
- `jobs/sync-runner`: orquestacion de corrida.
- `gmail/client`: wrapper OAuth + API Gmail.
- `parser/engine`: seleccion de regla y extraccion.
- `ledger/persist`: insercion transaccional y dedupe.
- `telemetry`: metricas y logs.

## Contrato con API
- Entrada: `syncRunId`, `userId`, `emailConnectionId`.
- Salida: estado final y contadores en tabla `sync_runs`.
