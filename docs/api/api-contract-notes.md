# API Contract Notes (v1)

- La especificacion base esta en `docs/api/openapi-v1.yaml`.
- Todas las respuestas monetarias usan CLP entero (`amountClp`).
- Errores de validacion usan codigo `422`; auth `401`; permisos `403`.
- Endpoints de sincronizacion responden `202` para ejecuciones asincronas.
- El cliente movil debe tratar `reports/dashboard` como fuente principal de KPIs.

## Convenciones de errores
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "month must match YYYY-MM",
    "details": []
  }
}
```

## Versionado
- Prefijo de version en URL: `/v1`.
- Cambios breaking migran a `/v2`.
