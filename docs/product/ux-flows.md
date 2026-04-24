# UX Flows - App Financiera (Dark Premium)

## Diseno base
- Tema oscuro premium: fondo `#0B1020`, superficie `#121A2B`, primario `#5BC0EB`, exito `#2ED47A`, alerta `#FF6B6B`, texto principal `#EAF2FF`.
- Tipografia recomendada: Inter / SF Pro fallback.
- Grid: 8px, cards con radio 16px, botones primarios de alto 52px.

## Arquitectura de navegacion
- Bottom tabs: `Inicio`, `Movimientos`, `Agregar`, `Metas`, `Reportes`.
- Stack secundario: `Login`, `Onboarding`, `Conectar Gmail`, `Perfil`, `Presupuestos`, `Detalle meta`.

## Flujo 1 - Onboarding y autenticacion
1. Pantalla de bienvenida con propuesta de valor.
2. Opcion `Entrar con Google` o `Crear cuenta manual`.
3. Si Google:
   - OAuth Google Sign-In.
   - Solicitud de permiso Gmail (`gmail.readonly`) con consentimiento claro.
4. Si manual:
   - Registro email/password.
   - Opcion posterior para conectar Google/Gmail.
5. Confirmacion de privacidad y uso de datos.

## Flujo 2 - Sincronizacion Gmail
1. App abre `Inicio` y dispara `sync` automatico si:
   - usuario tiene Gmail conectado;
   - ultimo sync > 60s.
2. En `Inicio` existe boton `Sincronizar ahora`.
3. Durante sync:
   - indicador no bloqueante;
   - progreso simple `Revisando movimientos...`.
4. Resultado:
   - resumen: nuevos ingresos, nuevos egresos, duplicados ignorados.
   - enlace rapido a `Movimientos`.

## Flujo 3 - Dashboard principal
- Encabezado mes actual (CLP).
- KPIs:
  - `Ingresos`.
  - `Egresos`.
  - `Ahorro (Ingresos - Egresos)`.
  - `% Sobre-gasto` (si egresos > ingresos).
- Graficos:
  - tendencia semanal ingresos/egresos (linea dual);
  - composicion de egresos por categoria (donut).
- CTA: `Sincronizar ahora`, `Agregar movimiento`.

## Flujo 4 - Movimientos (ledger)
- Lista cronologica con signo y color:
  - ingresos en verde, egresos en rojo.
- Item: monto, glosa real, categoria, fecha, origen (`gmail`/`manual`).
- Filtros: mes, tipo, categoria, origen.
- Acciones:
  - editar categoria;
  - marcar como duplicado/falso positivo;
  - agregar nota.

## Flujo 5 - Alta manual de gasto/ingreso
1. Tab `Agregar`.
2. Formulario:
   - tipo (egreso/ingreso);
   - monto CLP;
   - categoria;
   - glosa;
   - fecha.
3. Guardar y reflejar instantaneamente en dashboard.

## Flujo 6 - Metas de ahorro
1. Tab `Metas` con listado de metas activas/completadas.
2. Crear meta:
   - nombre;
   - monto objetivo;
   - aporte mensual;
   - fecha objetivo.
3. Detalle meta:
   - barra de progreso;
   - meses estimados restantes;
   - boton para registrar aporte extraordinario.

## Flujo 7 - Reportes y presupuestos
- Vista comparativa mes vs mes.
- Presupuesto por categoria con semaforo:
  - verde < 80%;
  - amarillo 80-100%;
  - rojo > 100%.
- Exportar CSV desde `Reportes`.

## Estados, vacios y errores
- Sin datos: ilustracion + CTA de sincronizar o cargar primer movimiento.
- Error OAuth: CTA `Reconectar Gmail`.
- Error de parsing: mostrar movimiento como `Sin categorizar`.
