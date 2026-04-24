# Motor de Parsing - Correos Bancarios (Gmail)

## Objetivo
Transformar correos bancarios en transacciones estructuradas confiables, con trazabilidad y deduplicacion.

## Pipeline de procesamiento
1. **Fetch incremental**: leer Gmail por `historyId` para obtener solo mensajes nuevos.
2. **Normalizacion**: limpiar HTML, decodificar quoted-printable/base64, extraer texto plano.
3. **Fingerprint de formato**: detectar banco/merchant por remitente, dominio, asunto y frases clave.
4. **Parser por regla**: aplicar extractor especializado segun plantilla.
5. **Clasificacion inicial**: asignar categoria por reglas de merchant/patrones.
6. **Dedupe**: calcular hash canonico e intentar insert idempotente.
7. **Persistencia y trazabilidad**: guardar transaccion + metadatos + version del parser.

## Estrategia de reglas
- Reglas versionadas por archivo (`parser_version`), sin recompilar codigo para ajustes menores.
- Priorizacion:
  - `exact sender+subject pattern`;
  - `sender domain + regex body`;
  - fallback heuristico.
- Cada regla define:
  - condiciones de match;
  - regex de extraccion (`amount`, `date`, `merchant`, `reference`);
  - tipo de movimiento (`income`/`expense`);
  - confianza minima.

## Estructura sugerida de reglas
```yaml
id: banco_chile_debito_v1
version: 1
match:
  from: "notificaciones@bancochile.cl"
  subjectRegex: "Compra|Pago|Transferencia"
extract:
  amountRegex: "(\\$\\s?[0-9\\.]+)"
  dateRegex: "(\\d{2}/\\d{2}/\\d{4})"
  merchantRegex: "(Comercio|Glosa):\\s*(.+)"
type:
  strategy: keyword
  incomeKeywords: ["abono", "deposito", "sueldo"]
  expenseKeywords: ["compra", "pago", "cargo"]
confidence:
  min: 0.75
```

## Manejo de ambiguedad
- Si no hay `amount` valido o fecha parseable:
  - marcar como `unparsed`;
  - registrar evento en `sync_runs.metadata`;
  - no crear transaccion.
- Si hay monto pero falta merchant:
  - crear transaccion con categoria `Sin categorizar`;
  - priorizar revision manual en app.

## Dedupe canonico
`dedupe_hash = sha256(user_id|type|amount|date_yyyy_mm_dd|counterpart_normalized|reference)`

Notas:
- Normalizar acentos, mayusculas y espacios.
- Tolerancia de hora: dedupe por fecha calendario para evitar duplicados con distintas zonas horarias.

## Reentrenamiento de reglas
- Al editar categoria manualmente, almacenar feedback para futuras reglas.
- Revisar semanalmente:
  - tasa de parse exitoso;
  - tasa de reclasificacion manual;
  - top formatos fallidos.

## Observabilidad minima
- Metricas por sync:
  - emails leidos;
  - parse ok;
  - parse fail;
  - dedupe hit;
  - transacciones creadas.
- Trazas con `sync_run_id` para debugging end-to-end.
