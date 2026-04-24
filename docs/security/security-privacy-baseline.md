# Seguridad y Privacidad - Baseline de Implementacion

## 1) Autenticacion y sesiones
- Access token JWT corto (15 min) + refresh token rotatorio (30 dias max).
- Hash de refresh token en base de datos (nunca guardar token plano).
- Revocacion por dispositivo al cerrar sesion o detectar riesgo.
- Bloqueo gradual por intentos fallidos (rate limit + cooldown).

## 2) OAuth Google/Gmail
- Alcance minimo: `https://www.googleapis.com/auth/gmail.readonly`.
- Consent screen explicando uso exacto: lectura de movimientos financieros.
- Tokens OAuth cifrados en reposo con KMS/secret manager.
- Endpoint de desconexion para revocar acceso y eliminar token local.

## 3) Cifrado y secretos
- TLS 1.2+ obligatorio en todo trafico.
- Cifrado en reposo para base de datos y backups.
- Secretos fuera de repositorio (secret manager por entorno).
- Rotacion trimestral de claves criticas.

## 4) Data governance
- Minimizar PII: almacenar solo campos necesarios del correo.
- No persistir cuerpo completo si no es necesario para auditoria.
- Politica de retencion:
  - logs operativos: 90 dias;
  - auditoria de seguridad: 12 meses;
  - datos financieros: conservacion hasta solicitud de borrado.
- Derecho a borrado de cuenta: eliminacion o anonimizado irreversible.

## 5) Controles de API
- Validacion estricta de payload (schema-first).
- Autorizacion por propietario (`user_id` del token).
- Rate limits por IP y por usuario autenticado.
- Idempotency key para operaciones sensibles de escritura.

## 6) Auditoria y monitoreo
- Registrar eventos: login, refresh, sync start/end, conexion/desconexion Gmail, export CSV.
- Alerta en tiempo real ante:
  - picos de errores auth;
  - intentos anormales de sync;
  - multiples fallos OAuth en ventana corta.
- Correlacion por `request_id` y `sync_run_id`.

## 7) Privacidad y legal
- Politica de privacidad clara en lenguaje no tecnico.
- Consentimiento explicito antes de conectar Gmail.
- Terminos de uso y contacto de soporte.
- Banner de cambios de politica con reconsentimiento si cambia el uso de datos.

## 8) Checklist de salida a produccion
- [ ] Pen-test basico API y mobile.
- [ ] SAST/Dependency scan en CI.
- [ ] Backups restaurables probados.
- [ ] Procedimiento de respuesta a incidentes.
- [ ] Documentacion de cumplimiento lista para tiendas.
